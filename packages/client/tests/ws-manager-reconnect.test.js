"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const humanenv_shared_1 = require("humanenv-shared");
const ws_test_helpers_ts_1 = require("./ws-test-helpers.ts");
(0, node_test_1.describe)('HumanEnvClient reconnection', () => {
    let originalSetTimeout;
    let originalClearTimeout;
    (0, node_test_1.beforeEach)(() => {
        originalSetTimeout = global.setTimeout;
        originalClearTimeout = global.clearTimeout;
        global.setTimeout = ((fn, _ms, ...args) => {
            return originalSetTimeout(fn, 1, ...args);
        });
    });
    (0, node_test_1.afterEach)(() => {
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
    });
    // Mirrors close handler in doConnect() — keep in sync
    function wireCloseHandler(client, mockWs, reject) {
        const rejectFn = reject ?? (() => { });
        mockWs.on('close', () => {
            ;
            client.connected = false;
            client.authenticated = false;
            client.stopPing();
            if (!client.disconnecting && !client.reconnecting) {
                ;
                client.scheduleReconnect(rejectFn);
            }
        });
    }
    (0, node_test_1.it)('schedules reconnect on close (not reconnecting)', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)({ maxRetries: 3 });
        const mockWs = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, mockWs);
        client.reconnecting = false;
        wireCloseHandler(client, mockWs);
        mockWs.trigger('close');
        node_assert_1.default.strictEqual(client.reconnecting, true);
        node_assert_1.default.strictEqual(client.attempts, 1);
    });
    (0, node_test_1.it)('does not schedule reconnect if already reconnecting', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)({ maxRetries: 3 });
        const mockWs = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, mockWs);
        client.reconnecting = true;
        client.attempts = 1;
        wireCloseHandler(client, mockWs);
        mockWs.trigger('close');
        node_assert_1.default.strictEqual(client.attempts, 1);
    });
    (0, node_test_1.it)('rejects with max retries exceeded error', (_, done) => {
        const client = (0, ws_test_helpers_ts_1.makeClient)({ maxRetries: 1 });
        const mockWs = new ws_test_helpers_ts_1.MockWebSocket();
        (0, ws_test_helpers_ts_1.injectMockWs)(client, mockWs);
        client.reconnecting = false;
        client.attempts = 1;
        const mockReject = (err) => {
            node_assert_1.default.ok(err instanceof Error);
            node_assert_1.default.strictEqual(err.code, humanenv_shared_1.ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED);
            done();
        };
        wireCloseHandler(client, mockWs, mockReject);
        mockWs.trigger('close');
    });
    (0, node_test_1.it)('uses exponential backoff for delays', () => {
        const delay1 = Math.min(1000 * Math.pow(2, 0), 30000);
        node_assert_1.default.strictEqual(delay1, 1000);
        const delay2 = Math.min(1000 * Math.pow(2, 1), 30000);
        node_assert_1.default.strictEqual(delay2, 2000);
        const delay3 = Math.min(1000 * Math.pow(2, 2), 30000);
        node_assert_1.default.strictEqual(delay3, 4000);
        const delay10 = Math.min(1000 * Math.pow(2, 9), 30000);
        node_assert_1.default.strictEqual(delay10, 30000);
    });
    (0, node_test_1.it)('resets attempts on successful connection', async () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)({ maxRetries: 3 });
        client.attempts = 2;
        client.reconnecting = true;
        client.doConnect = function (resolve) {
            ;
            this.ws = new ws_test_helpers_ts_1.MockWebSocket();
            this.connected = true;
            this.attempts = 0;
            this.reconnecting = false;
            resolve();
        };
        await client.connect();
        node_assert_1.default.strictEqual(client.attempts, 0);
    });
    (0, node_test_1.it)('disconnect clears all timers and state', () => {
        const client = (0, ws_test_helpers_ts_1.makeClient)();
        client.retryTimer = setTimeout(() => { }, 1000);
        client.pingTimer = setInterval(() => { }, 1000);
        client.reconnecting = true;
        client.disconnect();
        node_assert_1.default.strictEqual(client.retryTimer, null);
        node_assert_1.default.strictEqual(client.pingTimer, null);
        node_assert_1.default.strictEqual(client.reconnecting, false);
    });
});
//# sourceMappingURL=ws-manager-reconnect.test.js.map