from .client import ClientConfig, HumanEnvClient
from .errors import ErrorCode, HumanEnvError

__all__ = ["HumanEnvClient", "ClientConfig", "HumanEnvError", "ErrorCode"]

_singleton: HumanEnvClient | None = None
_config_set = False


def config(cfg: ClientConfig) -> None:
    global _singleton, _config_set
    if _config_set:
        return
    _config_set = True
    _singleton = HumanEnvClient(cfg)


async def get(key: str) -> str:
    if _singleton is None:
        raise RuntimeError("humanenv.config() must be called first")
    return await _singleton.get(key)


async def set(key: str, value: str) -> None:
    if _singleton is None:
        raise RuntimeError("humanenv.config() must be called first")
    await _singleton.set(key, value)


def disconnect() -> None:
    global _singleton, _config_set
    if _singleton:
        _singleton.disconnect()
        _singleton = None
        _config_set = False
