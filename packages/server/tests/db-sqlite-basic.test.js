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
(0, node_test_1.describe)('SqliteProvider - Projects', () => {
    let db;
    let dbPath;
    (0, node_test_1.beforeEach)(async () => {
        // Create temp file for each test
        dbPath = path.join('/tmp', `humanenv-test-${Date.now()}-${Math.random()}.db`);
        db = new sqlite_ts_1.SqliteProvider(dbPath);
        await db.connect();
    });
    (0, node_test_1.afterEach)(async () => {
        await db.disconnect();
        // Clean up temp file
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });
    (0, node_test_1.it)('createProject returns id', async () => {
        const result = await db.createProject('test-project');
        node_assert_1.default.ok(result.id);
        node_assert_1.default.strictEqual(typeof result.id, 'string');
    });
    (0, node_test_1.it)('getProject retrieves by name', async () => {
        await db.createProject('my-app');
        const project = await db.getProject('my-app');
        node_assert_1.default.ok(project);
        node_assert_1.default.strictEqual(project?.name, 'my-app');
        node_assert_1.default.ok(project?.createdAt);
    });
    (0, node_test_1.it)('getProject returns null for missing project', async () => {
        const project = await db.getProject('nonexistent');
        node_assert_1.default.strictEqual(project, null);
    });
    (0, node_test_1.it)('listProjects returns all projects sorted by date', async () => {
        await db.createProject('project-a');
        await new Promise(r => setTimeout(r, 10));
        await db.createProject('project-b');
        const projects = await db.listProjects();
        node_assert_1.default.strictEqual(projects.length, 2);
        // Most recent first
        node_assert_1.default.strictEqual(projects[0].name, 'project-b');
        node_assert_1.default.strictEqual(projects[1].name, 'project-a');
    });
    (0, node_test_1.it)('deleteProject removes project', async () => {
        await db.createProject('to-delete');
        const project = await db.getProject('to-delete');
        node_assert_1.default.ok(project);
        await db.deleteProject(project.id);
        const afterDelete = await db.getProject('to-delete');
        node_assert_1.default.strictEqual(afterDelete, null);
    });
    (0, node_test_1.it)('deleteProject cascades to envs', async () => {
        const project = await db.createProject('cascade-test');
        await db.createEnv(project.id, 'KEY1', 'encrypted-value-1');
        await db.createEnv(project.id, 'KEY2', 'encrypted-value-2');
        await db.deleteProject(project.id);
        const envs = await db.listEnvs(project.id);
        node_assert_1.default.strictEqual(envs.length, 0);
    });
    (0, node_test_1.it)('rejects duplicate project names', async () => {
        await db.createProject('duplicate');
        try {
            await db.createProject('duplicate');
            node_assert_1.default.fail('Should have failed');
        }
        catch (err) {
            node_assert_1.default.ok(err.message.includes('UNIQUE constraint failed'));
        }
    });
});
(0, node_test_1.describe)('SqliteProvider - Envs', () => {
    let db;
    let dbPath;
    let projectId;
    (0, node_test_1.beforeEach)(async () => {
        dbPath = path.join('/tmp', `humanenv-test-${Date.now()}-${Math.random()}.db`);
        db = new sqlite_ts_1.SqliteProvider(dbPath);
        await db.connect();
        const project = await db.createProject('env-test-project');
        projectId = project.id;
    });
    (0, node_test_1.afterEach)(async () => {
        await db.disconnect();
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });
    (0, node_test_1.it)('createEnv stores encrypted value', async () => {
        const result = await db.createEnv(projectId, 'API_KEY', 'encrypted-abc123');
        node_assert_1.default.ok(result.id);
    });
    (0, node_test_1.it)('getEnv retrieves encrypted value', async () => {
        await db.createEnv(projectId, 'SECRET', 'encrypted-xyz');
        const env = await db.getEnv(projectId, 'SECRET');
        node_assert_1.default.ok(env);
        node_assert_1.default.strictEqual(env?.encryptedValue, 'encrypted-xyz');
    });
    (0, node_test_1.it)('getEnv returns null for missing key', async () => {
        const env = await db.getEnv(projectId, 'MISSING');
        node_assert_1.default.strictEqual(env, null);
    });
    (0, node_test_1.it)('updateEnv updates existing key', async () => {
        await db.createEnv(projectId, 'KEY', 'old-value');
        await db.updateEnv(projectId, 'KEY', 'new-value');
        const env = await db.getEnv(projectId, 'KEY');
        node_assert_1.default.strictEqual(env?.encryptedValue, 'new-value');
    });
    (0, node_test_1.it)('listEnvs returns all envs for project', async () => {
        await db.createEnv(projectId, 'KEY_A', 'val-a');
        await db.createEnv(projectId, 'KEY_B', 'val-b');
        const envs = await db.listEnvs(projectId);
        node_assert_1.default.strictEqual(envs.length, 2);
        // Sorted by key
        node_assert_1.default.strictEqual(envs[0].key, 'KEY_A');
        node_assert_1.default.strictEqual(envs[1].key, 'KEY_B');
    });
    (0, node_test_1.it)('deleteEnv removes env', async () => {
        await db.createEnv(projectId, 'TO_DELETE', 'value');
        await db.deleteEnv(projectId, 'TO_DELETE');
        const env = await db.getEnv(projectId, 'TO_DELETE');
        node_assert_1.default.strictEqual(env, null);
    });
});
(0, node_test_1.describe)('SqliteProvider - PK Hash', () => {
    let db;
    let dbPath;
    (0, node_test_1.beforeEach)(async () => {
        dbPath = path.join('/tmp', `humanenv-test-${Date.now()}-${Math.random()}.db`);
        db = new sqlite_ts_1.SqliteProvider(dbPath);
        await db.connect();
    });
    (0, node_test_1.afterEach)(async () => {
        await db.disconnect();
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });
    (0, node_test_1.it)('storePkHash and getPkHash roundtrip', async () => {
        const testHash = 'abc123def456789';
        await db.storePkHash(testHash);
        const retrieved = await db.getPkHash();
        node_assert_1.default.strictEqual(retrieved, testHash);
    });
    (0, node_test_1.it)('getPkHash returns null when not set', async () => {
        const hash = await db.getPkHash();
        node_assert_1.default.strictEqual(hash, null);
    });
    (0, node_test_1.it)('storePkHash updates existing hash', async () => {
        await db.storePkHash('hash-v1');
        await db.storePkHash('hash-v2');
        const retrieved = await db.getPkHash();
        node_assert_1.default.strictEqual(retrieved, 'hash-v2');
    });
});
//# sourceMappingURL=db-sqlite-basic.test.js.map