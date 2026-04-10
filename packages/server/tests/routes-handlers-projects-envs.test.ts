import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'http'
import { createProjectsRouter, createEnvsRouter } from '../src/routes/index.ts'
import type { IDatabaseProvider } from '../src/db/interface.ts'
import type { PkManager } from '../src/pk-manager.ts'
import { createMockDb, createMockPk, startApp } from './route-test-helpers.ts'

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
      { id: 'e1', key: 'DB_HOST', createdAt: 1000 },
      { id: 'e2', key: 'SECRET', createdAt: 2000 },
    ]
    const res = await fetch(`${base}/api/envs/project/proj-1`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.length, 2)
    assert.strictEqual(data[0].key, 'DB_HOST')
    assert.strictEqual(data[1].key, 'SECRET')
  })

  it('GET /project/:projectId/all bulk decrypts all envs', async () => {
    db.listEnvsWithValues = async () => [
      { id: 'e1', key: 'KEY_A', encryptedValue: 'enc:value-a', createdAt: 1000 },
      { id: 'e2', key: 'KEY_B', encryptedValue: 'enc:value-b', createdAt: 2000 },
    ]
    const res = await fetch(`${base}/api/envs/project/proj-1/all`)
    assert.strictEqual(res.status, 200)
    const data = await res.json()
    assert.strictEqual(data.KEY_A, 'value-a')
    assert.strictEqual(data.KEY_B, 'value-b')
  })

  it('GET /project/:projectId/:key returns decrypted env value', async () => {
    db.getEnv = async () => ({ encryptedValue: 'enc:my-secret' })
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
    db.createEnv = async (projectId, key, encryptedValue) => {
      createdEnv = { projectId, key, encryptedValue }
      return { id: 'env-new' }
    }
    const res = await fetch(`${base}/api/envs/project/proj-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'NEW_KEY', value: 'new-value' }),
    })
    assert.strictEqual(res.status, 201)
    const data = await res.json()
    assert.strictEqual(data.id, 'env-new')
    assert.strictEqual(createdEnv.key, 'NEW_KEY')
    assert.strictEqual(createdEnv.encryptedValue, 'enc:new-value')
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
    db.updateEnv = async (projectId, key, encryptedValue) => {
      updatedEnv = { projectId, key, encryptedValue }
    }
    const res = await fetch(`${base}/api/envs/project/proj-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'EXISTING', value: 'updated-val' }),
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
      return { encryptedValue: 'enc:val' }
    }
    const res = await fetch(`${base}/api/envs/project/proj-1/${encodeURIComponent('MY KEY')}`)
    assert.strictEqual(res.status, 200)
    assert.strictEqual(requestedKey, 'MY KEY')
  })
})
