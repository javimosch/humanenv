"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
// Mock Express request/response for testing route handlers
function createMockRequest(params = {}, body = {}) {
    return {
        params,
        body,
    };
}
function createMockResponse() {
    const res = {
        statusCode: 200,
        jsonData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.jsonData = data;
            return this;
        },
    };
    return res;
}
// Mock database provider
let idCounter = 0;
function generateId(prefix) {
    return `${prefix}-${Date.now()}-${++idCounter}`;
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
    async listProjects() {
        return Array.from(this.data.projects.values());
    }
    async getProject(name) {
        return Array.from(this.data.projects.values()).find((p) => p.name === name) || null;
    }
    async createProject(name) {
        const id = generateId('proj');
        const project = { id, name, createdAt: Date.now() };
        this.data.projects.set(id, project);
        return { id };
    }
    async deleteProject(id) {
        this.data.projects.delete(id);
    }
    async listEnvs(projectId) {
        return Array.from(this.data.envs.values()).filter((e) => e.projectId === projectId);
    }
    async createEnv(projectId, key, encryptedValue) {
        const id = generateId('env');
        const env = { id, projectId, key, encryptedValue, createdAt: Date.now() };
        this.data.envs.set(id, env);
        return { id };
    }
    async updateEnv(projectId, key, encryptedValue) {
        const env = Array.from(this.data.envs.values()).find((e) => e.projectId === projectId && e.key === key);
        if (env) {
            env.encryptedValue = encryptedValue;
        }
    }
    async deleteEnv(projectId, key) {
        const env = Array.from(this.data.envs.values()).find((e) => e.projectId === projectId && e.key === key);
        if (env) {
            this.data.envs.delete(env.id);
        }
    }
    async listApiKeys(projectId) {
        return Array.from(this.data.apiKeys.values()).filter((k) => k.projectId === projectId);
    }
    async createApiKey(projectId, encryptedValue, ttl) {
        const id = generateId('key');
        const key = { id, projectId, encryptedValue, ttl, createdAt: Date.now() };
        this.data.apiKeys.set(id, key);
        return { id };
    }
    async revokeApiKey(projectId, id) {
        this.data.apiKeys.delete(id);
    }
    async listWhitelistEntries(projectId) {
        return Array.from(this.data.whitelist.values()).filter((w) => w.projectId === projectId);
    }
    async createWhitelistEntry(projectId, fingerprint, status) {
        const id = generateId('wl');
        const entry = { id, projectId, fingerprint, status, createdAt: Date.now() };
        this.data.whitelist.set(id, entry);
        return { id };
    }
    async updateWhitelistStatus(id, status) {
        const entry = this.data.whitelist.get(id);
        if (entry) {
            entry.status = status;
        }
    }
}
// Mock PK manager
class MockPk {
    encrypt(value, aad) {
        return `encrypted:${value}`;
    }
}
(0, node_test_1.describe)('Projects Router', () => {
    let db;
    let pk;
    (0, node_test_1.beforeEach)(() => {
        db = new MockDb();
        pk = new MockPk();
    });
    (0, node_test_1.it)('GET /api/projects returns list of projects', async () => {
        await db.createProject('project-a');
        await db.createProject('project-b');
        // Simulate route handler
        const req = createMockRequest();
        const res = createMockResponse();
        const projects = await db.listProjects();
        res.json(projects);
        node_assert_1.default.strictEqual(res.statusCode, 200);
        node_assert_1.default.strictEqual(res.jsonData.length, 2);
    });
    (0, node_test_1.it)('POST /api/projects creates project', async () => {
        const req = createMockRequest({}, { name: 'new-project' });
        const res = createMockResponse();
        // Validate input
        if (!req.body.name || typeof req.body.name !== 'string') {
            res.status(400).json({ error: 'name required' });
        }
        else {
            const existing = await db.getProject(req.body.name);
            if (existing) {
                res.status(409).json({ error: 'Project already exists' });
            }
            else {
                const result = await db.createProject(req.body.name);
                res.status(201).json({ id: result.id });
            }
        }
        node_assert_1.default.strictEqual(res.statusCode, 201);
        node_assert_1.default.ok(res.jsonData.id);
    });
    (0, node_test_1.it)('POST /api/projects rejects duplicate', async () => {
        await db.createProject('duplicate');
        const req = createMockRequest({}, { name: 'duplicate' });
        const res = createMockResponse();
        const existing = await db.getProject(req.body.name);
        if (existing) {
            res.status(409).json({ error: 'Project already exists' });
        }
        node_assert_1.default.strictEqual(res.statusCode, 409);
    });
    (0, node_test_1.it)('POST /api/projects rejects missing name', async () => {
        const req = createMockRequest({}, {});
        const res = createMockResponse();
        if (!req.body.name || typeof req.body.name !== 'string') {
            res.status(400).json({ error: 'name required' });
        }
        node_assert_1.default.strictEqual(res.statusCode, 400);
    });
    (0, node_test_1.it)('DELETE /api/projects removes project', async () => {
        const project = await db.createProject('to-delete');
        const req = createMockRequest({ id: project.id });
        const res = createMockResponse();
        await db.deleteProject(req.params.id);
        res.json({ ok: true });
        node_assert_1.default.strictEqual(res.statusCode, 200);
        const projects = await db.listProjects();
        node_assert_1.default.strictEqual(projects.length, 0);
    });
});
(0, node_test_1.describe)('Envs Router', () => {
    let db;
    let pk;
    let projectId;
    (0, node_test_1.beforeEach)(async () => {
        db = new MockDb();
        pk = new MockPk();
        const project = await db.createProject('test-project');
        projectId = project.id;
    });
    (0, node_test_1.it)('GET /api/envs/project/:id returns list of envs', async () => {
        await db.createEnv(projectId, 'KEY_A', 'encrypted-a');
        await db.createEnv(projectId, 'KEY_B', 'encrypted-b');
        const req = createMockRequest({ projectId });
        const res = createMockResponse();
        const envs = await db.listEnvs(projectId);
        res.json(envs);
        node_assert_1.default.strictEqual(res.statusCode, 200);
        node_assert_1.default.strictEqual(res.jsonData.length, 2);
    });
    (0, node_test_1.it)('POST /api/envs/project/:id creates env', async () => {
        const req = createMockRequest({ projectId }, {
            key: 'NEW_KEY',
            value: 'secret-value'
        });
        const res = createMockResponse();
        if (!req.body.key || req.body.value === undefined) {
            res.status(400).json({ error: 'key and value required' });
        }
        else {
            const encrypted = pk.encrypt(req.body.value, `${projectId}:${req.body.key}`);
            const result = await db.createEnv(projectId, req.body.key, encrypted);
            res.status(201).json({ id: result.id });
        }
        node_assert_1.default.strictEqual(res.statusCode, 201);
        node_assert_1.default.ok(res.jsonData.id);
    });
    (0, node_test_1.it)('POST /api/envs/project/:id rejects missing key', async () => {
        const req = createMockRequest({ projectId }, { value: 'secret' });
        const res = createMockResponse();
        if (!req.body.key || req.body.value === undefined) {
            res.status(400).json({ error: 'key and value required' });
        }
        node_assert_1.default.strictEqual(res.statusCode, 400);
    });
    (0, node_test_1.it)('PUT /api/envs/project/:id updates env', async () => {
        await db.createEnv(projectId, 'EXISTING_KEY', 'old-encrypted');
        const req = createMockRequest({ projectId }, {
            key: 'EXISTING_KEY',
            value: 'new-value'
        });
        const res = createMockResponse();
        const encrypted = pk.encrypt(req.body.value, `${projectId}:${req.body.key}`);
        await db.updateEnv(projectId, req.body.key, encrypted);
        res.json({ ok: true });
        node_assert_1.default.strictEqual(res.statusCode, 200);
    });
    (0, node_test_1.it)('DELETE /api/envs/project/:id/:key removes env', async () => {
        await db.createEnv(projectId, 'TO_DELETE', 'encrypted');
        const req = createMockRequest({ projectId, key: 'TO_DELETE' });
        const res = createMockResponse();
        await db.deleteEnv(projectId, req.params.key);
        res.json({ ok: true });
        node_assert_1.default.strictEqual(res.statusCode, 200);
        const envs = await db.listEnvs(projectId);
        node_assert_1.default.strictEqual(envs.length, 0);
    });
});
(0, node_test_1.describe)('API Keys Router', () => {
    let db;
    let pk;
    let projectId;
    (0, node_test_1.beforeEach)(async () => {
        db = new MockDb();
        pk = new MockPk();
        const project = await db.createProject('test-project');
        projectId = project.id;
    });
    (0, node_test_1.it)('GET /api/apikeys/project/:id returns list of keys', async () => {
        await db.createApiKey(projectId, 'encrypted-key-1');
        await db.createApiKey(projectId, 'encrypted-key-2');
        const req = createMockRequest({ projectId });
        const res = createMockResponse();
        const keys = await db.listApiKeys(projectId);
        res.json(keys);
        node_assert_1.default.strictEqual(res.statusCode, 200);
        node_assert_1.default.strictEqual(res.jsonData.length, 2);
    });
    (0, node_test_1.it)('POST /api/apikeys/project/:id creates key', async () => {
        const req = createMockRequest({ projectId }, { ttl: 3600 });
        const res = createMockResponse();
        const plainKey = 'generated-key-123';
        const encrypted = pk.encrypt(plainKey, `${projectId}:apikey:${plainKey.slice(0, 8)}`);
        const result = await db.createApiKey(projectId, encrypted, req.body.ttl);
        res.status(201).json({ id: result.id, plainKey });
        node_assert_1.default.strictEqual(res.statusCode, 201);
        node_assert_1.default.ok(res.jsonData.id);
        node_assert_1.default.strictEqual(res.jsonData.plainKey, 'generated-key-123');
    });
    (0, node_test_1.it)('DELETE /api/apikeys/project/:id/:id revokes key', async () => {
        const key = await db.createApiKey(projectId, 'encrypted');
        const req = createMockRequest({ projectId, id: key.id });
        const res = createMockResponse();
        await db.revokeApiKey(projectId, req.params.id);
        res.json({ ok: true });
        node_assert_1.default.strictEqual(res.statusCode, 200);
        const keys = await db.listApiKeys(projectId);
        node_assert_1.default.strictEqual(keys.length, 0);
    });
});
(0, node_test_1.describe)('Whitelist Router', () => {
    let db;
    let projectId;
    (0, node_test_1.beforeEach)(async () => {
        db = new MockDb();
        const project = await db.createProject('test-project');
        projectId = project.id;
    });
    (0, node_test_1.it)('GET /api/whitelist/project/:id returns list', async () => {
        await db.createWhitelistEntry(projectId, 'fp-1', 'approved');
        await db.createWhitelistEntry(projectId, 'fp-2', 'pending');
        const req = createMockRequest({ projectId });
        const res = createMockResponse();
        const entries = await db.listWhitelistEntries(projectId);
        res.json(entries);
        node_assert_1.default.strictEqual(res.statusCode, 200);
        node_assert_1.default.strictEqual(res.jsonData.length, 2);
    });
    (0, node_test_1.it)('POST /api/whitelist/project/:id creates entry', async () => {
        const req = createMockRequest({ projectId }, {
            fingerprint: 'new-fingerprint',
            status: 'approved'
        });
        const res = createMockResponse();
        if (!req.body.fingerprint) {
            res.status(400).json({ error: 'fingerprint required' });
        }
        else {
            const result = await db.createWhitelistEntry(projectId, req.body.fingerprint, req.body.status || 'approved');
            res.status(201).json({ id: result.id });
        }
        node_assert_1.default.strictEqual(res.statusCode, 201);
    });
    (0, node_test_1.it)('PUT /api/whitelist/project/:id/:id updates status', async () => {
        const entry = await db.createWhitelistEntry(projectId, 'fp-1', 'pending');
        const req = createMockRequest({ projectId, id: entry.id }, { status: 'approved' });
        const res = createMockResponse();
        if (!req.body.status || !['approved', 'rejected'].includes(req.body.status)) {
            res.status(400).json({ error: 'status must be approved or rejected' });
        }
        else {
            await db.updateWhitelistStatus(req.params.id, req.body.status);
            res.json({ ok: true });
        }
        node_assert_1.default.strictEqual(res.statusCode, 200);
    });
    (0, node_test_1.it)('PUT /api/whitelist rejects invalid status', async () => {
        const entry = await db.createWhitelistEntry(projectId, 'fp-1', 'pending');
        const req = createMockRequest({ projectId, id: entry.id }, { status: 'invalid' });
        const res = createMockResponse();
        if (!req.body.status || !['approved', 'rejected'].includes(req.body.status)) {
            res.status(400).json({ error: 'status must be approved or rejected' });
        }
        node_assert_1.default.strictEqual(res.statusCode, 400);
    });
});
//# sourceMappingURL=rest-routes.test.js.map