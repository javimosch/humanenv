import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { SqliteProvider } from '../src/db/sqlite.ts'
import * as fs from 'node:fs'
import * as path from 'node:path'

let db: SqliteProvider
let dbPath: string

function setup() {
  dbPath = path.join('/tmp', `humanenv-test-${Date.now()}-${Math.random()}.db`)
  db = new SqliteProvider(dbPath)
}

async function teardown() {
  await db.disconnect()
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
}

// ============================================================
// updateProject
// ============================================================

describe('SqliteProvider - updateProject', () => {
  beforeEach(async () => { setup(); await db.connect() })
  afterEach(teardown)

  it('sets fingerprintVerification to false', async () => {
    const { id } = await db.createProject('proj-fp')
    await db.updateProject(id, { fingerprintVerification: false })
    const proj = await db.getProject('proj-fp')
    assert.strictEqual(proj!.fingerprintVerification, false)
  })

  it('sets requireApiKey to true', async () => {
    const { id } = await db.createProject('proj-api')
    await db.updateProject(id, { requireApiKey: true })
    const proj = await db.getProject('proj-api')
    assert.strictEqual(proj!.requireApiKey, true)
  })

  it('sets both fields at once', async () => {
    const { id } = await db.createProject('proj-both')
    await db.updateProject(id, { fingerprintVerification: false, requireApiKey: true })
    const proj = await db.getProject('proj-both')
    assert.strictEqual(proj!.fingerprintVerification, false)
    assert.strictEqual(proj!.requireApiKey, true)
  })

  it('getProject returns correct boolean defaults', async () => {
    await db.createProject('proj-defaults')
    const proj = await db.getProject('proj-defaults')
    assert.strictEqual(proj!.fingerprintVerification, true)
    assert.strictEqual(proj!.requireApiKey, false)
  })
})

// ============================================================
// listEnvsWithValues
// ============================================================

describe('SqliteProvider - listEnvsWithValues', () => {
  let projectId: string
  beforeEach(async () => {
    setup(); await db.connect()
    projectId = (await db.createProject('env-vals-proj')).id
  })
  afterEach(teardown)

  it('returns encrypted values and all fields', async () => {
    await db.createEnv(projectId, 'DB_HOST', 'enc-host')
    await db.createEnv(projectId, 'DB_PASS', 'enc-pass')

    const envs = await db.listEnvsWithValues(projectId)
    assert.strictEqual(envs.length, 2)
    assert.strictEqual(envs[0].key, 'DB_HOST')
    assert.strictEqual(envs[0].encryptedValue, 'enc-host')
    assert.strictEqual(envs[1].key, 'DB_PASS')
    assert.strictEqual(envs[1].encryptedValue, 'enc-pass')
  })

  it('returns empty array when no envs', async () => {
    const envs = await db.listEnvsWithValues(projectId)
    assert.deepStrictEqual(envs, [])
  })
})

// ============================================================
// API Keys
// ============================================================

describe('SqliteProvider - API Keys', () => {
  let projectId: string
  beforeEach(async () => {
    setup(); await db.connect()
    projectId = (await db.createProject('apikey-proj')).id
  })
  afterEach(teardown)

  it('createApiKey returns id', async () => {
    const result = await db.createApiKey(projectId, 'enc-key', 'plain-key-123')
    assert.ok(result.id)
    assert.strictEqual(typeof result.id, 'string')
  })

  it('createApiKey with TTL sets expiresAt', async () => {
    const before = Date.now()
    await db.createApiKey(projectId, 'enc-key', 'plain-ttl', 3600)
    const keys = await db.listApiKeys(projectId)
    assert.strictEqual(keys.length, 1)
    assert.strictEqual(keys[0].ttl, 3600)
    assert.ok(keys[0].expiresAt! >= before + 3600 * 1000)
  })

  it('createApiKey without TTL has null expiresAt', async () => {
    await db.createApiKey(projectId, 'enc-key', 'plain-nottl')
    const keys = await db.listApiKeys(projectId)
    assert.strictEqual(keys[0].ttl, null)
    assert.strictEqual(keys[0].expiresAt, null)
  })

  it('createApiKey with name stores name', async () => {
    await db.createApiKey(projectId, 'enc-key', 'plain-named', undefined, 'my-key')
    const keys = await db.listApiKeys(projectId)
    assert.strictEqual(keys[0].name, 'my-key')
  })

  it('getApiKey returns valid key by plain value', async () => {
    const { id } = await db.createApiKey(projectId, 'enc-key', 'plain-lookup')
    const result = await db.getApiKey(projectId, 'plain-lookup')
    assert.ok(result)
    assert.strictEqual(result!.id, id)
  })

  it('getApiKey returns null for expired key', async () => {
    await db.createApiKey(projectId, 'enc-key', 'plain-expired', 1)
    // Manually set expires_at in the past to guarantee expiry
    const lookupHash = (await import('node:crypto')).createHash('sha256').update('plain-expired').digest('hex')
    ;(db as any).db.prepare('UPDATE api_keys SET expires_at = ? WHERE lookup_hash = ?').run(Date.now() - 10000, lookupHash)
    const result = await db.getApiKey(projectId, 'plain-expired')
    assert.strictEqual(result, null)
  })

  it('getApiKey returns null for unknown key', async () => {
    const result = await db.getApiKey(projectId, 'nonexistent')
    assert.strictEqual(result, null)
  })

  it('getApiKey returns key with no expiry', async () => {
    const { id } = await db.createApiKey(projectId, 'enc-key', 'plain-noexpiry')
    const result = await db.getApiKey(projectId, 'plain-noexpiry')
    assert.ok(result)
    assert.strictEqual(result!.id, id)
    assert.strictEqual(result!.expiresAt, null)
  })

  it('listApiKeys returns masked preview', async () => {
    await db.createApiKey(projectId, 'enc-key', 'plain-preview-key', 7200, 'prod-key')
    const keys = await db.listApiKeys(projectId)
    assert.strictEqual(keys.length, 1)
    assert.ok(keys[0].maskedPreview.endsWith('...'))
    assert.strictEqual(keys[0].maskedPreview.length, 11) // 8 chars + '...'
    assert.strictEqual(keys[0].name, 'prod-key')
    assert.strictEqual(keys[0].ttl, 7200)
    assert.ok(keys[0].createdAt)
  })

  it('revokeApiKey removes key', async () => {
    const { id } = await db.createApiKey(projectId, 'enc-key', 'plain-revoke')
    await db.revokeApiKey(projectId, id)
    const result = await db.getApiKey(projectId, 'plain-revoke')
    assert.strictEqual(result, null)
  })

  it('updateApiKeyLastUsed sets timestamp', async () => {
    const { id } = await db.createApiKey(projectId, 'enc-key', 'plain-used')
    const ts = Date.now()
    await db.updateApiKeyLastUsed(id, ts)
    const keys = await db.listApiKeys(projectId)
    assert.strictEqual(keys[0].lastUsed, ts)
  })
})

// ============================================================
// Whitelist
// ============================================================

describe('SqliteProvider - Whitelist', () => {
  let projectId: string
  beforeEach(async () => {
    setup(); await db.connect()
    projectId = (await db.createProject('wl-proj')).id
  })
  afterEach(teardown)

  it('createWhitelistEntry returns id', async () => {
    const result = await db.createWhitelistEntry(projectId, 'fp-abc', 'pending')
    assert.ok(result.id)
    assert.strictEqual(typeof result.id, 'string')
  })

  it('getWhitelistEntry returns status', async () => {
    await db.createWhitelistEntry(projectId, 'fp-get', 'approved')
    const result = await db.getWhitelistEntry(projectId, 'fp-get')
    assert.ok(result)
    assert.strictEqual(result!.status, 'approved')
  })

  it('getWhitelistEntry returns null for unknown fingerprint', async () => {
    const result = await db.getWhitelistEntry(projectId, 'fp-unknown')
    assert.strictEqual(result, null)
  })

  it('listWhitelistEntries returns all entries sorted by date', async () => {
    await db.createWhitelistEntry(projectId, 'fp-1', 'pending')
    await new Promise(r => setTimeout(r, 10))
    await db.createWhitelistEntry(projectId, 'fp-2', 'approved')

    const entries = await db.listWhitelistEntries(projectId)
    assert.strictEqual(entries.length, 2)
    assert.strictEqual(entries[0].fingerprint, 'fp-2')
    assert.strictEqual(entries[0].status, 'approved')
    assert.strictEqual(entries[1].fingerprint, 'fp-1')
    assert.strictEqual(entries[1].status, 'pending')
  })

  it('updateWhitelistStatus changes status', async () => {
    const { id } = await db.createWhitelistEntry(projectId, 'fp-update', 'pending')
    await db.updateWhitelistStatus(id, 'rejected')
    const result = await db.getWhitelistEntry(projectId, 'fp-update')
    assert.strictEqual(result!.status, 'rejected')
  })

  it('createWhitelistEntry upserts on same project+fingerprint', async () => {
    await db.createWhitelistEntry(projectId, 'fp-dup', 'pending')
    await db.createWhitelistEntry(projectId, 'fp-dup', 'approved')
    const result = await db.getWhitelistEntry(projectId, 'fp-dup')
    assert.strictEqual(result!.status, 'approved')
    const entries = await db.listWhitelistEntries(projectId)
    assert.strictEqual(entries.length, 1)
  })
})

// ============================================================
// Global Settings
// ============================================================

describe('SqliteProvider - Global Settings', () => {
  beforeEach(async () => { setup(); await db.connect() })
  afterEach(teardown)

  it('storeGlobalSetting and getGlobalSetting roundtrip', async () => {
    await db.storeGlobalSetting('temporal_pk_salt', 'salt-xyz')
    const result = await db.getGlobalSetting('temporal_pk_salt')
    assert.strictEqual(result, 'salt-xyz')
  })

  it('getGlobalSetting returns null when not set', async () => {
    const result = await db.getGlobalSetting('nonexistent_key')
    assert.strictEqual(result, null)
  })

  it('storeGlobalSetting updates existing value', async () => {
    await db.storeGlobalSetting('my_key', 'v1')
    await db.storeGlobalSetting('my_key', 'v2')
    const result = await db.getGlobalSetting('my_key')
    assert.strictEqual(result, 'v2')
  })
})

// ============================================================
// Cascade deletes (extended)
// ============================================================

describe('SqliteProvider - deleteProject cascades', () => {
  beforeEach(async () => { setup(); await db.connect() })
  afterEach(teardown)

  it('cascades to api_keys', async () => {
    const { id } = await db.createProject('cascade-keys')
    await db.createApiKey(id, 'enc-1', 'plain-1')
    await db.createApiKey(id, 'enc-2', 'plain-2')

    await db.deleteProject(id)
    const keys = await db.listApiKeys(id)
    assert.strictEqual(keys.length, 0)
  })

  it('cascades to whitelist', async () => {
    const { id } = await db.createProject('cascade-wl')
    await db.createWhitelistEntry(id, 'fp-1', 'approved')
    await db.createWhitelistEntry(id, 'fp-2', 'pending')

    await db.deleteProject(id)
    const entries = await db.listWhitelistEntries(id)
    assert.strictEqual(entries.length, 0)
  })
})
