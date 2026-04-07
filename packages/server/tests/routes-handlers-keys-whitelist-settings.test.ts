import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'http'
import { createApiKeysRouter, createWhitelistRouter, createGlobalSettingsRouter } from '../src/routes/index.ts'
import type { IDatabaseProvider } from '../src/db/interface.ts'
import type { PkManager } from '../src/pk-manager.ts'
import { createMockDb, createMockPk, startApp } from './route-test-helpers.ts'

// ============================================================
// API Keys Router
// ============================================================

describe('Route Handlers - API Keys', () => {
  let server: http.Server
  let base: string
  let db: IDatabaseProvider
  let pk: PkManager

  before(async () => {
    db = createMockDb()
    pk = createMockPk()
    const result = await startApp((app) => {
      app.use('/api/apikeys', createApiKeysRouter(db, pk))
    })
    server = result.server
    base = result.base
  })

  after(() => { server.close() })

  it('GET /project/:projectId returns list of API keys', async () => {
    db.listApiKeys = async () => [
      { id: 'k1', maskedPreview: 'abc12345...', createdAt: 1000 },
      { id: 'k2', maskedPreview: 'def67890...', ttl: 3600, expiresAt: 9999, createdAt: 2000 },
    ]
    const res = await fetch(`${base}/api/apikeys/project/proj-1`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[0].maskedPreview, 'abc12345...')
  })

  it('POST /project/:projectId creates key with auto-generated UUID', async () => {
    let storedArgs: any = null
    db.createApiKey = async (projectId, encryptedValue, plainValue, ttl, name) => {
      storedArgs = { projectId, encryptedValue, plainValue, ttl, name }
      return { id: 'key-auto' }
    }
    const res = await fetch(`${base}/api/apikeys/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 7200 }),
    })
    assert.strictEqual(res.status, 201)
    const data = await res.json()
    assert.strictEqual(data.id, 'key-auto')
    assert.ok(data.plainKey, 'should return generated plainKey')
    assert.strictEqual(storedArgs.ttl, 7200)
  })

  it('POST /project/:projectId creates key with provided plainKey', async () => {
    let storedPlain: string | null = null
    db.createApiKey = async (_projectId, _enc, plainValue) => {
      storedPlain = plainValue
      return { id: 'key-custom' }
    }
    const res = await fetch(`${base}/api/apikeys/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plainKey: 'my-custom-key-1234' }),
    })
    assert.strictEqual(res.status, 201)
    const data = await res.json()
    assert.strictEqual(data.plainKey, 'my-custom-key-1234')
    assert.strictEqual(storedPlain, 'my-custom-key-1234')
  })

  it('POST /project/:projectId creates key with name', async () => {
    let storedName: string | undefined
    db.createApiKey = async (_projectId, _enc, _plain, _ttl, name) => {
      storedName = name
      return { id: 'key-named' }
    }
    const res = await fetch(`${base}/api/apikeys/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'production-key' }),
    })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(storedName, 'production-key')
  })

  it('DELETE /project/:projectId/:id revokes API key', async () => {
    let revokedArgs: any = null
    db.revokeApiKey = async (projectId, id) => { revokedArgs = { projectId, id } }
    const res = await fetch(`${base}/api/apikeys/project/proj-1/key-to-revoke`, { method: 'DELETE' })
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.ok, true)
    assert.strictEqual(revokedArgs.projectId, 'proj-1')
    assert.strictEqual(revokedArgs.id, 'key-to-revoke')
  })
})

// ============================================================
// Whitelist Router
// ============================================================

describe('Route Handlers - Whitelist', () => {
  let server: http.Server
  let base: string
  let db: IDatabaseProvider

  before(async () => {
    db = createMockDb()
    const result = await startApp((app) => {
      app.use('/api/whitelist', createWhitelistRouter(db))
    })
    server = result.server
    base = result.base
  })

  after(() => { server.close() })

  it('GET /project/:projectId returns whitelist entries', async () => {
    db.listWhitelistEntries = async () => [
      { id: 'wl1', fingerprint: 'fp-aaa', status: 'approved', createdAt: 1000 },
      { id: 'wl2', fingerprint: 'fp-bbb', status: 'pending', createdAt: 2000 },
    ]
    const res = await fetch(`${base}/api/whitelist/project/proj-1`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[0].status, 'approved')
    assert.strictEqual(data[1].status, 'pending')
  })

  it('POST /project/:projectId creates entry with explicit status', async () => {
    let createdArgs: any = null
    db.createWhitelistEntry = async (projectId, fingerprint, status) => {
      createdArgs = { projectId, fingerprint, status }
      return { id: 'wl-new' }
    }
    const res = await fetch(`${base}/api/whitelist/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: 'fp-new', status: 'approved' }),
    })
    assert.strictEqual(res.status, 201)
    const data = await res.json()
    assert.strictEqual(data.id, 'wl-new')
    assert.strictEqual(createdArgs.status, 'approved')
  })

  it('POST /project/:projectId defaults status to approved', async () => {
    let createdStatus: string | null = null
    db.createWhitelistEntry = async (_pid, _fp, status) => {
      createdStatus = status
      return { id: 'wl-def' }
    }
    const res = await fetch(`${base}/api/whitelist/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: 'fp-default' }),
    })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(createdStatus, 'approved')
  })

  it('POST /project/:projectId rejects missing fingerprint', async () => {
    const res = await fetch(`${base}/api/whitelist/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.strictEqual(data.error, 'fingerprint required')
  })

  it('PUT /project/:projectId/:id updates status to approved', async () => {
    let updatedArgs: any = null
    db.updateWhitelistStatus = async (id, status) => { updatedArgs = { id, status } }
    const res = await fetch(`${base}/api/whitelist/project/proj-1/wl-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.ok, true)
    assert.strictEqual(updatedArgs.id, 'wl-1')
    assert.strictEqual(updatedArgs.status, 'approved')
  })

  it('PUT /project/:projectId/:id updates status to rejected', async () => {
    let updatedStatus: string | null = null
    db.updateWhitelistStatus = async (_id, status) => { updatedStatus = status }
    const res = await fetch(`${base}/api/whitelist/project/proj-1/wl-2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(updatedStatus, 'rejected')
  })

  it('PUT /project/:projectId/:id rejects invalid status', async () => {
    const res = await fetch(`${base}/api/whitelist/project/proj-1/wl-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid' }),
    })
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.strictEqual(data.error, 'status must be approved or rejected')
  })

  it('PUT /project/:projectId/:id rejects missing status', async () => {
    const res = await fetch(`${base}/api/whitelist/project/proj-1/wl-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.strictEqual(data.error, 'status must be approved or rejected')
  })
})

// ============================================================
// Global Settings Router
// ============================================================

describe('Route Handlers - Global Settings', () => {
  let server: http.Server
  let base: string
  let db: IDatabaseProvider

  before(async () => {
    db = createMockDb()
    const result = await startApp((app) => {
      app.use('/api/global', createGlobalSettingsRouter(db))
    })
    server = result.server
    base = result.base
  })

  after(() => { server.close() })

  it('GET /:key returns existing setting value', async () => {
    db.getGlobalSetting = async (key) => {
      if (key === 'temporal-pk') return 'true'
      return null
    }
    const res = await fetch(`${base}/api/global/temporal-pk`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.value, 'true')
  })

  it('GET /:key returns null for non-existing setting', async () => {
    db.getGlobalSetting = async () => null
    const res = await fetch(`${base}/api/global/nonexistent`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.value, null)
  })

  it('PUT /:key stores setting value', async () => {
    let storedArgs: any = null
    db.storeGlobalSetting = async (key, value) => { storedArgs = { key, value } }
    const res = await fetch(`${base}/api/global/temporal-pk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'true' }),
    })
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.ok, true)
    assert.strictEqual(storedArgs.key, 'temporal-pk')
    assert.strictEqual(storedArgs.value, 'true')
  })

  it('PUT /:key coerces non-string value to string', async () => {
    let storedValue: string | null = null
    db.storeGlobalSetting = async (_key, value) => { storedValue = value }
    const res = await fetch(`${base}/api/global/some-flag`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 42 }),
    })
    assert.strictEqual(res.status, 200)
    assert.strictEqual(storedValue, '42')
  })

  it('PUT /:key rejects missing value', async () => {
    const res = await fetch(`${base}/api/global/some-key`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.strictEqual(data.error, 'value required')
  })
})
