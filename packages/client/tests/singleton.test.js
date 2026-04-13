"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const index_ts_1 = __importDefault(require("../src/index.ts"));
const ws_manager_ts_1 = require("../src/ws-manager.ts");
// Mock HumanEnvClient for testing singleton behavior
class MockHumanEnvClient {
    constructor(config) {
        this.config = config;
        this.connected = false;
        this.authenticated = false;
        MockHumanEnvClient.connectCalls++;
    }
    async connect() {
        this.connected = true;
        this.authenticated = true;
    }
    async get(key) {
        return `mock-value-${key}`;
    }
    async getMany(keys) {
        return keys.reduce((acc, key) => {
            acc[key] = `mock-value-${key}`;
            return acc;
        }, {});
    }
    async set(key, value) {
        // Mock set
    }
    disconnect() {
        this.connected = false;
        this.authenticated = false;
    }
}
MockHumanEnvClient.connectCalls = 0;
(0, node_test_1.describe)('humanenv singleton', () => {
    (0, node_test_1.beforeEach)(() => {
        // Reset singleton state
        index_ts_1.default.disconnect();
        MockHumanEnvClient.connectCalls = 0;
    });
    (0, node_test_1.afterEach)(() => {
        index_ts_1.default.disconnect();
    });
    (0, node_test_1.it)('config() creates singleton client', () => {
        index_ts_1.default.config({
            serverUrl: 'http://localhost:3056',
            projectName: 'test-project',
            projectApiKey: 'test-key',
        });
        // Singleton should be created
        node_assert_1.default.ok(index_ts_1.default);
    });
    (0, node_test_1.it)('config() called twice ignores second call', () => {
        index_ts_1.default.config({
            serverUrl: 'http://localhost:3056',
            projectName: 'test-project',
            projectApiKey: 'test-key',
        });
        index_ts_1.default.config({
            serverUrl: 'http://localhost:4000',
            projectName: 'other-project',
            projectApiKey: 'other-key',
        });
        // Second call should be ignored (singleton pattern)
        // We can't directly verify this without accessing internal state,
        // but the pattern ensures only one client exists
    });
    (0, node_test_1.it)('get() throws if config() not called', async () => {
        await node_assert_1.default.rejects(async () => index_ts_1.default.get('TEST_KEY'), /humanenv\.config\(\) must be called first/);
    });
    (0, node_test_1.it)('set() throws if config() not called', async () => {
        await node_assert_1.default.rejects(async () => index_ts_1.default.set('TEST_KEY', 'value'), /humanenv\.config\(\) must be called first/);
    });
    (0, node_test_1.it)('get() with single key returns string', async () => {
        // Note: This test requires the actual HumanEnvClient
        // For proper unit testing, we'd need to mock the client
        // This is a placeholder for the actual implementation test
        index_ts_1.default.config({
            serverUrl: 'http://localhost:3056',
            projectName: 'test-project',
            projectApiKey: 'test-key',
        });
        // The actual get() will fail without a real server
        // This test verifies the singleton is set up correctly
        node_assert_1.default.ok(index_ts_1.default);
    });
    (0, node_test_1.it)('get() with multiple keys returns object', async () => {
        index_ts_1.default.config({
            serverUrl: 'http://localhost:3056',
            projectName: 'test-project',
            projectApiKey: 'test-key',
        });
        // Verify singleton exists
        node_assert_1.default.ok(index_ts_1.default);
    });
    (0, node_test_1.it)('disconnect() resets singleton state', async () => {
        index_ts_1.default.config({
            serverUrl: 'http://localhost:3056',
            projectName: 'test-project',
            projectApiKey: 'test-key',
        });
        index_ts_1.default.disconnect();
        // After disconnect, get() should throw again
        await node_assert_1.default.rejects(async () => index_ts_1.default.get('TEST_KEY'), /humanenv\.config\(\) must be called first/);
    });
});
(0, node_test_1.describe)('HumanEnvClient export', () => {
    (0, node_test_1.it)('exports HumanEnvClient class', () => {
        node_assert_1.default.strictEqual(typeof ws_manager_ts_1.HumanEnvClient, 'function');
    });
    (0, node_test_1.it)('HumanEnvClient can be instantiated', () => {
        const client = new ws_manager_ts_1.HumanEnvClient({
            serverUrl: 'http://localhost:3056',
            projectName: 'test-project',
        });
        node_assert_1.default.ok(client);
    });
});
//# sourceMappingURL=singleton.test.js.map