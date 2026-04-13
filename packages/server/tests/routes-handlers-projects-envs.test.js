"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const index_ts_1 = require("../src/routes/index.ts");
const route_test_helpers_ts_1 = require("./route-test-helpers.ts");
// ============================================================
// Projects Router
// ============================================================
(0, node_test_1.describe)('Route Handlers - Projects', () => {
    let server;
    let base;
    let db;
    let pk;
    (0, node_test_1.before)(async () => {
        db = (0, route_test_helpers_ts_1.createMockDb)();
        pk = (0, route_test_helpers_ts_1.createMockPk)();
        const result = await (0, route_test_helpers_ts_1.startApp)((app) => {
            app.use('/api/projects', (0, index_ts_1.createProjectsRouter)(db, pk));
        });
        server = result.server;
        base = result.base;
    });
    (0, node_test_1.after)(() => { server.close(); });
    (0, node_test_1.it)('GET / returns empty list when no projects exist', async () => {
        db.listProjects = async () => [];
        const res = await fetch(`${base}/api/projects`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.deepStrictEqual(data, []);
    });
    (0, node_test_1.it)('GET / returns list of projects', async () => {
        db.listProjects = async () => [
            { id: 'p1', name: 'alpha', createdAt: 1000 },
            { id: 'p2', name: 'beta', createdAt: 2000 },
        ];
        const res = await fetch(`${base}/api/projects`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.length, 2);
        node_assert_1.default.strictEqual(data[0].name, 'alpha');
        node_assert_1.default.strictEqual(data[1].name, 'beta');
    });
    (0, node_test_1.it)('POST / creates a project successfully', async () => {
        db.getProject = async () => null;
        db.createProject = async (name) => {
            node_assert_1.default.strictEqual(name, 'new-project');
            return { id: 'proj-new' };
        };
        const res = await fetch(`${base}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'new-project' }),
        });
        node_assert_1.default.strictEqual(res.status, 201);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.id, 'proj-new');
    });
    (0, node_test_1.it)('POST / rejects request with missing name', async () => {
        const res = await fetch(`${base}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'name required');
    });
    (0, node_test_1.it)('POST / rejects duplicate project name', async () => {
        db.getProject = async () => ({ id: 'existing', name: 'dup', createdAt: 1000, fingerprintVerification: true, requireApiKey: false });
        const res = await fetch(`${base}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'dup' }),
        });
        node_assert_1.default.strictEqual(res.status, 409);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'Project already exists');
    });
    (0, node_test_1.it)('PUT /:id updates project settings', async () => {
        let updatedData = null;
        db.updateProject = async (id, data) => {
            updatedData = { id, ...data };
        };
        const res = await fetch(`${base}/api/projects/proj-1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fingerprintVerification: false, requireApiKey: true }),
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.ok, true);
        node_assert_1.default.strictEqual(updatedData.id, 'proj-1');
        node_assert_1.default.strictEqual(updatedData.fingerprintVerification, false);
        node_assert_1.default.strictEqual(updatedData.requireApiKey, true);
    });
    (0, node_test_1.it)('DELETE /:id deletes a project', async () => {
        let deletedId = null;
        db.deleteProject = async (id) => { deletedId = id; };
        const res = await fetch(`${base}/api/projects/proj-del`, { method: 'DELETE' });
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.ok, true);
        node_assert_1.default.strictEqual(deletedId, 'proj-del');
    });
});
// ============================================================
// Envs Router
// ============================================================
(0, node_test_1.describe)('Route Handlers - Envs', () => {
    let server;
    let base;
    let db;
    let pk;
    (0, node_test_1.before)(async () => {
        db = (0, route_test_helpers_ts_1.createMockDb)();
        pk = (0, route_test_helpers_ts_1.createMockPk)();
        const result = await (0, route_test_helpers_ts_1.startApp)((app) => {
            app.use('/api/envs', (0, index_ts_1.createEnvsRouter)(db, pk));
        });
        server = result.server;
        base = result.base;
    });
    (0, node_test_1.after)(() => { server.close(); });
    (0, node_test_1.it)('GET /project/:projectId returns list of envs', async () => {
        db.listEnvs = async (projectId) => [
            { id: 'e1', key: 'DB_HOST', createdAt: 1000 },
            { id: 'e2', key: 'SECRET', createdAt: 2000 },
        ];
        const res = await fetch(`${base}/api/envs/project/proj-1`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.length, 2);
        node_assert_1.default.strictEqual(data[0].key, 'DB_HOST');
        node_assert_1.default.strictEqual(data[1].key, 'SECRET');
    });
    (0, node_test_1.it)('GET /project/:projectId/all bulk decrypts all envs', async () => {
        db.listEnvsWithValues = async () => [
            { id: 'e1', key: 'KEY_A', encryptedValue: 'enc:value-a', createdAt: 1000 },
            { id: 'e2', key: 'KEY_B', encryptedValue: 'enc:value-b', createdAt: 2000 },
        ];
        const res = await fetch(`${base}/api/envs/project/proj-1/all`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.KEY_A, 'value-a');
        node_assert_1.default.strictEqual(data.KEY_B, 'value-b');
    });
    (0, node_test_1.it)('GET /project/:projectId/:key returns decrypted env value', async () => {
        db.getEnv = async () => ({ encryptedValue: 'enc:my-secret' });
        const res = await fetch(`${base}/api/envs/project/proj-1/API_KEY`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.key, 'API_KEY');
        node_assert_1.default.strictEqual(data.value, 'my-secret');
    });
    (0, node_test_1.it)('GET /project/:projectId/:key returns 404 for missing env', async () => {
        db.getEnv = async () => null;
        const res = await fetch(`${base}/api/envs/project/proj-1/MISSING`);
        node_assert_1.default.strictEqual(res.status, 404);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'Env not found');
    });
    (0, node_test_1.it)('POST /project/:projectId creates env with encryption', async () => {
        let createdEnv = null;
        db.createEnv = async (projectId, key, encryptedValue) => {
            createdEnv = { projectId, key, encryptedValue };
            return { id: 'env-new' };
        };
        const res = await fetch(`${base}/api/envs/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'NEW_KEY', value: 'new-value' }),
        });
        node_assert_1.default.strictEqual(res.status, 201);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.id, 'env-new');
        node_assert_1.default.strictEqual(createdEnv.key, 'NEW_KEY');
        node_assert_1.default.strictEqual(createdEnv.encryptedValue, 'enc:new-value');
    });
    (0, node_test_1.it)('POST /project/:projectId rejects missing key', async () => {
        const res = await fetch(`${base}/api/envs/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: 'some-value' }),
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'key and value required');
    });
    (0, node_test_1.it)('POST /project/:projectId rejects missing value', async () => {
        const res = await fetch(`${base}/api/envs/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'SOME_KEY' }),
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'key and value required');
    });
    (0, node_test_1.it)('PUT /project/:projectId updates env', async () => {
        let updatedEnv = null;
        db.updateEnv = async (projectId, key, encryptedValue) => {
            updatedEnv = { projectId, key, encryptedValue };
        };
        const res = await fetch(`${base}/api/envs/project/proj-1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'EXISTING', value: 'updated-val' }),
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.ok, true);
        node_assert_1.default.strictEqual(updatedEnv.key, 'EXISTING');
        node_assert_1.default.strictEqual(updatedEnv.encryptedValue, 'enc:updated-val');
    });
    (0, node_test_1.it)('DELETE /project/:projectId/:key deletes env', async () => {
        let deletedArgs = null;
        db.deleteEnv = async (projectId, key) => { deletedArgs = { projectId, key }; };
        const res = await fetch(`${base}/api/envs/project/proj-1/OLD_KEY`, { method: 'DELETE' });
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.ok, true);
        node_assert_1.default.strictEqual(deletedArgs.projectId, 'proj-1');
        node_assert_1.default.strictEqual(deletedArgs.key, 'OLD_KEY');
    });
    (0, node_test_1.it)('GET /project/:projectId/:key decodes URL-encoded key', async () => {
        let requestedKey = null;
        db.getEnv = async (_projectId, key) => {
            requestedKey = key;
            return { encryptedValue: 'enc:val' };
        };
        const res = await fetch(`${base}/api/envs/project/proj-1/${encodeURIComponent('MY KEY')}`);
        node_assert_1.default.strictEqual(res.status, 200);
        node_assert_1.default.strictEqual(requestedKey, 'MY KEY');
    });
});
//# sourceMappingURL=routes-handlers-projects-envs.test.js.map