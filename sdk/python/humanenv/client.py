from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any

import websockets

from .errors import ErrorCode, HumanEnvError
from .fingerprint import generate_fingerprint


@dataclass
class ClientConfig:
    server_url: str
    project_name: str
    api_key: str | None = None
    max_retries: int = 10


PendingOp = tuple[Any, asyncio.Future[str], asyncio.Task]


class HumanEnvClient:
    def __init__(self, config: ClientConfig) -> None:
        self._config = config
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._connected = False
        self._authenticated = False
        self._whitelist_status: str | None = None
        self._attempts = 0
        self._pending: dict[str, PendingOp] = {}
        self._retry_timer: asyncio.Task | None = None
        self._ping_timer: asyncio.Task | None = None
        self._disconnecting = False
        self._authResolve: asyncio.Future[None] | None = None
        self._authReject: asyncio.Future[None] | None = None
        self._connect_future: asyncio.Future[None] | None = None

    @property
    def whitelist_status(self) -> str | None:
        return self._whitelist_status

    async def connect(self) -> None:
        self._connect_future = asyncio.Future()
        try:
            await self._do_connect()
            await self._connect_future
        finally:
            self._connect_future = None

    async def _do_connect(self) -> None:
        server_url = self._config.server_url
        proto = "wss" if server_url.startswith("https") else "ws"
        host = server_url.replace("https://", "").replace("http://", "").rstrip("/")
        url = f"{proto}://{host}/ws"

        try:
            self._ws = await websockets.connect(url)
        except Exception as e:
            raise HumanEnvError(ErrorCode.WS_CONNECTION_FAILED, str(e))

        self._connected = True
        self._attempts = 0

        asyncio.create_task(self._receive_loop())
        self._start_ping()
        await self._send_auth()

    async def _receive_loop(self) -> None:
        if self._ws is None:
            return
        try:
            async for raw in self._ws:
                try:
                    msg = json.loads(raw)
                    self._handle_message(msg)
                except Exception:
                    pass
        except websockets.ConnectionClosed:
            pass
        finally:
            self._connected = False
            self._authenticated = False
            self._stop_ping()
            if not self._disconnecting:
                asyncio.create_task(self._schedule_reconnect())

    def _handle_message(self, msg: dict[str, Any]) -> None:
        msg_type = msg.get("type")
        payload = msg.get("payload", {})

        if msg_type == "auth_response":
            if payload.get("success"):
                self._authenticated = True
                if payload.get("whitelisted"):
                    self._whitelist_status = "approved"
                elif payload.get("status"):
                    self._whitelist_status = payload["status"]
                else:
                    self._whitelist_status = "pending"
                if self._authResolve and not self._authResolve.done():
                    self._authResolve.set_result(None)
            else:
                error = HumanEnvError(
                    ErrorCode(payload.get("code", "CLIENT_AUTH_INVALID_PROJECT_NAME")),
                    payload.get("error"),
                )
                if self._authReject and not self._authReject.done():
                    self._authReject.set_exception(error)
            self._authResolve = None
            self._authReject = None
            if self._connect_future and not self._connect_future.done():
                self._connect_future.set_result(None)
            return

        if msg_type == "get_response":
            self._resolve_pending("get", payload)
            return

        if msg_type == "set_response":
            self._resolve_pending("set", payload)
            return

        if msg_type == "pong":
            pass

    def _resolve_pending(self, kind: str, payload: dict[str, Any]) -> None:
        for key, op in list(self._pending.items()):
            _, future, timeout_task = op
            timeout_task.cancel()
            del self._pending[key]
            if payload.get("error"):
                code = payload.get("code", "SERVER_INTERNAL_ERROR")
                future.set_exception(HumanEnvError(ErrorCode(code), payload["error"]))
            else:
                future.set_result(payload.get("value", ""))
            return

    async def _send_auth(self) -> None:
        if self._ws is None:
            return
        self._authResolve = asyncio.Future()
        self._authReject = asyncio.Future()
        auth_msg = {
            "type": "auth",
            "payload": {
                "projectName": self._config.project_name,
                "apiKey": self._config.api_key or "",
                "fingerprint": generate_fingerprint(),
            },
        }
        await self._ws.send(json.dumps(auth_msg))

    async def get(self, key: str) -> str:
        if not self._connected or not self._authenticated:
            raise HumanEnvError(ErrorCode.CLIENT_AUTH_INVALID_API_KEY)
        if isinstance(key, list):
            return await self._get_multiple(key)
        return await self._get_single(key)

    async def _get_single(self, key: str) -> str:
        if self._ws is None:
            raise HumanEnvError(ErrorCode.CLIENT_AUTH_INVALID_API_KEY)
        msg_id = f"{key}-{id(key)}"
        future: asyncio.Future[str] = asyncio.Future()
        timeout_task = asyncio.create_task(self._timeout_op(msg_id, future, key))
        self._pending[msg_id] = (key, future, timeout_task)
        await self._ws.send(json.dumps({"type": "get", "payload": {"key": key}}))
        return await future

    async def _get_multiple(self, keys: list[str]) -> dict[str, str]:
        results: dict[str, str] = {}
        await asyncio.gather(*[self._get_single(k) for k in keys])
        for key in keys:
            op = self._pending.get(f"{key}-{id(key)}")
            if op:
                _, future, _ = op
                results[key] = future.result()
        return results

    async def _timeout_op(self, msg_id: str, future: asyncio.Future[str], key: str) -> None:
        await asyncio.sleep(8)
        if msg_id in self._pending:
            del self._pending[msg_id]
            if not future.done():
                future.set_exception(
                    HumanEnvError(
                        ErrorCode.CLIENT_AUTH_INVALID_API_KEY, f"Timeout getting env: {key}"
                    )
                )

    async def set(self, key: str, value: str) -> None:
        if not self._connected or not self._authenticated:
            raise HumanEnvError(ErrorCode.CLIENT_AUTH_INVALID_API_KEY)
        if self._ws is None:
            raise HumanEnvError(ErrorCode.CLIENT_AUTH_INVALID_API_KEY)
        msg_id = f"set-{id(key)}"
        future: asyncio.Future[None] = asyncio.Future()
        timeout_task = asyncio.create_task(self._timeout_set(msg_id, future, key))
        self._pending[msg_id] = (key, future, timeout_task)
        await self._ws.send(json.dumps({"type": "set", "payload": {"key": key, "value": value}}))
        await future

    async def _timeout_set(self, msg_id: str, future: asyncio.Future[None], key: str) -> None:
        await asyncio.sleep(8)
        if msg_id in self._pending:
            del self._pending[msg_id]
            if not future.done():
                future.set_exception(
                    HumanEnvError(
                        ErrorCode.CLIENT_AUTH_INVALID_API_KEY, f"Timeout setting env: {key}"
                    )
                )

    async def _schedule_reconnect(self) -> None:
        if self._attempts >= self._config.max_retries:
            raise HumanEnvError(ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED)
        self._attempts += 1
        delay = min(1000 * (2 ** (self._attempts - 1)), 30000)
        await asyncio.sleep(delay / 1000)
        await self._do_connect()

    def _start_ping(self) -> None:
        self._stop_ping()
        self._ping_timer = asyncio.create_task(self._ping_loop())

    async def _ping_loop(self) -> None:
        while True:
            await asyncio.sleep(30)
            if self._ws and self._ws.open:
                await self._ws.send(json.dumps({"type": "ping"}))

    def _stop_ping(self) -> None:
        if self._ping_timer:
            self._ping_timer.cancel()
            self._ping_timer = None

    async def connect_and_wait_for_auth(self, timeout_ms: int) -> None:
        if self._connected and self._authenticated:
            return
        deadline = asyncio.get_event_loop().time() + (timeout_ms / 1000)
        while asyncio.get_event_loop().time() < deadline:
            if self._connected and self._authenticated:
                return
            await asyncio.sleep(0.2)
        if not self._connected:
            await self._do_connect()

    def disconnect(self) -> None:
        self._stop_ping()
        if self._retry_timer:
            self._retry_timer.cancel()
            self._retry_timer = None
        self._disconnecting = True
        if self._ws:
            asyncio.create_task(self._ws.close())
        self._ws = None
