"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const sqlite_ts_1 = require("../src/db/sqlite.ts");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
let db;
let dbPath;
function setup() {
    dbPath = path.join('/tmp', `humanenv-test-${Date.now()}-${Math.random()}.db`);
    db = new sqlite_ts_1.SqliteProvider(dbPath);
}
async function teardown() {
    await db.disconnect();
    if (fs.existsSync(dbPath))
        fs.unlinkSync(dbPath);
}
// ============================================================
// updateProject
// ============================================================
(0, node_test_1.describe)('SqliteProvider - updateProject', () => {
    (0, node_test_1.beforeEach)(async () => { setup(); await db.connect(); });
    (0, node_test_1.afterEach)(teardown);
    (0, node_test_1.it)('sets fingerprintVerification to false', async () => {
        const { id } = await db.createProject('proj-fp');
        await db.updateProject(id, { fingerprintVerification: false });
        const proj = await db.getProject('proj-fp');
        node_assert_1.default.strictEqual(proj.fingerprintVerification, false);
    });
    (0, node_test_1.it)('sets requireApiKey to true', async () => {
        const { id } = await db.createProject('proj-api');
        await db.updateProject(id, { requireApiKey: true });
        const proj = await db.getProject('proj-api');
        node_assert_1.default.strictEqual(proj.requireApiKey, true);
    });
    (0, node_test_1.it)('sets both fields at once', async () => {
        const { id } = await db.createProject('proj-both');
        await db.updateProject(id, { fingerprintVerification: false, requireApiKey: true });
        const proj = await db.getProject('proj-both');
        node_assert_1.default.strictEqual(proj.fingerprintVerification, false);
        node_assert_1.default.strictEqual(proj.requireApiKey, true);
    });
    (0, node_test_1.it)('getProject returns correct boolean defaults', async () => {
        await db.createProject('proj-defaults');
        const proj = await db.getProject('proj-defaults');
        node_assert_1.default.strictEqual(proj.fingerprintVerification, true);
        node_assert_1.default.strictEqual(proj.requireApiKey, false);
    });
});
// ============================================================
// listEnvsWithValues
// ============================================================
(0, node_test_1.describe)('SqliteProvider - listEnvsWithValues', () => {
    let projectId;
    (0, node_test_1.beforeEach)(async () => {
        setup();
        await db.connect();
        projectId = (await db.createProject('env-vals-proj')).id;
    });
    (0, node_test_1.afterEach)(teardown);
    (0, node_test_1.it)('returns encrypted values and all fields', async () => {
        await db.createEnv(projectId, 'DB_HOST', 'enc-host');
        await db.createEnv(projectId, 'DB_PASS', 'enc-pass');
        const envs = await db.listEnvsWithValues(projectId);
        node_assert_1.default.strictEqual(envs.length, 2);
        node_assert_1.default.strictEqual(envs[0].key, 'DB_HOST');
        node_assert_1.default.strictEqual(envs[0].encryptedValue, 'enc-host');
        node_assert_1.default.strictEqual(envs[1].key, 'DB_PASS');
        node_assert_1.default.strictEqual(envs[1].encryptedValue, 'enc-pass');
    });
    (0, node_test_1.it)('returns empty array when no envs', async () => {
        const envs = await db.listEnvsWithValues(projectId);
        node_assert_1.default.deepStrictEqual(envs, []);
    });
});
// ============================================================
// API Keys
// ============================================================
(0, node_test_1.describe)('SqliteProvider - API Keys', () => {
    let projectId;
    (0, node_test_1.beforeEach)(async () => {
        setup();
        await db.connect();
        projectId = (await db.createProject('apikey-proj')).id;
    });
    (0, node_test_1.afterEach)(teardown);
    (0, node_test_1.it)('createApiKey returns id', async () => {
        const result = await db.createApiKey(projectId, 'enc-key', 'plain-key-123');
        node_assert_1.default.ok(result.id);
        node_assert_1.default.strictEqual(typeof result.id, 'string');
    });
    (0, node_test_1.it)('createApiKey with TTL sets expiresAt', async () => {
        const before = Date.now();
        await db.createApiKey(projectId, 'enc-key', 'plain-ttl', 3600);
        const keys = await db.listApiKeys(projectId);
        node_assert_1.default.strictEqual(keys.length, 1);
        node_assert_1.default.strictEqual(keys[0].ttl, 3600);
        node_assert_1.default.ok(keys[0].expiresAt >= before + 3600 * 1000);
    });
    (0, node_test_1.it)('createApiKey without TTL has null expiresAt', async () => {
        await db.createApiKey(projectId, 'enc-key', 'plain-nottl');
        const keys = await db.listApiKeys(projectId);
        node_assert_1.default.strictEqual(keys[0].ttl, null);
        node_assert_1.default.strictEqual(keys[0].expiresAt, null);
    });
    (0, node_test_1.it)('createApiKey with name stores name', async () => {
        await db.createApiKey(projectId, 'enc-key', 'plain-named', undefined, 'my-key');
        const keys = await db.listApiKeys(projectId);
        node_assert_1.default.strictEqual(keys[0].name, 'my-key');
    });
    (0, node_test_1.it)('getApiKey returns valid key by plain value', async () => {
        const { id } = await db.createApiKey(projectId, 'enc-key', 'plain-lookup');
        const result = await db.getApiKey(projectId, 'plain-lookup');
        node_assert_1.default.ok(result);
        node_assert_1.default.strictEqual(result.id, id);
    });
    (0, node_test_1.it)('getApiKey returns null for expired key', async () => {
        await db.createApiKey(projectId, 'enc-key', 'plain-expired', 1);
        // Manually set expires_at in the past to guarantee expiry
        const lookupHash = (await Promise.resolve().then(() => __importStar(require('node:crypto')))).createHash('sha256').update('plain-expired').digest('hex');
        db.db.prepare('UPDATE api_keys SET expires_at = ? WHERE lookup_hash = ?').run(Date.now() - 10000, lookupHash);
        const result = await db.getApiKey(projectId, 'plain-expired');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('getApiKey returns null for unknown key', async () => {
        const result = await db.getApiKey(projectId, 'nonexistent');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('getApiKey returns key with no expiry', async () => {
        const { id } = await db.createApiKey(projectId, 'enc-key', 'plain-noexpiry');
        const result = await db.getApiKey(projectId, 'plain-noexpiry');
        node_assert_1.default.ok(result);
        node_assert_1.default.strictEqual(result.id, id);
        node_assert_1.default.strictEqual(result.expiresAt, null);
    });
    (0, node_test_1.it)('listApiKeys returns masked preview', async () => {
        await db.createApiKey(projectId, 'enc-key', 'plain-preview-key', 7200, 'prod-key');
        const keys = await db.listApiKeys(projectId);
        node_assert_1.default.strictEqual(keys.length, 1);
        node_assert_1.default.ok(keys[0].maskedPreview.endsWith('...'));
        node_assert_1.default.strictEqual(keys[0].maskedPreview.length, 11); // 8 chars + '...'
        node_assert_1.default.strictEqual(keys[0].name, 'prod-key');
        node_assert_1.default.strictEqual(keys[0].ttl, 7200);
        node_assert_1.default.ok(keys[0].createdAt);
    });
    (0, node_test_1.it)('revokeApiKey removes key', async () => {
        const { id } = await db.createApiKey(projectId, 'enc-key', 'plain-revoke');
        await db.revokeApiKey(projectId, id);
        const result = await db.getApiKey(projectId, 'plain-revoke');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('updateApiKeyLastUsed sets timestamp', async () => {
        const { id } = await db.createApiKey(projectId, 'enc-key', 'plain-used');
        const ts = Date.now();
        await db.updateApiKeyLastUsed(id, ts);
        const keys = await db.listApiKeys(projectId);
        node_assert_1.default.strictEqual(keys[0].lastUsed, ts);
    });
});
// ============================================================
// Whitelist
// ============================================================
(0, node_test_1.describe)('SqliteProvider - Whitelist', () => {
    let projectId;
    (0, node_test_1.beforeEach)(async () => {
        setup();
        await db.connect();
        projectId = (await db.createProject('wl-proj')).id;
    });
    (0, node_test_1.afterEach)(teardown);
    (0, node_test_1.it)('createWhitelistEntry returns id', async () => {
        const result = await db.createWhitelistEntry(projectId, 'fp-abc', 'pending');
        node_assert_1.default.ok(result.id);
        node_assert_1.default.strictEqual(typeof result.id, 'string');
    });
    (0, node_test_1.it)('getWhitelistEntry returns status', async () => {
        await db.createWhitelistEntry(projectId, 'fp-get', 'approved');
        const result = await db.getWhitelistEntry(projectId, 'fp-get');
        node_assert_1.default.ok(result);
        node_assert_1.default.strictEqual(result.status, 'approved');
    });
    (0, node_test_1.it)('getWhitelistEntry returns null for unknown fingerprint', async () => {
        const result = await db.getWhitelistEntry(projectId, 'fp-unknown');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('listWhitelistEntries returns all entries sorted by date', async () => {
        await db.createWhitelistEntry(projectId, 'fp-1', 'pending');
        await new Promise(r => setTimeout(r, 10));
        await db.createWhitelistEntry(projectId, 'fp-2', 'approved');
        const entries = await db.listWhitelistEntries(projectId);
        node_assert_1.default.strictEqual(entries.length, 2);
        node_assert_1.default.strictEqual(entries[0].fingerprint, 'fp-2');
        node_assert_1.default.strictEqual(entries[0].status, 'approved');
        node_assert_1.default.strictEqual(entries[1].fingerprint, 'fp-1');
        node_assert_1.default.strictEqual(entries[1].status, 'pending');
    });
    (0, node_test_1.it)('updateWhitelistStatus changes status', async () => {
        const { id } = await db.createWhitelistEntry(projectId, 'fp-update', 'pending');
        await db.updateWhitelistStatus(id, 'rejected');
        const result = await db.getWhitelistEntry(projectId, 'fp-update');
        node_assert_1.default.strictEqual(result.status, 'rejected');
    });
    (0, node_test_1.it)('createWhitelistEntry upserts on same project+fingerprint', async () => {
        await db.createWhitelistEntry(projectId, 'fp-dup', 'pending');
        await db.createWhitelistEntry(projectId, 'fp-dup', 'approved');
        const result = await db.getWhitelistEntry(projectId, 'fp-dup');
        node_assert_1.default.strictEqual(result.status, 'approved');
        const entries = await db.listWhitelistEntries(projectId);
        node_assert_1.default.strictEqual(entries.length, 1);
    });
});
// ============================================================
// Global Settings
// ============================================================
(0, node_test_1.describe)('SqliteProvider - Global Settings', () => {
    (0, node_test_1.beforeEach)(async () => { setup(); await db.connect(); });
    (0, node_test_1.afterEach)(teardown);
    (0, node_test_1.it)('storeGlobalSetting and getGlobalSetting roundtrip', async () => {
        await db.storeGlobalSetting('temporal_pk_salt', 'salt-xyz');
        const result = await db.getGlobalSetting('temporal_pk_salt');
        node_assert_1.default.strictEqual(result, 'salt-xyz');
    });
    (0, node_test_1.it)('getGlobalSetting returns null when not set', async () => {
        const result = await db.getGlobalSetting('nonexistent_key');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('storeGlobalSetting updates existing value', async () => {
        await db.storeGlobalSetting('my_key', 'v1');
        await db.storeGlobalSetting('my_key', 'v2');
        const result = await db.getGlobalSetting('my_key');
        node_assert_1.default.strictEqual(result, 'v2');
    });
});
// ============================================================
// Cascade deletes (extended)
// ============================================================
(0, node_test_1.describe)('SqliteProvider - deleteProject cascades', () => {
    (0, node_test_1.beforeEach)(async () => { setup(); await db.connect(); });
    (0, node_test_1.afterEach)(teardown);
    (0, node_test_1.it)('cascades to api_keys', async () => {
        const { id } = await db.createProject('cascade-keys');
        await db.createApiKey(id, 'enc-1', 'plain-1');
        await db.createApiKey(id, 'enc-2', 'plain-2');
        await db.deleteProject(id);
        const keys = await db.listApiKeys(id);
        node_assert_1.default.strictEqual(keys.length, 0);
    });
    (0, node_test_1.it)('cascades to whitelist', async () => {
        const { id } = await db.createProject('cascade-wl');
        await db.createWhitelistEntry(id, 'fp-1', 'approved');
        await db.createWhitelistEntry(id, 'fp-2', 'pending');
        await db.deleteProject(id);
        const entries = await db.listWhitelistEntries(id);
        node_assert_1.default.strictEqual(entries.length, 0);
    });
});
//# sourceMappingURL=db-sqlite-extended.test.js.map