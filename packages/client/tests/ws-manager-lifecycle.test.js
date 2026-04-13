"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const ws_manager_ts_1 = require("../src/ws-manager.ts");
const humanenv_shared_1 = require("humanenv-shared");
const ws_test_helpers_ts_1 = require("./ws-test-helpers.ts");
(0, node_test_1.describe)('HumanEnvClient constructor', () => {
    (0, node_test_1.it)('stores required config fields', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const cfg = client.config;
        node_assert_1.default.strictEqual(cfg.serverUrl, 'http://localhost:3056');
        node_assert_1.default.strictEqual(cfg.projectName, 'test-project');
        node_assert_1.default.strictEqual(cfg.projectApiKey, 'test-key');
    });
    (0, node_test_1.it)('defaults maxRetries to 10', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        node_assert_1.default.strictEqual(client.config.maxRetries, 10);
    });
    (0, node_test_1.it)('allows custom maxRetries', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)({ maxRetries: 3 });
        node_assert_1.default.strictEqual(client.config.maxRetries, 3);
    });
    (0, node_test_1.it)('defaults projectApiKey to empty string when omitted', () => {
        const client = new ws_manager_ts_1.HumanEnvClient({ serverUrl: 'http://localhost:3056', projectName: 'p' });
        node_assert_1.default.strictEqual(client.config.projectApiKey, '');
    });
    (0, node_test_1.it)('initialises internal state correctly', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        node_assert_1.default.strictEqual(client.connected, false);
        node_assert_1.default.strictEqual(client.authenticated, false);
        node_assert_1.default.strictEqual(client.attempts, 0);
        node_assert_1.default.strictEqual(client.reconnecting, false);
        node_assert_1.default.strictEqual(client.disconnecting, false);
        node_assert_1.default.strictEqual(client.whitelistStatus, null);
    });
});
(0, node_test_1.describe)('HumanEnvClient whitelistStatus', () => {
    (0, node_test_1.it)('returns null before auth', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        node_assert_1.default.strictEqual(client.whitelistStatus, null);
    });
    (0, node_test_1.it)('returns approved after auth with status field', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client._whitelistStatus = 'approved';
        node_assert_1.default.strictEqual(client.whitelistStatus, 'approved');
    });
    (0, node_test_1.it)('returns pending after auth with status field', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client._whitelistStatus = 'pending';
        node_assert_1.default.strictEqual(client.whitelistStatus, 'pending');
    });
    (0, node_test_1.it)('returns rejected after auth with status field', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client._whitelistStatus = 'rejected';
        node_assert_1.default.strictEqual(client.whitelistStatus, 'rejected');
    });
});
(0, node_test_1.describe)('HumanEnvClient auth handling', () => {
    (0, node_test_1.it)('sets whitelistStatus from payload.status field', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws, { connected: true, authenticated: false });
        client.handleMessage({
            type: 'auth_response',
            payload: { success: true, status: 'pending' }
        });
        node_assert_1.default.strictEqual(client.authenticated, true);
        node_assert_1.default.strictEqual(client.whitelistStatus, 'pending');
    });
    (0, node_test_1.it)('falls back to whitelisted boolean when status absent', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws, { connected: true, authenticated: false });
        client.handleMessage({
            type: 'auth_response',
            payload: { success: true, whitelisted: true }
        });
        node_assert_1.default.strictEqual(client.whitelistStatus, 'approved');
    });
    (0, node_test_1.it)('sets pending when whitelisted is false and no status', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws, { connected: true, authenticated: false });
        client.handleMessage({
            type: 'auth_response',
            payload: { success: true, whitelisted: false }
        });
        node_assert_1.default.strictEqual(client.whitelistStatus, 'pending');
    });
    (0, node_test_1.it)('sends auth payload with fingerprint on open', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        client.ws = ws;
        const resolve = () => { };
        const reject = () => { };
        client.sendAuth(resolve, reject);
        const msg = ws.lastSent();
        node_assert_1.default.strictEqual(msg.type, 'auth');
        node_assert_1.default.strictEqual(msg.payload.projectName, 'test-project');
        node_assert_1.default.strictEqual(msg.payload.apiKey, 'test-key');
        node_assert_1.default.strictEqual(typeof msg.payload.fingerprint, 'string');
        node_assert_1.default.ok(msg.payload.fingerprint.length > 0);
    });
    (0, node_test_1.it)('clears auth callbacks after successful auth', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, new ws_test_helpers_ts_1.MockWebSocket(), { connected: true, authenticated: false });
        client._authResolve = () => { };
        client._authReject = () => { };
        client.handleMessage({
            type: 'auth_response',
            payload: { success: true, whitelisted: true }
        });
        node_assert_1.default.strictEqual(client._authResolve, null);
        node_assert_1.default.strictEqual(client._authReject, null);
    });
    (0, node_test_1.it)('clears auth callbacks after failed auth', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, new ws_test_helpers_ts_1.MockWebSocket(), { connected: true, authenticated: false });
        client._authResolve = () => { };
        client._authReject = () => { };
        client.handleMessage({
            type: 'auth_response',
            payload: { success: false, error: 'bad', code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY }
        });
        node_assert_1.default.strictEqual(client._authResolve, null);
        node_assert_1.default.strictEqual(client._authReject, null);
    });
});
(0, node_test_1.describe)('HumanEnvClient get()', () => {
    (0, node_test_1.it)('throws when not connected', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.connected = false;
        client.authenticated = true;
        await node_assert_1.default.rejects(() => client.get('KEY'), (err) => err instanceof Error && err.code === humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
    });
    (0, node_test_1.it)('throws when not authenticated', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.connected = true;
        client.authenticated = false;
        await node_assert_1.default.rejects(() => client.get('KEY'), (err) => err instanceof Error && err.code === humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
    });
    (0, node_test_1.it)('sends get message with correct key', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws);
        const p = client.get('MY_SECRET');
        const msg = ws.lastSent();
        node_assert_1.default.strictEqual(msg.type, 'get');
        node_assert_1.default.strictEqual(msg.payload.key, 'MY_SECRET');
        client.handleMessage({
            type: 'get_response',
            payload: { key: 'MY_SECRET', value: 'val' }
        });
        const val = await p;
        node_assert_1.default.strictEqual(val, 'val');
    });
    (0, node_test_1.it)('get() with array calls _getSingle for each key', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws);
        const p = client.get(['A', 'B']);
        // Two get messages should have been sent
        const msgs = ws.sentMessages.map(s => JSON.parse(s));
        node_assert_1.default.strictEqual(msgs.length, 2);
        const keys = msgs.map((m) => m.payload.key).sort();
        node_assert_1.default.deepStrictEqual(keys, ['A', 'B']);
        client.handleMessage({ type: 'get_response', payload: { key: 'A', value: 'va' } });
        client.handleMessage({ type: 'get_response', payload: { key: 'B', value: 'vb' } });
        const result = await p;
        node_assert_1.default.deepStrictEqual(result, { A: 'va', B: 'vb' });
    });
    (0, node_test_1.it)('get() with array throws when not authenticated', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.connected = false;
        await node_assert_1.default.rejects(() => client.get(['A', 'B']), (err) => err instanceof Error && err.code === humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
    });
});
(0, node_test_1.describe)('HumanEnvClient set()', () => {
    (0, node_test_1.it)('throws when not connected', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.connected = false;
        client.authenticated = true;
        await node_assert_1.default.rejects(() => client.set('KEY', 'val'), (err) => err instanceof Error && err.code === humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
    });
    (0, node_test_1.it)('throws when not authenticated', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.connected = true;
        client.authenticated = false;
        await node_assert_1.default.rejects(() => client.set('KEY', 'val'), (err) => err instanceof Error && err.code === humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
    });
    (0, node_test_1.it)('sends set message with key and value', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws);
        const p = client.set('DB_PASS', 'secret123');
        const msg = ws.lastSent();
        node_assert_1.default.strictEqual(msg.type, 'set');
        node_assert_1.default.strictEqual(msg.payload.key, 'DB_PASS');
        node_assert_1.default.strictEqual(msg.payload.value, 'secret123');
        client.handleMessage({ type: 'set_response', payload: { success: true } });
        await p;
    });
});
(0, node_test_1.describe)('HumanEnvClient ping', () => {
    (0, node_test_1.it)('startPing sends ping messages on interval', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        client.ws = ws;
        client.startPing();
        node_assert_1.default.ok(client.pingTimer !== null);
        client.stopPing();
        node_assert_1.default.strictEqual(client.pingTimer, null);
    });
    (0, node_test_1.it)('stopPing clears the ping timer', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.pingTimer = setInterval(() => { }, 100000);
        client.stopPing();
        node_assert_1.default.strictEqual(client.pingTimer, null);
    });
    (0, node_test_1.it)('stopPing is safe to call when no timer exists', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.pingTimer = null;
        client.stopPing(); // should not throw
        node_assert_1.default.strictEqual(client.pingTimer, null);
    });
});
(0, node_test_1.describe)('HumanEnvClient connectAndWaitForAuth', () => {
    (0, node_test_1.it)('resolves immediately if already connected and authenticated', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.connected = true;
        client.authenticated = true;
        await client.connectAndWaitForAuth(5000);
        // Should resolve without delay
    });
    (0, node_test_1.it)('resolves on timeout when auth never completes', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.connected = true;
        client.authenticated = false;
        // Use a very short timeout
        await client.connectAndWaitForAuth(50);
        // Should resolve silently even though not authenticated
        node_assert_1.default.strictEqual(client.authenticated, false);
    });
});
(0, node_test_1.describe)('HumanEnvClient disconnect', () => {
    (0, node_test_1.it)('sets disconnecting flag to true', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        client.ws = ws;
        client.connected = true;
        client.disconnect();
        node_assert_1.default.strictEqual(client.disconnecting, true);
    });
    (0, node_test_1.it)('clears reconnecting flag', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        client.ws = ws;
        client.reconnecting = true;
        client.disconnect();
        node_assert_1.default.strictEqual(client.reconnecting, false);
    });
    (0, node_test_1.it)('closes the WebSocket', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        client.ws = ws;
        client.disconnect();
        node_assert_1.default.strictEqual(ws.closed, true);
    });
    (0, node_test_1.it)('clears retry timer', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        client.ws = ws;
        client.retryTimer = setTimeout(() => { }, 100000);
        client.disconnect();
        node_assert_1.default.strictEqual(client.retryTimer, null);
    });
    (0, node_test_1.it)('clears ping timer', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        client.ws = ws;
        client.pingTimer = setInterval(() => { }, 100000);
        client.disconnect();
        node_assert_1.default.strictEqual(client.pingTimer, null);
    });
});
(0, node_test_1.describe)('HumanEnvClient malformed messages', () => {
    (0, node_test_1.it)('ignores unknown message types', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws);
        client.handleMessage({ type: 'unknown_type', payload: {} });
    });
    (0, node_test_1.it)('ignores messages with no type', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws);
        client.handleMessage({ payload: {} });
    });
    (0, node_test_1.it)('ignores pong messages without side effects', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws);
        const pendingBefore = client.pending.size;
        client.handleMessage({ type: 'pong' });
        node_assert_1.default.strictEqual(client.pending.size, pendingBefore);
    });
});
(0, node_test_1.describe)('HumanEnvClient _resolvePending', () => {
    (0, node_test_1.it)('resolves the first pending op and removes it', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws);
        const p = client.get('X');
        node_assert_1.default.strictEqual(client.pending.size, 1);
        client.handleMessage({ type: 'get_response', payload: { key: 'X', value: 'hello' } });
        const val = await p;
        node_assert_1.default.strictEqual(val, 'hello');
        node_assert_1.default.strictEqual(client.pending.size, 0);
    });
    (0, node_test_1.it)('rejects pending op when payload has error', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        const ws = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, ws);
        const p = client.get('MISSING');
        client.handleMessage({
            type: 'get_response',
            payload: { error: 'Not found', code: humanenv_shared_1.ErrorCode.SERVER_INTERNAL_ERROR }
        });
        await node_assert_1.default.rejects(() => p, (err) => err instanceof Error && err.code === humanenv_shared_1.ErrorCode.SERVER_INTERNAL_ERROR);
    });
    (0, node_test_1.it)('is a no-op when no pending operations exist', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client._resolvePending('get', { key: 'X', value: 'v' });
    });
});
//# sourceMappingURL=ws-manager-lifecycle.test.js.map