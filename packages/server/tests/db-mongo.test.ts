import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { MongoProvider } from '../src/db/mongo.ts'
import { ErrorCode } from 'humanenv-shared'

// ============================================================
// Mock MongoDB primitives
// ============================================================

type MockDoc = Record<string, any>
type MockFilter = Record<string, any>

class MockCursor {
  constructor(private docs: MockDoc[]) {}
  sort(_spec: Record<string, number>) { return this }
  async toArray() { return this.docs }
}

class MockCollection {
  docs: MockDoc[] = []
  lastInsert: MockDoc | null = null
  lastUpdate: { filter: MockFilter; update: any; opts?: any } | null = null
  lastDelete: MockFilter | null = null
  lastDeleteMany: MockFilter | null = null
  findOneResult: MockDoc | null = null
  findResult: MockDoc[] = []

  createIndex(_keys: any, _opts?: any) { return 'mock-index' }

  async insertOne(doc: MockDoc) {
    this.lastInsert = doc
    this.docs.push(doc)
    return { insertedId: 'mock-inserted-id' }
  }

  async findOne(filter: MockFilter) {
    return this.findOneResult
  }

  find(_filter?: MockFilter) {
    return new MockCursor(this.findResult)
  }

  async updateOne(filter: MockFilter, update: any, opts?: any) {
    this.lastUpdate = { filter, update, opts }
    return { modifiedCount: 1 }
  }

  async deleteOne(filter: MockFilter) {
    this.lastDelete = filter
    return { deletedCount: 1 }
  }

  async deleteMany(filter: MockFilter) {
    this.lastDeleteMany = filter
    return { deletedCount: 0 }
  }
}

class MockDb {
  collections: Record<string, MockCollection> = {}
  collection(name: string): MockCollection {
    if (!this.collections[name]) this.collections[name] = new MockCollection()
    return this.collections[name]
  }
}

function setupProvider(): { provider: MongoProvider; mockDb: MockDb } {
  const provider = new MongoProvider('mongodb://localhost:27017')
  const mockDb = new MockDb()
  ;(provider as any).db = mockDb
  ;(provider as any).client = { close: async () => {} }
  return { provider, mockDb }
}

// ============================================================
// col() helper
// ============================================================

describe('MongoProvider col()', () => {
  it('throws DB_OPERATION_FAILED when db is null', () => {
    const provider = new MongoProvider('mongodb://localhost:27017')
    assert.throws(
      () => (provider as any).col('projects'),
      (err: any) => err instanceof Error && err.code === ErrorCode.DB_OPERATION_FAILED
    )
  })

  it('returns collection when db is set', () => {
    const { provider, mockDb } = setupProvider()
    const col = (provider as any).col('projects')
    assert.ok(col)
    assert.strictEqual(col, mockDb.collection('projects'))
  })
})

// ============================================================
// Disconnect
// ============================================================

describe('MongoProvider disconnect', () => {
  it('closes client and clears interval', async () => {
    const { provider } = setupProvider()
    let closeCalled = false
    ;(provider as any).client = { close: async () => { closeCalled = true } }
    const timer = setInterval(() => {}, 100000)
    ;(provider as any).reconnectInterval = timer

    await provider.disconnect()
    assert.strictEqual(closeCalled, true)
    // clearInterval is called (timer is destroyed)
    assert.strictEqual(timer._destroyed, true)
  })

  it('handles null client gracefully', async () => {
    const provider = new MongoProvider('mongodb://localhost:27017')
    ;(provider as any).client = null
    await provider.disconnect() // should not throw
  })
})

// ============================================================
// Projects
// ============================================================

describe('MongoProvider Projects', () => {
  let provider: MongoProvider
  let mockDb: MockDb

  beforeEach(() => {
    const setup = setupProvider()
    provider = setup.provider
    mockDb = setup.mockDb
  })

  it('createProject inserts doc and returns id', async () => {
    const result = await provider.createProject('my-app')
    assert.ok(result.id)
    assert.strictEqual(typeof result.id, 'string')
    const col = mockDb.collection('projects')
    assert.strictEqual(col.lastInsert?.name, 'my-app')
    assert.ok(col.lastInsert?.createdAt)
  })

  it('getProject returns mapped doc with defaults', async () => {
    const col = mockDb.collection('projects')
    col.findOneResult = { id: 'p1', name: 'app', createdAt: 1000 }

    const result = await provider.getProject('app')
    assert.ok(result)
    assert.strictEqual(result!.id, 'p1')
    assert.strictEqual(result!.name, 'app')
    assert.strictEqual(result!.fingerprintVerification, true)
    assert.strictEqual(result!.requireApiKey, false)
  })

  it('getProject returns null when not found', async () => {
    mockDb.collection('projects').findOneResult = null
    const result = await provider.getProject('nonexistent')
    assert.strictEqual(result, null)
  })

  it('getProject respects explicit fingerprintVerification=false', async () => {
    mockDb.collection('projects').findOneResult = {
      id: 'p2', name: 'strict', createdAt: 2000,
      fingerprintVerification: false, requireApiKey: true,
    }
    const result = await provider.getProject('strict')
    assert.strictEqual(result!.fingerprintVerification, false)
    assert.strictEqual(result!.requireApiKey, true)
  })

  it('listProjects returns array from cursor', async () => {
    mockDb.collection('projects').findResult = [
      { id: 'p1', name: 'alpha', createdAt: 1000 },
      { id: 'p2', name: 'beta', createdAt: 2000 },
    ]
    const result = await provider.listProjects()
    assert.strictEqual(result.length, 2)
  })

  it('deleteProject cascades to envs, apiKeys, whitelist', async () => {
    await provider.deleteProject('proj-1')
    assert.deepStrictEqual(mockDb.collection('projects').lastDelete, { id: 'proj-1' })
    assert.deepStrictEqual(mockDb.collection('envs').lastDeleteMany, { projectId: 'proj-1' })
    assert.deepStrictEqual(mockDb.collection('apiKeys').lastDeleteMany, { projectId: 'proj-1' })
    assert.deepStrictEqual(mockDb.collection('whitelist').lastDeleteMany, { projectId: 'proj-1' })
  })

  it('updateProject sets only provided fields', async () => {
    await provider.updateProject('proj-1', { fingerprintVerification: false })
    const col = mockDb.collection('projects')
    assert.deepStrictEqual(col.lastUpdate?.filter, { id: 'proj-1' })
    assert.deepStrictEqual(col.lastUpdate?.update, { $set: { fingerprintVerification: false } })
  })

  it('updateProject skips call when no fields provided', async () => {
    await provider.updateProject('proj-1', {})
    assert.strictEqual(mockDb.collection('projects').lastUpdate, null)
  })
})

// ============================================================
// Envs
// ============================================================

describe('MongoProvider Envs', () => {
  let provider: MongoProvider
  let mockDb: MockDb

  beforeEach(() => {
    const setup = setupProvider()
    provider = setup.provider
    mockDb = setup.mockDb
  })

  it('createEnv upserts and returns id', async () => {
    const result = await provider.createEnv('p1', 'DB_HOST', 'enc-val', false)
    assert.ok(result.id)
    const col = mockDb.collection('envs')
    assert.deepStrictEqual(col.lastUpdate?.filter, { projectId: 'p1', key: 'DB_HOST' })
    assert.strictEqual(col.lastUpdate?.opts?.upsert, true)
  })

  it('getEnv returns mapped fields', async () => {
    mockDb.collection('envs').findOneResult = {
      id: 'e1', projectId: 'p1', key: 'SECRET',
      encryptedValue: 'enc-xyz', apiModeOnly: true, createdAt: 1000,
    }
    const result = await provider.getEnv('p1', 'SECRET')
    assert.ok(result)
    assert.strictEqual(result!.encryptedValue, 'enc-xyz')
    assert.strictEqual(result!.apiModeOnly, true)
  })

  it('getEnv returns null when not found', async () => {
    mockDb.collection('envs').findOneResult = null
    const result = await provider.getEnv('p1', 'MISSING')
    assert.strictEqual(result, null)
  })

  it('listEnvs returns mapped array', async () => {
    mockDb.collection('envs').findResult = [
      { id: 'e1', key: 'A_KEY', apiModeOnly: false, createdAt: 1000 },
      { id: 'e2', key: 'B_KEY', apiModeOnly: true, createdAt: 2000 },
    ]
    const result = await provider.listEnvs('p1')
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0].key, 'A_KEY')
    assert.strictEqual(result[1].apiModeOnly, true)
  })

  it('deleteEnv removes by projectId and key', async () => {
    await provider.deleteEnv('p1', 'OLD_KEY')
    assert.deepStrictEqual(mockDb.collection('envs').lastDelete, { projectId: 'p1', key: 'OLD_KEY' })
  })
})

// ============================================================
// API Keys
// ============================================================

describe('MongoProvider API Keys', () => {
  let provider: MongoProvider
  let mockDb: MockDb

  beforeEach(() => {
    const setup = setupProvider()
    provider = setup.provider
    mockDb = setup.mockDb
  })

  it('createApiKey with ttl sets expiresAt', async () => {
    const before = Date.now()
    const result = await provider.createApiKey('p1', 'enc-key', 'plain-key-123', 3600)
    assert.ok(result.id)

    const col = mockDb.collection('apiKeys')
    assert.ok(col.lastInsert)
    assert.strictEqual(col.lastInsert.projectId, 'p1')
    assert.strictEqual(col.lastInsert.ttl, 3600)
    assert.ok(col.lastInsert.expiresAt >= before + 3600 * 1000)
    assert.strictEqual(col.lastInsert.lookupHash, crypto.createHash('sha256').update('plain-key-123').digest('hex'))
  })

  it('createApiKey without ttl sets null expiresAt', async () => {
    await provider.createApiKey('p1', 'enc-key', 'plain-key-456')
    const col = mockDb.collection('apiKeys')
    assert.strictEqual(col.lastInsert?.ttl, null)
    assert.strictEqual(col.lastInsert?.expiresAt, null)
  })

  it('createApiKey with name stores name', async () => {
    await provider.createApiKey('p1', 'enc-key', 'plain-key', undefined, 'my-key-name')
    assert.strictEqual(mockDb.collection('apiKeys').lastInsert?.name, 'my-key-name')
  })

  it('getApiKey returns null when not found', async () => {
    mockDb.collection('apiKeys').findOneResult = null
    const result = await provider.getApiKey('p1', 'unknown-key')
    assert.strictEqual(result, null)
  })

  it('getApiKey returns null for expired key', async () => {
    mockDb.collection('apiKeys').findOneResult = {
      id: 'k1', projectId: 'p1', expiresAt: Date.now() - 10000,
    }
    const result = await provider.getApiKey('p1', 'some-key')
    assert.strictEqual(result, null)
  })

  it('getApiKey returns valid key', async () => {
    mockDb.collection('apiKeys').findOneResult = {
      id: 'k1', projectId: 'p1', expiresAt: Date.now() + 60000,
    }
    const result = await provider.getApiKey('p1', 'some-key')
    assert.ok(result)
    assert.strictEqual(result!.id, 'k1')
  })

  it('getApiKey returns key with no expiresAt', async () => {
    mockDb.collection('apiKeys').findOneResult = {
      id: 'k2', projectId: 'p1', expiresAt: null,
    }
    const result = await provider.getApiKey('p1', 'some-key')
    assert.ok(result)
    assert.strictEqual(result!.id, 'k2')
  })

  it('listApiKeys returns masked preview', async () => {
    mockDb.collection('apiKeys').findResult = [
      { id: 'k1', lookupHash: 'abcdef1234567890', ttl: 3600, expiresAt: 9999, createdAt: 1000, name: 'prod-key', lastUsed: 5000 },
    ]
    const result = await provider.listApiKeys('p1')
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].maskedPreview, 'abcdef12...')
    assert.strictEqual(result[0].name, 'prod-key')
    assert.strictEqual(result[0].lastUsed, 5000)
  })

  it('revokeApiKey deletes by id and projectId', async () => {
    await provider.revokeApiKey('p1', 'k1')
    assert.deepStrictEqual(mockDb.collection('apiKeys').lastDelete, { id: 'k1', projectId: 'p1' })
  })

  it('updateApiKeyLastUsed sets timestamp', async () => {
    await provider.updateApiKeyLastUsed('k1', 12345)
    const col = mockDb.collection('apiKeys')
    assert.deepStrictEqual(col.lastUpdate?.filter, { id: 'k1' })
    assert.deepStrictEqual(col.lastUpdate?.update, { $set: { lastUsed: 12345 } })
  })
})

// ============================================================
// Whitelist
// ============================================================

describe('MongoProvider Whitelist', () => {
  let provider: MongoProvider
  let mockDb: MockDb

  beforeEach(() => {
    const setup = setupProvider()
    provider = setup.provider
    mockDb = setup.mockDb
  })

  it('createWhitelistEntry upserts and returns id', async () => {
    const result = await provider.createWhitelistEntry('p1', 'fp-abc', 'pending')
    assert.ok(result.id)
    const col = mockDb.collection('whitelist')
    assert.deepStrictEqual(col.lastUpdate?.filter, { projectId: 'p1', fingerprint: 'fp-abc' })
    assert.strictEqual(col.lastUpdate?.opts?.upsert, true)
  })

  it('getWhitelistEntry returns mapped doc', async () => {
    mockDb.collection('whitelist').findOneResult = { id: 'w1', status: 'approved' }
    const result = await provider.getWhitelistEntry('p1', 'fp-abc')
    assert.ok(result)
    assert.strictEqual(result!.id, 'w1')
    assert.strictEqual(result!.status, 'approved')
  })

  it('getWhitelistEntry returns null when not found', async () => {
    mockDb.collection('whitelist').findOneResult = null
    const result = await provider.getWhitelistEntry('p1', 'fp-unknown')
    assert.strictEqual(result, null)
  })

  it('updateWhitelistStatus updates by id', async () => {
    await provider.updateWhitelistStatus('w1', 'rejected')
    const col = mockDb.collection('whitelist')
    assert.deepStrictEqual(col.lastUpdate?.filter, { id: 'w1' })
    assert.deepStrictEqual(col.lastUpdate?.update, { $set: { status: 'rejected' } })
  })
})

// ============================================================
// PK Hash
// ============================================================

describe('MongoProvider PK Hash', () => {
  let provider: MongoProvider
  let mockDb: MockDb

  beforeEach(() => {
    const setup = setupProvider()
    provider = setup.provider
    mockDb = setup.mockDb
  })

  it('storePkHash upserts to serverConfig', async () => {
    await provider.storePkHash('abc123hash')
    const col = mockDb.collection('serverConfig')
    assert.deepStrictEqual(col.lastUpdate?.filter, { key: 'pk_hash' })
    assert.deepStrictEqual(col.lastUpdate?.update, { $set: { key: 'pk_hash', value: 'abc123hash' } })
    assert.strictEqual(col.lastUpdate?.opts?.upsert, true)
  })

  it('getPkHash returns value when found', async () => {
    mockDb.collection('serverConfig').findOneResult = { key: 'pk_hash', value: 'hash-val' }
    const result = await provider.getPkHash()
    assert.strictEqual(result, 'hash-val')
  })

  it('getPkHash returns null when not found', async () => {
    mockDb.collection('serverConfig').findOneResult = null
    const result = await provider.getPkHash()
    assert.strictEqual(result, null)
  })
})

// ============================================================
// Global Settings
// ============================================================

describe('MongoProvider Global Settings', () => {
  let provider: MongoProvider
  let mockDb: MockDb

  beforeEach(() => {
    const setup = setupProvider()
    provider = setup.provider
    mockDb = setup.mockDb
  })

  it('storeGlobalSetting upserts to serverConfig', async () => {
    await provider.storeGlobalSetting('temporal_pk_salt', 'salt-xyz')
    const col = mockDb.collection('serverConfig')
    assert.deepStrictEqual(col.lastUpdate?.filter, { key: 'temporal_pk_salt' })
    assert.deepStrictEqual(col.lastUpdate?.update, { $set: { key: 'temporal_pk_salt', value: 'salt-xyz' } })
  })

  it('getGlobalSetting returns value when found', async () => {
    mockDb.collection('serverConfig').findOneResult = { key: 'some_setting', value: 'val123' }
    const result = await provider.getGlobalSetting('some_setting')
    assert.strictEqual(result, 'val123')
  })

  it('getGlobalSetting returns null when not found', async () => {
    mockDb.collection('serverConfig').findOneResult = null
    const result = await provider.getGlobalSetting('missing_key')
    assert.strictEqual(result, null)
  })
})
