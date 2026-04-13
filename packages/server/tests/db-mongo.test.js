"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const mongo_ts_1 = require("../src/db/mongo.ts");
const humanenv_shared_1 = require("humanenv-shared");
class MockCursor {
    constructor(docs) {
        this.docs = docs;
    }
    sort(_spec) { return this; }
    async toArray() { return this.docs; }
}
class MockCollection {
    constructor() {
        this.docs = [];
        this.lastInsert = null;
        this.lastUpdate = null;
        this.lastDelete = null;
        this.lastDeleteMany = null;
        this.findOneResult = null;
        this.findResult = [];
    }
    createIndex(_keys, _opts) { return 'mock-index'; }
    async insertOne(doc) {
        this.lastInsert = doc;
        this.docs.push(doc);
        return { insertedId: 'mock-inserted-id' };
    }
    async findOne(filter) {
        return this.findOneResult;
    }
    find(_filter) {
        return new MockCursor(this.findResult);
    }
    async updateOne(filter, update, opts) {
        this.lastUpdate = { filter, update, opts };
        return { modifiedCount: 1 };
    }
    async deleteOne(filter) {
        this.lastDelete = filter;
        return { deletedCount: 1 };
    }
    async deleteMany(filter) {
        this.lastDeleteMany = filter;
        return { deletedCount: 0 };
    }
}
class MockDb {
    constructor() {
        this.collections = {};
    }
    collection(name) {
        if (!this.collections[name])
            this.collections[name] = new MockCollection();
        return this.collections[name];
    }
}
function setupProvider() {
    const provider = new mongo_ts_1.MongoProvider('mongodb://localhost:27017');
    const mockDb = new MockDb();
    provider.db = mockDb;
    provider.client = { close: async () => { } };
    return { provider, mockDb };
}
// ============================================================
// col() helper
// ============================================================
(0, node_test_1.describe)('MongoProvider col()', () => {
    (0, node_test_1.it)('throws DB_OPERATION_FAILED when db is null', () => {
        const provider = new mongo_ts_1.MongoProvider('mongodb://localhost:27017');
        node_assert_1.default.throws(() => provider.col('projects'), (err) => err instanceof Error && err.code === humanenv_shared_1.ErrorCode.DB_OPERATION_FAILED);
    });
    (0, node_test_1.it)('returns collection when db is set', () => {
        const { provider, mockDb } = setupProvider();
        const col = provider.col('projects');
        node_assert_1.default.ok(col);
        node_assert_1.default.strictEqual(col, mockDb.collection('projects'));
    });
});
// ============================================================
// Disconnect
// ============================================================
(0, node_test_1.describe)('MongoProvider disconnect', () => {
    (0, node_test_1.it)('closes client and clears interval', async () => {
        const { provider } = setupProvider();
        let closeCalled = false;
        provider.client = { close: async () => { closeCalled = true; } };
        const timer = setInterval(() => { }, 100000);
        provider.reconnectInterval = timer;
        await provider.disconnect();
        node_assert_1.default.strictEqual(closeCalled, true);
        // clearInterval is called (timer is destroyed)
        node_assert_1.default.strictEqual(timer._destroyed, true);
    });
    (0, node_test_1.it)('handles null client gracefully', async () => {
        const provider = new mongo_ts_1.MongoProvider('mongodb://localhost:27017');
        provider.client = null;
        await provider.disconnect(); // should not throw
    });
});
// ============================================================
// Projects
// ============================================================
(0, node_test_1.describe)('MongoProvider Projects', () => {
    let provider;
    let mockDb;
    (0, node_test_1.beforeEach)(() => {
        const setup = setupProvider();
        provider = setup.provider;
        mockDb = setup.mockDb;
    });
    (0, node_test_1.it)('createProject inserts doc and returns id', async () => {
        const result = await provider.createProject('my-app');
        node_assert_1.default.ok(result.id);
        node_assert_1.default.strictEqual(typeof result.id, 'string');
        const col = mockDb.collection('projects');
        node_assert_1.default.strictEqual(col.lastInsert?.name, 'my-app');
        node_assert_1.default.ok(col.lastInsert?.createdAt);
    });
    (0, node_test_1.it)('getProject returns mapped doc with defaults', async () => {
        const col = mockDb.collection('projects');
        col.findOneResult = { id: 'p1', name: 'app', createdAt: 1000 };
        const result = await provider.getProject('app');
        node_assert_1.default.ok(result);
        node_assert_1.default.strictEqual(result.id, 'p1');
        node_assert_1.default.strictEqual(result.name, 'app');
        node_assert_1.default.strictEqual(result.fingerprintVerification, true);
        node_assert_1.default.strictEqual(result.requireApiKey, false);
    });
    (0, node_test_1.it)('getProject returns null when not found', async () => {
        mockDb.collection('projects').findOneResult = null;
        const result = await provider.getProject('nonexistent');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('getProject respects explicit fingerprintVerification=false', async () => {
        mockDb.collection('projects').findOneResult = {
            id: 'p2', name: 'strict', createdAt: 2000,
            fingerprintVerification: false, requireApiKey: true,
        };
        const result = await provider.getProject('strict');
        node_assert_1.default.strictEqual(result.fingerprintVerification, false);
        node_assert_1.default.strictEqual(result.requireApiKey, true);
    });
    (0, node_test_1.it)('listProjects returns array from cursor', async () => {
        mockDb.collection('projects').findResult = [
            { id: 'p1', name: 'alpha', createdAt: 1000 },
            { id: 'p2', name: 'beta', createdAt: 2000 },
        ];
        const result = await provider.listProjects();
        node_assert_1.default.strictEqual(result.length, 2);
    });
    (0, node_test_1.it)('deleteProject cascades to envs, apiKeys, whitelist', async () => {
        await provider.deleteProject('proj-1');
        node_assert_1.default.deepStrictEqual(mockDb.collection('projects').lastDelete, { id: 'proj-1' });
        node_assert_1.default.deepStrictEqual(mockDb.collection('envs').lastDeleteMany, { projectId: 'proj-1' });
        node_assert_1.default.deepStrictEqual(mockDb.collection('apiKeys').lastDeleteMany, { projectId: 'proj-1' });
        node_assert_1.default.deepStrictEqual(mockDb.collection('whitelist').lastDeleteMany, { projectId: 'proj-1' });
    });
    (0, node_test_1.it)('updateProject sets only provided fields', async () => {
        await provider.updateProject('proj-1', { fingerprintVerification: false });
        const col = mockDb.collection('projects');
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.filter, { id: 'proj-1' });
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.update, { $set: { fingerprintVerification: false } });
    });
    (0, node_test_1.it)('updateProject skips call when no fields provided', async () => {
        await provider.updateProject('proj-1', {});
        node_assert_1.default.strictEqual(mockDb.collection('projects').lastUpdate, null);
    });
});
// ============================================================
// Envs
// ============================================================
(0, node_test_1.describe)('MongoProvider Envs', () => {
    let provider;
    let mockDb;
    (0, node_test_1.beforeEach)(() => {
        const setup = setupProvider();
        provider = setup.provider;
        mockDb = setup.mockDb;
    });
    (0, node_test_1.it)('createEnv upserts and returns id', async () => {
        const result = await provider.createEnv('p1', 'DB_HOST', 'enc-val');
        node_assert_1.default.ok(result.id);
        const col = mockDb.collection('envs');
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.filter, { projectId: 'p1', key: 'DB_HOST' });
        node_assert_1.default.strictEqual(col.lastUpdate?.opts?.upsert, true);
    });
    (0, node_test_1.it)('getEnv returns mapped fields', async () => {
        mockDb.collection('envs').findOneResult = {
            id: 'e1', projectId: 'p1', key: 'SECRET',
            encryptedValue: 'enc-xyz', createdAt: 1000,
        };
        const result = await provider.getEnv('p1', 'SECRET');
        node_assert_1.default.ok(result);
        node_assert_1.default.strictEqual(result.encryptedValue, 'enc-xyz');
    });
    (0, node_test_1.it)('getEnv returns null when not found', async () => {
        mockDb.collection('envs').findOneResult = null;
        const result = await provider.getEnv('p1', 'MISSING');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('listEnvs returns mapped array', async () => {
        mockDb.collection('envs').findResult = [
            { id: 'e1', key: 'A_KEY', createdAt: 1000 },
            { id: 'e2', key: 'B_KEY', createdAt: 2000 },
        ];
        const result = await provider.listEnvs('p1');
        node_assert_1.default.strictEqual(result.length, 2);
        node_assert_1.default.strictEqual(result[0].key, 'A_KEY');
        node_assert_1.default.strictEqual(result[1].key, 'B_KEY');
    });
    (0, node_test_1.it)('deleteEnv removes by projectId and key', async () => {
        await provider.deleteEnv('p1', 'OLD_KEY');
        node_assert_1.default.deepStrictEqual(mockDb.collection('envs').lastDelete, { projectId: 'p1', key: 'OLD_KEY' });
    });
});
// ============================================================
// API Keys
// ============================================================
(0, node_test_1.describe)('MongoProvider API Keys', () => {
    let provider;
    let mockDb;
    (0, node_test_1.beforeEach)(() => {
        const setup = setupProvider();
        provider = setup.provider;
        mockDb = setup.mockDb;
    });
    (0, node_test_1.it)('createApiKey with ttl sets expiresAt', async () => {
        const before = Date.now();
        const result = await provider.createApiKey('p1', 'enc-key', 'plain-key-123', 3600);
        node_assert_1.default.ok(result.id);
        const col = mockDb.collection('apiKeys');
        node_assert_1.default.ok(col.lastInsert);
        node_assert_1.default.strictEqual(col.lastInsert.projectId, 'p1');
        node_assert_1.default.strictEqual(col.lastInsert.ttl, 3600);
        node_assert_1.default.ok(col.lastInsert.expiresAt >= before + 3600 * 1000);
        node_assert_1.default.strictEqual(col.lastInsert.lookupHash, node_crypto_1.default.createHash('sha256').update('plain-key-123').digest('hex'));
    });
    (0, node_test_1.it)('createApiKey without ttl sets null expiresAt', async () => {
        await provider.createApiKey('p1', 'enc-key', 'plain-key-456');
        const col = mockDb.collection('apiKeys');
        node_assert_1.default.strictEqual(col.lastInsert?.ttl, null);
        node_assert_1.default.strictEqual(col.lastInsert?.expiresAt, null);
    });
    (0, node_test_1.it)('createApiKey with name stores name', async () => {
        await provider.createApiKey('p1', 'enc-key', 'plain-key', undefined, 'my-key-name');
        node_assert_1.default.strictEqual(mockDb.collection('apiKeys').lastInsert?.name, 'my-key-name');
    });
    (0, node_test_1.it)('getApiKey returns null when not found', async () => {
        mockDb.collection('apiKeys').findOneResult = null;
        const result = await provider.getApiKey('p1', 'unknown-key');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('getApiKey returns null for expired key', async () => {
        mockDb.collection('apiKeys').findOneResult = {
            id: 'k1', projectId: 'p1', expiresAt: Date.now() - 10000,
        };
        const result = await provider.getApiKey('p1', 'some-key');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('getApiKey returns valid key', async () => {
        mockDb.collection('apiKeys').findOneResult = {
            id: 'k1', projectId: 'p1', expiresAt: Date.now() + 60000,
        };
        const result = await provider.getApiKey('p1', 'some-key');
        node_assert_1.default.ok(result);
        node_assert_1.default.strictEqual(result.id, 'k1');
    });
    (0, node_test_1.it)('getApiKey returns key with no expiresAt', async () => {
        mockDb.collection('apiKeys').findOneResult = {
            id: 'k2', projectId: 'p1', expiresAt: null,
        };
        const result = await provider.getApiKey('p1', 'some-key');
        node_assert_1.default.ok(result);
        node_assert_1.default.strictEqual(result.id, 'k2');
    });
    (0, node_test_1.it)('listApiKeys returns masked preview', async () => {
        mockDb.collection('apiKeys').findResult = [
            { id: 'k1', lookupHash: 'abcdef1234567890', ttl: 3600, expiresAt: 9999, createdAt: 1000, name: 'prod-key', lastUsed: 5000 },
        ];
        const result = await provider.listApiKeys('p1');
        node_assert_1.default.strictEqual(result.length, 1);
        node_assert_1.default.strictEqual(result[0].maskedPreview, 'abcdef12...');
        node_assert_1.default.strictEqual(result[0].name, 'prod-key');
        node_assert_1.default.strictEqual(result[0].lastUsed, 5000);
    });
    (0, node_test_1.it)('revokeApiKey deletes by id and projectId', async () => {
        await provider.revokeApiKey('p1', 'k1');
        node_assert_1.default.deepStrictEqual(mockDb.collection('apiKeys').lastDelete, { id: 'k1', projectId: 'p1' });
    });
    (0, node_test_1.it)('updateApiKeyLastUsed sets timestamp', async () => {
        await provider.updateApiKeyLastUsed('k1', 12345);
        const col = mockDb.collection('apiKeys');
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.filter, { id: 'k1' });
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.update, { $set: { lastUsed: 12345 } });
    });
});
// ============================================================
// Whitelist
// ============================================================
(0, node_test_1.describe)('MongoProvider Whitelist', () => {
    let provider;
    let mockDb;
    (0, node_test_1.beforeEach)(() => {
        const setup = setupProvider();
        provider = setup.provider;
        mockDb = setup.mockDb;
    });
    (0, node_test_1.it)('createWhitelistEntry upserts and returns id', async () => {
        const result = await provider.createWhitelistEntry('p1', 'fp-abc', 'pending');
        node_assert_1.default.ok(result.id);
        const col = mockDb.collection('whitelist');
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.filter, { projectId: 'p1', fingerprint: 'fp-abc' });
        node_assert_1.default.strictEqual(col.lastUpdate?.opts?.upsert, true);
    });
    (0, node_test_1.it)('getWhitelistEntry returns mapped doc', async () => {
        mockDb.collection('whitelist').findOneResult = { id: 'w1', status: 'approved' };
        const result = await provider.getWhitelistEntry('p1', 'fp-abc');
        node_assert_1.default.ok(result);
        node_assert_1.default.strictEqual(result.id, 'w1');
        node_assert_1.default.strictEqual(result.status, 'approved');
    });
    (0, node_test_1.it)('getWhitelistEntry returns null when not found', async () => {
        mockDb.collection('whitelist').findOneResult = null;
        const result = await provider.getWhitelistEntry('p1', 'fp-unknown');
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('updateWhitelistStatus updates by id', async () => {
        await provider.updateWhitelistStatus('w1', 'rejected');
        const col = mockDb.collection('whitelist');
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.filter, { id: 'w1' });
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.update, { $set: { status: 'rejected' } });
    });
});
// ============================================================
// PK Hash
// ============================================================
(0, node_test_1.describe)('MongoProvider PK Hash', () => {
    let provider;
    let mockDb;
    (0, node_test_1.beforeEach)(() => {
        const setup = setupProvider();
        provider = setup.provider;
        mockDb = setup.mockDb;
    });
    (0, node_test_1.it)('storePkHash upserts to serverConfig', async () => {
        await provider.storePkHash('abc123hash');
        const col = mockDb.collection('serverConfig');
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.filter, { key: 'pk_hash' });
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.update, { $set: { key: 'pk_hash', value: 'abc123hash' } });
        node_assert_1.default.strictEqual(col.lastUpdate?.opts?.upsert, true);
    });
    (0, node_test_1.it)('getPkHash returns value when found', async () => {
        mockDb.collection('serverConfig').findOneResult = { key: 'pk_hash', value: 'hash-val' };
        const result = await provider.getPkHash();
        node_assert_1.default.strictEqual(result, 'hash-val');
    });
    (0, node_test_1.it)('getPkHash returns null when not found', async () => {
        mockDb.collection('serverConfig').findOneResult = null;
        const result = await provider.getPkHash();
        node_assert_1.default.strictEqual(result, null);
    });
});
// ============================================================
// Global Settings
// ============================================================
(0, node_test_1.describe)('MongoProvider Global Settings', () => {
    let provider;
    let mockDb;
    (0, node_test_1.beforeEach)(() => {
        const setup = setupProvider();
        provider = setup.provider;
        mockDb = setup.mockDb;
    });
    (0, node_test_1.it)('storeGlobalSetting upserts to serverConfig', async () => {
        await provider.storeGlobalSetting('temporal_pk_salt', 'salt-xyz');
        const col = mockDb.collection('serverConfig');
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.filter, { key: 'temporal_pk_salt' });
        node_assert_1.default.deepStrictEqual(col.lastUpdate?.update, { $set: { key: 'temporal_pk_salt', value: 'salt-xyz' } });
    });
    (0, node_test_1.it)('getGlobalSetting returns value when found', async () => {
        mockDb.collection('serverConfig').findOneResult = { key: 'some_setting', value: 'val123' };
        const result = await provider.getGlobalSetting('some_setting');
        node_assert_1.default.strictEqual(result, 'val123');
    });
    (0, node_test_1.it)('getGlobalSetting returns null when not found', async () => {
        mockDb.collection('serverConfig').findOneResult = null;
        const result = await provider.getGlobalSetting('missing_key');
        node_assert_1.default.strictEqual(result, null);
    });
});
//# sourceMappingURL=db-mongo.test.js.map