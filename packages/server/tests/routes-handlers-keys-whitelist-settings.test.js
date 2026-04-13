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
// API Keys Router
// ============================================================
(0, node_test_1.describe)('Route Handlers - API Keys', () => {
    let server;
    let base;
    let db;
    let pk;
    (0, node_test_1.before)(async () => {
        db = (0, route_test_helpers_ts_1.createMockDb)();
        pk = (0, route_test_helpers_ts_1.createMockPk)();
        const result = await (0, route_test_helpers_ts_1.startApp)((app) => {
            app.use('/api/apikeys', (0, index_ts_1.createApiKeysRouter)(db, pk));
        });
        server = result.server;
        base = result.base;
    });
    (0, node_test_1.after)(() => { server.close(); });
    (0, node_test_1.it)('GET /project/:projectId returns list of API keys', async () => {
        db.listApiKeys = async () => [
            { id: 'k1', maskedPreview: 'abc12345...', createdAt: 1000 },
            { id: 'k2', maskedPreview: 'def67890...', ttl: 3600, expiresAt: 9999, createdAt: 2000 },
        ];
        const res = await fetch(`${base}/api/apikeys/project/proj-1`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.length, 2);
        node_assert_1.default.strictEqual(data[0].maskedPreview, 'abc12345...');
    });
    (0, node_test_1.it)('POST /project/:projectId creates key with auto-generated UUID', async () => {
        let storedArgs = null;
        db.createApiKey = async (projectId, encryptedValue, plainValue, ttl, name) => {
            storedArgs = { projectId, encryptedValue, plainValue, ttl, name };
            return { id: 'key-auto' };
        };
        const res = await fetch(`${base}/api/apikeys/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl: 7200 }),
        });
        node_assert_1.default.strictEqual(res.status, 201);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.id, 'key-auto');
        node_assert_1.default.ok(data.plainKey, 'should return generated plainKey');
        node_assert_1.default.strictEqual(storedArgs.ttl, 7200);
    });
    (0, node_test_1.it)('POST /project/:projectId creates key with provided plainKey', async () => {
        let storedPlain = null;
        db.createApiKey = async (_projectId, _enc, plainValue) => {
            storedPlain = plainValue;
            return { id: 'key-custom' };
        };
        const res = await fetch(`${base}/api/apikeys/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plainKey: 'my-custom-key-1234' }),
        });
        node_assert_1.default.strictEqual(res.status, 201);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.plainKey, 'my-custom-key-1234');
        node_assert_1.default.strictEqual(storedPlain, 'my-custom-key-1234');
    });
    (0, node_test_1.it)('POST /project/:projectId creates key with name', async () => {
        let storedName;
        db.createApiKey = async (_projectId, _enc, _plain, _ttl, name) => {
            storedName = name;
            return { id: 'key-named' };
        };
        const res = await fetch(`${base}/api/apikeys/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'production-key' }),
        });
        node_assert_1.default.strictEqual(res.status, 201);
        node_assert_1.default.strictEqual(storedName, 'production-key');
    });
    (0, node_test_1.it)('DELETE /project/:projectId/:id revokes API key', async () => {
        let revokedArgs = null;
        db.revokeApiKey = async (projectId, id) => { revokedArgs = { projectId, id }; };
        const res = await fetch(`${base}/api/apikeys/project/proj-1/key-to-revoke`, { method: 'DELETE' });
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.ok, true);
        node_assert_1.default.strictEqual(revokedArgs.projectId, 'proj-1');
        node_assert_1.default.strictEqual(revokedArgs.id, 'key-to-revoke');
    });
});
// ============================================================
// Whitelist Router
// ============================================================
(0, node_test_1.describe)('Route Handlers - Whitelist', () => {
    let server;
    let base;
    let db;
    (0, node_test_1.before)(async () => {
        db = (0, route_test_helpers_ts_1.createMockDb)();
        const result = await (0, route_test_helpers_ts_1.startApp)((app) => {
            app.use('/api/whitelist', (0, index_ts_1.createWhitelistRouter)(db));
        });
        server = result.server;
        base = result.base;
    });
    (0, node_test_1.after)(() => { server.close(); });
    (0, node_test_1.it)('GET /project/:projectId returns whitelist entries', async () => {
        db.listWhitelistEntries = async () => [
            { id: 'wl1', fingerprint: 'fp-aaa', status: 'approved', createdAt: 1000 },
            { id: 'wl2', fingerprint: 'fp-bbb', status: 'pending', createdAt: 2000 },
        ];
        const res = await fetch(`${base}/api/whitelist/project/proj-1`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.length, 2);
        node_assert_1.default.strictEqual(data[0].status, 'approved');
        node_assert_1.default.strictEqual(data[1].status, 'pending');
    });
    (0, node_test_1.it)('POST /project/:projectId creates entry with explicit status', async () => {
        let createdArgs = null;
        db.createWhitelistEntry = async (projectId, fingerprint, status) => {
            createdArgs = { projectId, fingerprint, status };
            return { id: 'wl-new' };
        };
        const res = await fetch(`${base}/api/whitelist/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fingerprint: 'fp-new', status: 'approved' }),
        });
        node_assert_1.default.strictEqual(res.status, 201);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.id, 'wl-new');
        node_assert_1.default.strictEqual(createdArgs.status, 'approved');
    });
    (0, node_test_1.it)('POST /project/:projectId defaults status to approved', async () => {
        let createdStatus = null;
        db.createWhitelistEntry = async (_pid, _fp, status) => {
            createdStatus = status;
            return { id: 'wl-def' };
        };
        const res = await fetch(`${base}/api/whitelist/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fingerprint: 'fp-default' }),
        });
        node_assert_1.default.strictEqual(res.status, 201);
        node_assert_1.default.strictEqual(createdStatus, 'approved');
    });
    (0, node_test_1.it)('POST /project/:projectId rejects missing fingerprint', async () => {
        const res = await fetch(`${base}/api/whitelist/project/proj-1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'fingerprint required');
    });
    (0, node_test_1.it)('PUT /project/:projectId/:id updates status to approved', async () => {
        let updatedArgs = null;
        db.updateWhitelistStatus = async (id, status) => { updatedArgs = { id, status }; };
        const res = await fetch(`${base}/api/whitelist/project/proj-1/wl-1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.ok, true);
        node_assert_1.default.strictEqual(updatedArgs.id, 'wl-1');
        node_assert_1.default.strictEqual(updatedArgs.status, 'approved');
    });
    (0, node_test_1.it)('PUT /project/:projectId/:id updates status to rejected', async () => {
        let updatedStatus = null;
        db.updateWhitelistStatus = async (_id, status) => { updatedStatus = status; };
        const res = await fetch(`${base}/api/whitelist/project/proj-1/wl-2`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected' }),
        });
        node_assert_1.default.strictEqual(res.status, 200);
        node_assert_1.default.strictEqual(updatedStatus, 'rejected');
    });
    (0, node_test_1.it)('PUT /project/:projectId/:id rejects invalid status', async () => {
        const res = await fetch(`${base}/api/whitelist/project/proj-1/wl-1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'invalid' }),
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'status must be approved or rejected');
    });
    (0, node_test_1.it)('PUT /project/:projectId/:id rejects missing status', async () => {
        const res = await fetch(`${base}/api/whitelist/project/proj-1/wl-1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'status must be approved or rejected');
    });
});
// ============================================================
// Global Settings Router
// ============================================================
(0, node_test_1.describe)('Route Handlers - Global Settings', () => {
    let server;
    let base;
    let db;
    (0, node_test_1.before)(async () => {
        db = (0, route_test_helpers_ts_1.createMockDb)();
        const result = await (0, route_test_helpers_ts_1.startApp)((app) => {
            app.use('/api/global', (0, index_ts_1.createGlobalSettingsRouter)(db));
        });
        server = result.server;
        base = result.base;
    });
    (0, node_test_1.after)(() => { server.close(); });
    (0, node_test_1.it)('GET /:key returns existing setting value', async () => {
        db.getGlobalSetting = async (key) => {
            if (key === 'temporal-pk')
                return 'true';
            return null;
        };
        const res = await fetch(`${base}/api/global/temporal-pk`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.value, 'true');
    });
    (0, node_test_1.it)('GET /:key returns null for non-existing setting', async () => {
        db.getGlobalSetting = async () => null;
        const res = await fetch(`${base}/api/global/nonexistent`);
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.value, null);
    });
    (0, node_test_1.it)('PUT /:key stores setting value', async () => {
        let storedArgs = null;
        db.storeGlobalSetting = async (key, value) => { storedArgs = { key, value }; };
        const res = await fetch(`${base}/api/global/temporal-pk`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: 'true' }),
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.ok, true);
        node_assert_1.default.strictEqual(storedArgs.key, 'temporal-pk');
        node_assert_1.default.strictEqual(storedArgs.value, 'true');
    });
    (0, node_test_1.it)('PUT /:key coerces non-string value to string', async () => {
        let storedValue = null;
        db.storeGlobalSetting = async (_key, value) => { storedValue = value; };
        const res = await fetch(`${base}/api/global/some-flag`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: 42 }),
        });
        node_assert_1.default.strictEqual(res.status, 200);
        node_assert_1.default.strictEqual(storedValue, '42');
    });
    (0, node_test_1.it)('PUT /:key rejects missing value', async () => {
        const res = await fetch(`${base}/api/global/some-key`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        node_assert_1.default.strictEqual(res.status, 400);
        const data = await res.json();
        node_assert_1.default.strictEqual(data.error, 'value required');
    });
});
//# sourceMappingURL=routes-handlers-keys-whitelist-settings.test.js.map