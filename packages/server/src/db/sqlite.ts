import BetterSqlite3 from 'better-sqlite3'
import { IDatabaseProvider } from './interface'
import crypto from 'node:crypto'

export class SqliteProvider implements IDatabaseProvider {
  private db!: BetterSqlite3.Database

  constructor(private dbPath: string) {}

  async connect(): Promise<void> {
    this.db = new BetterSqlite3(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initTables()
  }

  async disconnect(): Promise<void> {
    this.db.close()
  }

  private initTables(): void {
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
        api_mode_only INTEGER NOT NULL DEFAULT 0,
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
    `)
    // Migration: add fingerprint_verification column to existing databases
    try { this.db.prepare('ALTER TABLE projects ADD COLUMN fingerprint_verification INTEGER NOT NULL DEFAULT 1').run() } catch {}
    // Migration: add require_api_key column to existing databases
    try { this.db.prepare('ALTER TABLE projects ADD COLUMN require_api_key INTEGER NOT NULL DEFAULT 0').run() } catch {}
    // Migration: add name column to api_keys
    try { this.db.prepare('ALTER TABLE api_keys ADD COLUMN name TEXT').run() } catch {}
    // Migration: add last_used column to api_keys
    try { this.db.prepare('ALTER TABLE api_keys ADD COLUMN last_used INTEGER').run() } catch {}
  }

  async createProject(name: string): Promise<{ id: string }> {
    const id = crypto.randomUUID()
    this.db.prepare('INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)').run(id, name, Date.now())
    return { id }
  }

  async getProject(name: string): Promise<{ id: string; name: string; createdAt: number; fingerprintVerification: boolean; requireApiKey: boolean } | null> {
    const row = this.db.prepare('SELECT id, name, fingerprint_verification, require_api_key, created_at FROM projects WHERE name = ?').get(name) as any
    return row ? { id: row.id, name: row.name, createdAt: row.created_at, fingerprintVerification: !!row.fingerprint_verification, requireApiKey: !!row.require_api_key } : null
  }

  async listProjects(): Promise<Array<{ id: string; name: string; createdAt: number }>> {
    const rows = this.db.prepare('SELECT id, name, created_at FROM projects ORDER BY created_at DESC').all() as any[]
    return rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at }))
  }

  async deleteProject(id: string): Promise<void> {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM envs WHERE project_id = ?').run(id)
      this.db.prepare('DELETE FROM api_keys WHERE project_id = ?').run(id)
      this.db.prepare('DELETE FROM whitelist WHERE project_id = ?').run(id)
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    })
    tx()
  }

  async updateProject(id: string, data: { fingerprintVerification?: boolean; requireApiKey?: boolean }): Promise<void> {
    if (data.fingerprintVerification !== undefined) {
      this.db.prepare('UPDATE projects SET fingerprint_verification = ? WHERE id = ?').run(data.fingerprintVerification ? 1 : 0, id)
    }
    if (data.requireApiKey !== undefined) {
      this.db.prepare('UPDATE projects SET require_api_key = ? WHERE id = ?').run(data.requireApiKey ? 1 : 0, id)
    }
  }

  async createEnv(projectId: string, key: string, encryptedValue: string, apiModeOnly: boolean): Promise<{ id: string }> {
    const id = crypto.randomUUID()
    this.db.prepare('INSERT OR REPLACE INTO envs (id, project_id, key, encrypted_value, api_mode_only, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, projectId, key, encryptedValue, apiModeOnly ? 1 : 0, Date.now()
    )
    return { id }
  }

  async getEnv(projectId: string, key: string): Promise<{ encryptedValue: string; apiModeOnly: boolean } | null> {
    const row = this.db.prepare('SELECT encrypted_value, api_mode_only FROM envs WHERE project_id = ? AND key = ?').get(projectId, key) as any
    return row ? { encryptedValue: row.encrypted_value, apiModeOnly: !!row.api_mode_only } : null
  }

  async listEnvs(projectId: string): Promise<Array<{ id: string; key: string; apiModeOnly: boolean; createdAt: number }>> {
    const rows = this.db.prepare('SELECT id, key, api_mode_only, created_at FROM envs WHERE project_id = ? ORDER BY key').all(projectId) as any[]
    return rows.map(r => ({ id: r.id, key: r.key, apiModeOnly: !!r.api_mode_only, createdAt: r.created_at }))
  }

  async updateEnv(projectId: string, key: string, encryptedValue: string, apiModeOnly: boolean): Promise<void> {
    this.db.prepare('UPDATE envs SET encrypted_value = ?, api_mode_only = ? WHERE project_id = ? AND key = ?').run(
      encryptedValue, apiModeOnly ? 1 : 0, projectId, key
    )
  }

  async deleteEnv(projectId: string, key: string): Promise<void> {
    this.db.prepare('DELETE FROM envs WHERE project_id = ? AND key = ?').run(projectId, key)
  }

  async createApiKey(projectId: string, encryptedValue: string, plainValue: string, ttl?: number, name?: string): Promise<{ id: string }> {
    const id = crypto.randomUUID()
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined
    const lookupHash = crypto.createHash('sha256').update(plainValue).digest('hex')
    this.db.prepare('INSERT INTO api_keys (id, project_id, name, encrypted_value, lookup_hash, ttl, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, projectId, name ?? null, encryptedValue, lookupHash, ttl ?? null, expiresAt ?? null, Date.now()
    )
    return { id }
  }

  async getApiKey(projectId: string, plainValue: string): Promise<{ id: string; expiresAt?: number } | null> {
    const lookupHash = crypto.createHash('sha256').update(plainValue).digest('hex')
    const row = this.db.prepare('SELECT id, lookup_hash, expires_at FROM api_keys WHERE project_id = ? AND lookup_hash = ?').get(projectId, lookupHash) as any
    if (!row) return null
    if (row.expires_at && row.expires_at < Date.now()) return null
    return { id: row.id, expiresAt: row.expires_at }
  }

  async listApiKeys(projectId: string): Promise<Array<{ id: string; maskedPreview: string; ttl?: number; expiresAt?: number; createdAt: number; name?: string; lastUsed?: number }>> {
    const rows = this.db.prepare('SELECT id, name, lookup_hash, ttl, expires_at, last_used, created_at FROM api_keys WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[]
    return rows.map(r => ({
      id: r.id,
      name: r.name || undefined,
      maskedPreview: r.lookup_hash.slice(0, 8) + '...',
      ttl: r.ttl,
      expiresAt: r.expires_at,
      lastUsed: r.last_used ?? undefined,
      createdAt: r.created_at,
    }))
  }

  async revokeApiKey(projectId: string, id: string): Promise<void> {
    this.db.prepare('DELETE FROM api_keys WHERE id = ? AND project_id = ?').run(id, projectId)
  }

  async updateApiKeyLastUsed(id: string, timestamp: number): Promise<void> {
    this.db.prepare('UPDATE api_keys SET last_used = ? WHERE id = ?').run(timestamp, id)
  }

  async createWhitelistEntry(projectId: string, fingerprint: string, status: 'pending' | 'approved' | 'rejected'): Promise<{ id: string }> {
    const id = crypto.randomUUID()
    this.db.prepare('INSERT OR REPLACE INTO whitelist (id, project_id, fingerprint, status, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id, projectId, fingerprint, status, Date.now()
    )
    return { id }
  }

  async getWhitelistEntry(projectId: string, fingerprint: string): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' } | null> {
    const row = this.db.prepare('SELECT id, status FROM whitelist WHERE project_id = ? AND fingerprint = ?').get(projectId, fingerprint) as any
    return row ? { id: row.id, status: row.status } : null
  }

  async listWhitelistEntries(projectId: string): Promise<Array<{ id: string; fingerprint: string; status: 'pending' | 'approved' | 'rejected'; createdAt: number }>> {
    const rows = this.db.prepare('SELECT id, fingerprint, status, created_at FROM whitelist WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[]
    return rows.map(r => ({ id: r.id, fingerprint: r.fingerprint, status: r.status, createdAt: r.created_at }))
  }

  async updateWhitelistStatus(id: string, status: 'approved' | 'rejected'): Promise<void> {
    this.db.prepare('UPDATE whitelist SET status = ? WHERE id = ?').run(status, id)
  }

  async storePkHash(hash: string): Promise<void> {
    this.db.prepare('INSERT OR REPLACE INTO server_config (key, value) VALUES (?, ?)').run('pk_hash', hash)
  }

  async getPkHash(): Promise<string | null> {
    const row = this.db.prepare('SELECT value FROM server_config WHERE key = ?').get('pk_hash') as { value: string } | undefined
    return row?.value ?? null
  }
}
