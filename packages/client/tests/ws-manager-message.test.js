"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const humanenv_shared_1 = require("humanenv-shared");
const ws_test_helpers_ts_1 = require("./ws-test-helpers.ts");
(0, node_test_1.describe)('HumanEnvClient handleMessage', () => {
    let mockWs;
    let client;
    (0, node_test_1.beforeEach)(() => {
        mockWs = new ws_test_helpers_ts_1.MockWebSocket();
        client = (0, ws_test_helpers_ts_1.makeClient)();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, mockWs);
        // Wire up message handler (normally done by doConnect)
        mockWs.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                client.handleMessage(msg);
            }
            catch { /* ignore malformed */ }
        });
    });
    (0, node_test_1.it)('handles successful auth_response', async () => {
        const authPromise = new Promise((resolve, reject) => {
            ;
            client._authResolve = resolve;
            client._authReject = reject;
        });
        mockWs.trigger('message', Buffer.from(JSON.stringify({
            type: 'auth_response',
            payload: { success: true, whitelisted: true }
        })));
        await authPromise;
        node_assert_1.default.strictEqual(client.authenticated, true);
    });
    (0, node_test_1.it)('handles failed auth_response', async () => {
        const authPromise = new Promise((resolve, reject) => {
            ;
            client._authResolve = resolve;
            client._authReject = reject;
        });
        mockWs.trigger('message', Buffer.from(JSON.stringify({
            type: 'auth_response',
            payload: {
                success: false,
                error: 'Invalid API key',
                code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY
            }
        })));
        try {
            await authPromise;
            node_assert_1.default.fail('Should have thrown');
        }
        catch (err) {
            node_assert_1.default.ok(err instanceof Error);
            node_assert_1.default.strictEqual(err.code, humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
        }
    });
    (0, node_test_1.it)('handles get_response with value', async () => {
        const getPromise = client.get('TEST_KEY');
        mockWs.trigger('message', Buffer.from(JSON.stringify({
            type: 'get_response',
            payload: { key: 'TEST_KEY', value: 'test-value' }
        })));
        const value = await getPromise;
        node_assert_1.default.strictEqual(value, 'test-value');
    });
    (0, node_test_1.it)('handles get_response with error', async () => {
        const getPromise = client.get('MISSING_KEY');
        mockWs.trigger('message', Buffer.from(JSON.stringify({
            type: 'get_response',
            payload: {
                error: 'Key not found',
                code: humanenv_shared_1.ErrorCode.SERVER_INTERNAL_ERROR
            }
        })));
        try {
            await getPromise;
            node_assert_1.default.fail('Should have thrown');
        }
        catch (err) {
            node_assert_1.default.ok(err instanceof Error);
            node_assert_1.default.ok(err.message.includes('Key not found'));
        }
    });
    (0, node_test_1.it)('handles set_response success', async () => {
        const setPromise = client.set('TEST_KEY', 'test-value');
        mockWs.trigger('message', Buffer.from(JSON.stringify({
            type: 'set_response',
            payload: { success: true }
        })));
        await setPromise;
    });
    (0, node_test_1.it)('handles set_response with error', async () => {
        const setPromise = client.set('TEST_KEY', 'test-value');
        mockWs.trigger('message', Buffer.from(JSON.stringify({
            type: 'set_response',
            payload: {
                error: 'Not authenticated',
                code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY
            }
        })));
        try {
            await setPromise;
            node_assert_1.default.fail('Should have thrown');
        }
        catch (err) {
            node_assert_1.default.ok(err instanceof Error);
            node_assert_1.default.ok(err.message.includes('Not authenticated'));
        }
    });
    (0, node_test_1.it)('ignores pong messages', () => {
        mockWs.trigger('message', Buffer.from(JSON.stringify({
            type: 'pong'
        })));
    });
});
//# sourceMappingURL=ws-manager-message.test.js.map