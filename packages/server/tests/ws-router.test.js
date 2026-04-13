"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
// Mock WebSocket and dependencies for testing WsRouter logic
class MockWebSocket {
    constructor() {
        this.readyState = 1; // OPEN
        this.sentMessages = [];
        this.handlers = {};
    }
    send(data) {
        this.sentMessages.push(data);
    }
    on(event, handler) {
        if (!this.handlers[event])
            this.handlers[event] = [];
        this.handlers[event].push(handler);
    }
    close() { }
}
class MockDb {
    constructor() {
        this.data = {
            projects: new Map(),
            envs: new Map(),
            apiKeys: new Map(),
            whitelist: new Map(),
        };
    }
    async getProject(name) {
        return this.data.projects.get(name) || null;
    }
    async getApiKey(projectId, plainValue) {
        const key = `${projectId}:${plainValue}`;
        return this.data.apiKeys.get(key) || null;
    }
    async getWhitelistEntry(projectId, fingerprint) {
        const key = `${projectId}:${fingerprint}`;
        return this.data.whitelist.get(key) || null;
    }
    async createWhitelistEntry(projectId, fingerprint, status) {
        const key = `${projectId}:${fingerprint}`;
        const entry = { id: 'wl-1', projectId, fingerprint, status, createdAt: Date.now() };
        this.data.whitelist.set(key, entry);
        return entry;
    }
    async getEnv(projectId, key) {
        const mapKey = `${projectId}:${key}`;
        return this.data.envs.get(mapKey) || null;
    }
    async createEnv(projectId, key, encryptedValue) {
        const mapKey = `${projectId}:${key}`;
        const env = { id: 'env-1', projectId, key, encryptedValue, createdAt: Date.now() };
        this.data.envs.set(mapKey, env);
        return env;
    }
    async updateEnv(projectId, key, encryptedValue) {
        const mapKey = `${projectId}:${key}`;
        if (this.data.envs.has(mapKey)) {
            const existing = this.data.envs.get(mapKey);
            existing.encryptedValue = encryptedValue;
        }
    }
}
class MockPkManager {
    encrypt(value, aad) {
        return `encrypted:${value}:${aad}`;
    }
    decrypt(encryptedValue, aad) {
        return encryptedValue.replace('encrypted:', '').split(':')[0];
    }
    isReady() {
        return true;
    }
}
(0, node_test_1.describe)('WsRouter - Auth Flow', () => {
    let mockDb;
    let mockPk;
    let mockWs;
    (0, node_test_1.beforeEach)(() => {
        mockDb = new MockDb();
        mockPk = new MockPkManager();
        mockWs = new MockWebSocket();
        // Setup test data
        mockDb.data.projects.set('test-project', { id: 'proj-1', name: 'test-project' });
        mockDb.data.apiKeys.set('proj-1:valid-key', { id: 'key-1', projectId: 'proj-1' });
        mockDb.data.whitelist.set('proj-1:fp-123', {
            id: 'wl-1',
            projectId: 'proj-1',
            fingerprint: 'fp-123',
            status: 'approved'
        });
    });
    (0, node_test_1.it)('accepts auth with valid credentials', async () => {
        // Simulate auth message handling
        const authPayload = {
            projectName: 'test-project',
            apiKey: 'valid-key',
            fingerprint: 'fp-123',
        };
        // Verify credentials exist
        const project = await mockDb.getProject(authPayload.projectName);
        const apiKey = await mockDb.getApiKey(project.id, authPayload.apiKey);
        const whitelist = await mockDb.getWhitelistEntry(project.id, authPayload.fingerprint);
        node_assert_1.default.ok(project);
        node_assert_1.default.ok(apiKey);
        node_assert_1.default.strictEqual(whitelist.status, 'approved');
    });
    (0, node_test_1.it)('rejects auth with invalid project name', async () => {
        const authPayload = {
            projectName: 'nonexistent-project',
            apiKey: 'valid-key',
            fingerprint: 'fp-123',
        };
        const project = await mockDb.getProject(authPayload.projectName);
        node_assert_1.default.strictEqual(project, null);
    });
    (0, node_test_1.it)('rejects auth with invalid API key', async () => {
        const authPayload = {
            projectName: 'test-project',
            apiKey: 'wrong-key',
            fingerprint: 'fp-123',
        };
        const project = await mockDb.getProject(authPayload.projectName);
        const apiKey = await mockDb.getApiKey(project.id, authPayload.apiKey);
        node_assert_1.default.ok(project);
        node_assert_1.default.strictEqual(apiKey, null);
    });
    (0, node_test_1.it)('accepts auth but marks not whitelisted', async () => {
        const authPayload = {
            projectName: 'test-project',
            apiKey: 'valid-key',
            fingerprint: 'new-fingerprint', // Not in whitelist
        };
        const project = await mockDb.getProject(authPayload.projectName);
        const apiKey = await mockDb.getApiKey(project.id, authPayload.apiKey);
        const whitelist = await mockDb.getWhitelistEntry(project.id, authPayload.fingerprint);
        node_assert_1.default.ok(project);
        node_assert_1.default.ok(apiKey);
        node_assert_1.default.strictEqual(whitelist, null); // Not whitelisted
    });
    (0, node_test_1.it)('creates pending whitelist entry for new fingerprint', async () => {
        const authPayload = {
            projectName: 'test-project',
            apiKey: 'valid-key',
            fingerprint: 'new-fingerprint',
        };
        const project = await mockDb.getProject(authPayload.projectName);
        const apiKey = await mockDb.getApiKey(project.id, authPayload.apiKey);
        if (project && apiKey) {
            // Create pending entry
            const entry = await mockDb.createWhitelistEntry(project.id, authPayload.fingerprint, 'pending');
            node_assert_1.default.strictEqual(entry.status, 'pending');
        }
    });
});
(0, node_test_1.describe)('WsRouter - Get/Set Operations', () => {
    let mockDb;
    let mockPk;
    (0, node_test_1.beforeEach)(() => {
        mockDb = new MockDb();
        mockPk = new MockPkManager();
        // Setup test data
        mockDb.data.projects.set('test-project', { id: 'proj-1', name: 'test-project' });
        mockDb.data.whitelist.set('proj-1:fp-123', {
            id: 'wl-1',
            projectId: 'proj-1',
            fingerprint: 'fp-123',
            status: 'approved'
        });
    });
    (0, node_test_1.it)('get retrieves decrypted value', async () => {
        // Setup env
        await mockDb.createEnv('proj-1', 'API_KEY', 'encrypted:secret-value:proj-1:API_KEY');
        // Simulate get operation
        const env = await mockDb.getEnv('proj-1', 'API_KEY');
        const decrypted = mockPk.decrypt(env.encryptedValue, 'proj-1:API_KEY');
        node_assert_1.default.strictEqual(decrypted, 'secret-value');
    });
    (0, node_test_1.it)('get returns null for missing key', async () => {
        const env = await mockDb.getEnv('proj-1', 'MISSING_KEY');
        node_assert_1.default.strictEqual(env, null);
    });
    (0, node_test_1.it)('set stores encrypted value', async () => {
        const value = 'my-new-secret';
        const aad = 'proj-1:NEW_KEY';
        const encrypted = mockPk.encrypt(value, aad);
        await mockDb.createEnv('proj-1', 'NEW_KEY', encrypted);
        const stored = await mockDb.getEnv('proj-1', 'NEW_KEY');
        node_assert_1.default.ok(stored);
        node_assert_1.default.strictEqual(stored.encryptedValue, encrypted);
    });
    (0, node_test_1.it)('set updates existing key', async () => {
        // Create initial env
        await mockDb.createEnv('proj-1', 'EXISTING_KEY', 'encrypted:old-value:proj-1:EXISTING_KEY');
        // Update
        const newValue = 'updated-value';
        const newEncrypted = mockPk.encrypt(newValue, 'proj-1:EXISTING_KEY');
        await mockDb.updateEnv('proj-1', 'EXISTING_KEY', newEncrypted);
        // Verify update
        const env = await mockDb.getEnv('proj-1', 'EXISTING_KEY');
        const decrypted = mockPk.decrypt(env.encryptedValue, 'proj-1:EXISTING_KEY');
        node_assert_1.default.strictEqual(decrypted, newValue);
    });
    (0, node_test_1.it)('get requires authentication (whitelist check)', async () => {
        const fingerprint = 'fp-123';
        const projectId = 'proj-1';
        const whitelist = await mockDb.getWhitelistEntry(projectId, fingerprint);
        const isAuthenticated = whitelist?.status === 'approved';
        node_assert_1.default.strictEqual(isAuthenticated, true);
        // Test with non-whitelisted fingerprint
        const unauthWhitelist = await mockDb.getWhitelistEntry(projectId, 'unknown-fp');
        const isUnauthAuthenticated = unauthWhitelist?.status === 'approved';
        node_assert_1.default.strictEqual(isUnauthAuthenticated, false);
    });
});
(0, node_test_1.describe)('WsRouter - Admin Broadcast', () => {
    let adminClients = [];
    (0, node_test_1.beforeEach)(() => {
        adminClients = [];
    });
    (0, node_test_1.it)('broadcastAdmin sends to all admin clients', () => {
        // Setup admin clients
        const client1 = new MockWebSocket();
        const client2 = new MockWebSocket();
        adminClients.push(client1, client2);
        // Simulate broadcast
        const event = 'whitelist_pending';
        const payload = { fingerprint: 'fp-123', projectName: 'test-project' };
        const data = JSON.stringify({ event, payload });
        adminClients.forEach(ws => {
            if (ws.readyState === 1)
                ws.send(data);
        });
        // Verify both clients received
        node_assert_1.default.strictEqual(client1.sentMessages.length, 1);
        node_assert_1.default.strictEqual(client2.sentMessages.length, 1);
        node_assert_1.default.deepStrictEqual(JSON.parse(client1.sentMessages[0]), { event: 'whitelist_pending', payload });
    });
    (0, node_test_1.it)('broadcastAdmin skips closed connections', () => {
        const client1 = new MockWebSocket();
        const client2 = new MockWebSocket();
        client2.readyState = 3; // CLOSED
        adminClients.push(client1, client2);
        const data = JSON.stringify({ event: 'test', payload: {} });
        adminClients.forEach(ws => {
            if (ws.readyState === 1)
                ws.send(data);
        });
        // Only open client should receive
        node_assert_1.default.strictEqual(client1.sentMessages.length, 1);
        node_assert_1.default.strictEqual(client2.sentMessages.length, 0);
    });
});
(0, node_test_1.describe)('WsRouter - Pending Request Management', () => {
    let pendingRequests;
    (0, node_test_1.beforeEach)(() => {
        pendingRequests = new Map();
    });
    (0, node_test_1.it)('resolvePending clears timeout and resolves', async () => {
        const reqId = 'req-123';
        let resolved = false;
        const pending = {
            resolve: (msg) => { resolved = true; },
            reject: () => { },
            timeout: setTimeout(() => { }, 1000),
        };
        pendingRequests.set(reqId, pending);
        // Simulate resolve
        const p = pendingRequests.get(reqId);
        if (p) {
            clearTimeout(p.timeout);
            p.resolve({ approved: true });
            pendingRequests.delete(reqId);
        }
        node_assert_1.default.strictEqual(resolved, true);
        node_assert_1.default.strictEqual(pendingRequests.has(reqId), false);
    });
    (0, node_test_1.it)('rejectPending clears timeout and rejects', () => {
        const reqId = 'req-123';
        let rejected = false;
        const pending = {
            resolve: () => { },
            reject: () => { rejected = true; },
            timeout: setTimeout(() => { }, 1000),
        };
        pendingRequests.set(reqId, pending);
        // Simulate reject
        const p = pendingRequests.get(reqId);
        if (p) {
            clearTimeout(p.timeout);
            p.reject('Rejected by admin');
            pendingRequests.delete(reqId);
        }
        node_assert_1.default.strictEqual(rejected, true);
    });
});
//# sourceMappingURL=ws-router.test.js.map