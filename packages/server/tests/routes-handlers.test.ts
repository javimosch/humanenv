import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import express from 'express'
import http from 'http'
import { createProjectsRouter, createEnvsRouter, createApiKeysRouter, createWhitelistRouter, createGlobalSettingsRouter } from '../src/routes/index.ts'
import type { IDatabaseProvider } from '../src/db/interface.ts'
import type { PkManager } from '../src/pk-manager.ts'

// ============================================================
// Mock factories
// ============================================================

function createMockDb(): IDatabaseProvider {
  return {
    connect: async () => {},
    disconnect: async () => {},
    createProject: async () => ({ id: 'proj-1' }),
    getProject: async () => null,
    listProjects: async () => [],
    deleteProject: async () => {},
    updateProject: async () => {},
    createEnv: async () => ({ id: 'env-1' }),
    getEnv: async () => null,
    listEnvs: async () => [],
    listEnvsWithValues: async () => [],
    updateEnv: async () => {},
    deleteEnv: async () => {},
    createApiKey: async () => ({ id: 'key-1' }),
    getApiKey: async () => null,
    listApiKeys: async () => [],
    revokeApiKey: async () => {},
    updateApiKeyLastUsed: async () => {},
    createWhitelistEntry: async () => ({ id: 'wl-1' }),
    getWhitelistEntry: async () => null,
    listWhitelistEntries: async () => [],
    updateWhitelistStatus: async () => {},
    storePkHash: async () => {},
    getPkHash: async () => null,
    storeGlobalSetting: async () => {},
    getGlobalSetting: async () => null,
  }
}

function createMockPk(): PkManager {
  return {
    encrypt: (value: string, _aad: string) => `enc:${value}`,
    decrypt: (encrypted: string, _aad: string) => encrypted.replace('enc:', ''),
  } as unknown as PkManager
}

function startApp(setupRoutes: (app: express.Express) => void): Promise<{ server: http.Server; base: string }> {
  return new Promise((resolve) => {
    const app = express()
    app.use(express.json())
    setupRoutes(app)
    const server = http.createServer(app)
    server.listen(0, () => {
      const addr = server.address() as { port: number }
      resolve({ server, base: `http://127.0.0.1:${addr.port}` })
    })
  })
}

// ============================================================
// Projects Router
// ============================================================

describe('Route Handlers - Projects', () => {
  let server: http.Server
  let base: string
  let db: IDatabaseProvider
  let pk: PkManager

  before(async () => {
    db = createMockDb()
    pk = createMockPk()
    const result = await startApp((app) => {
      app.use('/api/projects', createProjectsRouter(db, pk))
    })
    server = result.server
    base = result.base
  })

  after(() => { server.close() })

  it('GET / returns empty list when no projects exist', async () => {
    db.listProjects = async () => []
    const res = await fetch(`${base}/api/projects`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.deepStrictEqual(data, [])
  })

  it('GET / returns list of projects', async () => {
    db.listProjects = async () => [
      { id: 'p1', name: 'alpha', createdAt: 1000 },
      { id: 'p2', name: 'beta', createdAt: 2000 },
    ]
    const res = await fetch(`${base}/api/projects`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[0].name, 'alpha')
    assert.strictEqual(data[1].name, 'beta')
  })

  it('POST / creates a project successfully', async () => {
    db.getProject = async () => null
    db.createProject = async (name: string) => {
      assert.strictEqual(name, 'new-project')
      return { id: 'proj-new' }
    }
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-project' }),
    })
    assert.strictEqual(res.status, 201)
    const data = await res.json()
    assert.strictEqual(data.id, 'proj-new')
  })

  it('POST / rejects request with missing name', async () => {
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.strictEqual(data.error, 'name required')
  })

  it('POST / rejects duplicate project name', async () => {
    db.getProject = async () => ({ id: 'existing', name: 'dup', createdAt: 1000, fingerprintVerification: true, requireApiKey: false })
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'dup' }),
    })
    assert.strictEqual(res.status, 409)
    const data = await res.json()
    assert.strictEqual(data.error, 'Project already exists')
  })

  it('PUT /:id updates project settings', async () => {
    let updatedData: any = null
    db.updateProject = async (id: string, data: any) => {
      updatedData = { id, ...data }
    }
    const res = await fetch(`${base}/api/projects/proj-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprintVerification: false, requireApiKey: true }),
    })
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.ok, true)
    assert.strictEqual(updatedData.id, 'proj-1')
    assert.strictEqual(updatedData.fingerprintVerification, false)
    assert.strictEqual(updatedData.requireApiKey, true)
  })

  it('DELETE /:id deletes a project', async () => {
    let deletedId: string | null = null
    db.deleteProject = async (id: string) => { deletedId = id }
    const res = await fetch(`${base}/api/projects/proj-del`, { method: 'DELETE' })
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.ok, true)
    assert.strictEqual(deletedId, 'proj-del')
  })
})

// ============================================================
// Envs Router
// ============================================================

describe('Route Handlers - Envs', () => {
  let server: http.Server
  let base: string
  let db: IDatabaseProvider
  let pk: PkManager

  before(async () => {
    db = createMockDb()
    pk = createMockPk()
    const result = await startApp((app) => {
      app.use('/api/envs', createEnvsRouter(db, pk))
    })
    server = result.server
    base = result.base
  })

  after(() => { server.close() })

  it('GET /project/:projectId returns list of envs', async () => {
    db.listEnvs = async (projectId: string) => [
      { id: 'e1', key: 'DB_HOST', apiModeOnly: false, createdAt: 1000 },
      { id: 'e2', key: 'SECRET', apiModeOnly: true, createdAt: 2000 },
    ]
    const res = await fetch(`${base}/api/envs/project/proj-1`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[0].key, 'DB_HOST')
    assert.strictEqual(data[1].apiModeOnly, true)
  })

  it('GET /project/:projectId/all bulk decrypts all envs', async () => {
    db.listEnvsWithValues = async () => [
      { id: 'e1', key: 'KEY_A', encryptedValue: 'enc:value-a', apiModeOnly: false, createdAt: 1000 },
      { id: 'e2', key: 'KEY_B', encryptedValue: 'enc:value-b', apiModeOnly: false, createdAt: 2000 },
    ]
    const res = await fetch(`${base}/api/envs/project/proj-1/all`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.KEY_A, 'value-a')
    assert.strictEqual(data.KEY_B, 'value-b')
  })

  it('GET /project/:projectId/:key returns decrypted env value', async () => {
    db.getEnv = async () => ({ encryptedValue: 'enc:my-secret', apiModeOnly: false })
    const res = await fetch(`${base}/api/envs/project/proj-1/API_KEY`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.key, 'API_KEY')
    assert.strictEqual(data.value, 'my-secret')
  })

  it('GET /project/:projectId/:key returns 404 for missing env', async () => {
    db.getEnv = async () => null
    const res = await fetch(`${base}/api/envs/project/proj-1/MISSING`)
    assert.strictEqual(res.status, 404)
    const data = await res.json()
    assert.strictEqual(data.error, 'Env not found')
  })

  it('POST /project/:projectId creates env with encryption', async () => {
    let createdEnv: any = null
    db.createEnv = async (projectId, key, encryptedValue, apiModeOnly) => {
      createdEnv = { projectId, key, encryptedValue, apiModeOnly }
      return { id: 'env-new' }
    }
    const res = await fetch(`${base}/api/envs/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'NEW_KEY', value: 'new-value', apiModeOnly: true }),
    })
    assert.strictEqual(res.status, 201)
    const data = await res.json()
    assert.strictEqual(data.id, 'env-new')
    assert.strictEqual(createdEnv.key, 'NEW_KEY')
    assert.strictEqual(createdEnv.encryptedValue, 'enc:new-value')
    assert.strictEqual(createdEnv.apiModeOnly, true)
  })

  it('POST /project/:projectId rejects missing key', async () => {
    const res = await fetch(`${base}/api/envs/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'some-value' }),
    })
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.strictEqual(data.error, 'key and value required')
  })

  it('POST /project/:projectId rejects missing value', async () => {
    const res = await fetch(`${base}/api/envs/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'SOME_KEY' }),
    })
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.strictEqual(data.error, 'key and value required')
  })

  it('PUT /project/:projectId updates env', async () => {
    let updatedEnv: any = null
    db.updateEnv = async (projectId, key, encryptedValue, apiModeOnly) => {
      updatedEnv = { projectId, key, encryptedValue, apiModeOnly }
    }
    const res = await fetch(`${base}/api/envs/project/proj-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'EXISTING', value: 'updated-val', apiModeOnly: false }),
    })
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.ok, true)
    assert.strictEqual(updatedEnv.key, 'EXISTING')
    assert.strictEqual(updatedEnv.encryptedValue, 'enc:updated-val')
  })

  it('DELETE /project/:projectId/:key deletes env', async () => {
    let deletedArgs: any = null
    db.deleteEnv = async (projectId, key) => { deletedArgs = { projectId, key } }
    const res = await fetch(`${base}/api/envs/project/proj-1/OLD_KEY`, { method: 'DELETE' })
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.ok, true)
    assert.strictEqual(deletedArgs.projectId, 'proj-1')
    assert.strictEqual(deletedArgs.key, 'OLD_KEY')
  })

  it('GET /project/:projectId/:key decodes URL-encoded key', async () => {
    let requestedKey: string | null = null
    db.getEnv = async (_projectId, key) => {
      requestedKey = key
      return { encryptedValue: 'enc:val', apiModeOnly: false }
    }
    const res = await fetch(`${base}/api/envs/project/proj-1/${encodeURIComponent('MY KEY')}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(requestedKey, 'MY KEY')
  })
})

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
