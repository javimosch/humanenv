"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDatabase = void 0;
exports.createLocalDatabase = createLocalDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_crypto_1 = __importDefault(require("node:crypto"));
class LocalDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    async connect() {
        this.db = new better_sqlite3_1.default(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.initTables();
    }
    async disconnect() {
        this.db.close();
    }
    initTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        fingerprint_verification INTEGER NOT NULL DEFAULT 1,
        require_api_key INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS envs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        key TEXT NOT NULL,
        encrypted_value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(project_id, key),
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT,
        encrypted_value TEXT NOT NULL,
        lookup_hash TEXT UNIQUE NOT NULL,
        ttl INTEGER,
        expires_at INTEGER,
        last_used INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
      CREATE TABLE IF NOT EXISTS whitelist (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        UNIQUE(project_id, fingerprint),
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );
      CREATE TABLE IF NOT EXISTS server_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
        try {
            this.db.prepare('ALTER TABLE projects ADD COLUMN fingerprint_verification INTEGER NOT NULL DEFAULT 1').run();
        }
        catch { }
        try {
            this.db.prepare('ALTER TABLE projects ADD COLUMN require_api_key INTEGER NOT NULL DEFAULT 0').run();
        }
        catch { }
        try {
            this.db.prepare('ALTER TABLE api_keys ADD COLUMN name TEXT').run();
        }
        catch { }
        try {
            this.db.prepare('ALTER TABLE api_keys ADD COLUMN last_used INTEGER').run();
        }
        catch { }
    }
    async createProject(name) {
        const id = node_crypto_1.default.randomUUID();
        this.db.prepare('INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)').run(id, name, Date.now());
        return { id };
    }
    async getProject(name) {
        const row = this.db.prepare('SELECT id, name, fingerprint_verification, require_api_key, created_at FROM projects WHERE name = ?').get(name);
        return row ? { id: row.id, name: row.name, createdAt: row.created_at, fingerprintVerification: !!row.fingerprint_verification, requireApiKey: !!row.require_api_key } : null;
    }
    async getProjectById(id) {
        const row = this.db.prepare('SELECT id, name, fingerprint_verification, require_api_key, created_at FROM projects WHERE id = ?').get(id);
        return row ? { id: row.id, name: row.name, createdAt: row.created_at, fingerprintVerification: !!row.fingerprint_verification, requireApiKey: !!row.require_api_key } : null;
    }
    async listProjects() {
        const rows = this.db.prepare('SELECT id, name, created_at FROM projects ORDER BY created_at DESC').all();
        return rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at }));
    }
    async deleteProject(id) {
        const tx = this.db.transaction(() => {
            this.db.prepare('DELETE FROM envs WHERE project_id = ?').run(id);
            this.db.prepare('DELETE FROM api_keys WHERE project_id = ?').run(id);
            this.db.prepare('DELETE FROM whitelist WHERE project_id = ?').run(id);
            this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        });
        tx();
    }
    async updateProject(id, data) {
        if (data.name !== undefined) {
            this.db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(data.name, id);
        }
        if (data.fingerprintVerification !== undefined) {
            this.db.prepare('UPDATE projects SET fingerprint_verification = ? WHERE id = ?').run(data.fingerprintVerification ? 1 : 0, id);
        }
        if (data.requireApiKey !== undefined) {
            this.db.prepare('UPDATE projects SET require_api_key = ? WHERE id = ?').run(data.requireApiKey ? 1 : 0, id);
        }
    }
    async createEnv(projectId, key, encryptedValue) {
        const id = node_crypto_1.default.randomUUID();
        this.db.prepare('INSERT OR REPLACE INTO envs (id, project_id, key, encrypted_value, created_at) VALUES (?, ?, ?, ?, ?)').run(id, projectId, key, encryptedValue, Date.now());
        return { id };
    }
    async getEnv(projectId, key) {
        const row = this.db.prepare('SELECT encrypted_value FROM envs WHERE project_id = ? AND key = ?').get(projectId, key);
        return row ? { encryptedValue: row.encrypted_value } : null;
    }
    async listEnvs(projectId) {
        const rows = this.db.prepare('SELECT id, key, created_at FROM envs WHERE project_id = ? ORDER BY key').all(projectId);
        return rows.map(r => ({ id: r.id, key: r.key, createdAt: r.created_at }));
    }
    async listEnvsWithValues(projectId) {
        const rows = this.db.prepare('SELECT id, key, encrypted_value, created_at FROM envs WHERE project_id = ? ORDER BY key').all(projectId);
        return rows.map(r => ({ id: r.id, key: r.key, encryptedValue: r.encrypted_value, createdAt: r.created_at }));
    }
    async updateEnv(projectId, key, encryptedValue) {
        this.db.prepare('UPDATE envs SET encrypted_value = ? WHERE project_id = ? AND key = ?').run(encryptedValue, projectId, key);
    }
    async deleteEnv(projectId, key) {
        this.db.prepare('DELETE FROM envs WHERE project_id = ? AND key = ?').run(projectId, key);
    }
    async createApiKey(projectId, encryptedValue, plainValue, ttl, name) {
        const id = node_crypto_1.default.randomUUID();
        const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
        const lookupHash = node_crypto_1.default.createHash('sha256').update(plainValue).digest('hex');
        this.db.prepare('INSERT INTO api_keys (id, project_id, name, encrypted_value, lookup_hash, ttl, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, projectId, name ?? null, encryptedValue, lookupHash, ttl ?? null, expiresAt ?? null, Date.now());
        return { id };
    }
    async getApiKey(projectId, plainValue) {
        const lookupHash = node_crypto_1.default.createHash('sha256').update(plainValue).digest('hex');
        const row = this.db.prepare('SELECT id, lookup_hash, expires_at FROM api_keys WHERE project_id = ? AND lookup_hash = ?').get(projectId, lookupHash);
        if (!row)
            return null;
        if (row.expires_at && row.expires_at < Date.now())
            return null;
        return { id: row.id, expiresAt: row.expires_at };
    }
    async listApiKeys(projectId) {
        const rows = this.db.prepare('SELECT id, name, lookup_hash, ttl, expires_at, last_used, created_at FROM api_keys WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
        return rows.map(r => ({
            id: r.id,
            name: r.name || undefined,
            maskedPreview: r.lookup_hash.slice(0, 8) + '...',
            ttl: r.ttl,
            expiresAt: r.expires_at,
            lastUsed: r.last_used ?? undefined,
            createdAt: r.created_at,
        }));
    }
    async revokeApiKey(projectId, id) {
        this.db.prepare('DELETE FROM api_keys WHERE id = ? AND project_id = ?').run(id, projectId);
    }
    async updateApiKeyLastUsed(id, timestamp) {
        this.db.prepare('UPDATE api_keys SET last_used = ? WHERE id = ?').run(timestamp, id);
    }
    async createWhitelistEntry(projectId, fingerprint, status) {
        const id = node_crypto_1.default.randomUUID();
        this.db.prepare('INSERT OR REPLACE INTO whitelist (id, project_id, fingerprint, status, created_at) VALUES (?, ?, ?, ?, ?)').run(id, projectId, fingerprint, status, Date.now());
        return { id };
    }
    async getWhitelistEntry(projectId, fingerprint) {
        const row = this.db.prepare('SELECT id, status FROM whitelist WHERE project_id = ? AND fingerprint = ?').get(projectId, fingerprint);
        return row ? { id: row.id, status: row.status } : null;
    }
    async listWhitelistEntries(projectId) {
        const rows = this.db.prepare('SELECT id, fingerprint, status, created_at FROM whitelist WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
        return rows.map(r => ({ id: r.id, fingerprint: r.fingerprint, status: r.status, createdAt: r.created_at }));
    }
    async updateWhitelistStatus(id, status) {
        this.db.prepare('UPDATE whitelist SET status = ? WHERE id = ?').run(status, id);
    }
    async storePkHash(hash) {
        this.db.prepare('INSERT OR REPLACE INTO server_config (key, value) VALUES (?, ?)').run('pk_hash', hash);
    }
    async getPkHash() {
        const row = this.db.prepare('SELECT value FROM server_config WHERE key = ?').get('pk_hash');
        return row?.value ?? null;
    }
    async storeGlobalSetting(key, value) {
        this.db.prepare('INSERT OR REPLACE INTO server_config (key, value) VALUES (?, ?)').run(key, value);
    }
    async getGlobalSetting(key) {
        const row = this.db.prepare('SELECT value FROM server_config WHERE key = ?').get(key);
        return row?.value ?? null;
    }
}
exports.LocalDatabase = LocalDatabase;
function createLocalDatabase(dbPath) {
    const db = new LocalDatabase(dbPath);
    return { db };
}
//# sourceMappingURL=local-db.js.map