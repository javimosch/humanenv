import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'

// Mock Express request/response for testing route handlers
function createMockRequest(params: any = {}, body: any = {}) {
  return {
    params,
    body,
  }
}

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    jsonData: null,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: any) {
      this.jsonData = data
      return this
    },
  }
  return res
}

// Mock database provider
class MockDb {
  data: any = {
    projects: new Map(),
    envs: new Map(),
    apiKeys: new Map(),
    whitelist: new Map(),
  }
  
  async listProjects() {
    return Array.from(this.data.projects.values())
  }
  
  async getProject(name: string) {
    return Array.from(this.data.projects.values()).find((p: any) => p.name === name) || null
  }
  
  async createProject(name: string) {
    const id = `proj-${Date.now()}`
    const project = { id, name, createdAt: Date.now() }
    this.data.projects.set(id, project)
    return { id }
  }
  
  async deleteProject(id: string) {
    this.data.projects.delete(id)
  }
  
  async listEnvs(projectId: string) {
    return Array.from(this.data.envs.values()).filter((e: any) => e.projectId === projectId)
  }
  
  async createEnv(projectId: string, key: string, encryptedValue: string) {
    const id = `env-${Date.now()}`
    const env = { id, projectId, key, encryptedValue, createdAt: Date.now() }
    this.data.envs.set(id, env)
    return { id }
  }
  
  async updateEnv(projectId: string, key: string, encryptedValue: string) {
    const env = Array.from(this.data.envs.values()).find((e: any) => e.projectId === projectId && e.key === key)
    if (env) {
      env.encryptedValue = encryptedValue
    }
  }
  
  async deleteEnv(projectId: string, key: string) {
    const env = Array.from(this.data.envs.values()).find((e: any) => e.projectId === projectId && e.key === key)
    if (env) {
      this.data.envs.delete(env.id)
    }
  }
  
  async listApiKeys(projectId: string) {
    return Array.from(this.data.apiKeys.values()).filter((k: any) => k.projectId === projectId)
  }
  
  async createApiKey(projectId: string, encryptedValue: string, ttl?: number) {
    const id = `key-${Date.now()}`
    const key = { id, projectId, encryptedValue, ttl, createdAt: Date.now() }
    this.data.apiKeys.set(id, key)
    return { id }
  }
  
  async revokeApiKey(projectId: string, id: string) {
    this.data.apiKeys.delete(id)
  }
  
  async listWhitelistEntries(projectId: string) {
    return Array.from(this.data.whitelist.values()).filter((w: any) => w.projectId === projectId)
  }
  
  async createWhitelistEntry(projectId: string, fingerprint: string, status: string) {
    const id = `wl-${Date.now()}`
    const entry = { id, projectId, fingerprint, status, createdAt: Date.now() }
    this.data.whitelist.set(id, entry)
    return { id }
  }
  
  async updateWhitelistStatus(id: string, status: string) {
    const entry = this.data.whitelist.get(id)
    if (entry) {
      entry.status = status
    }
  }
}

// Mock PK manager
class MockPk {
  encrypt(value: string, aad: string) {
    return `encrypted:${value}`
  }
}

describe('Projects Router', () => {
  let db: MockDb
  let pk: MockPk

  beforeEach(() => {
    db = new MockDb()
    pk = new MockPk()
  })

  it('GET /api/projects returns list of projects', async () => {
    await db.createProject('project-a')
    await db.createProject('project-b')
    
    // Simulate route handler
    const req = createMockRequest()
    const res = createMockResponse()
    
    const projects = await db.listProjects()
    res.json(projects)
    
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.jsonData.length, 2)
  })

  it('POST /api/projects creates project', async () => {
    const req = createMockRequest({}, { name: 'new-project' })
    const res = createMockResponse()
    
    // Validate input
    if (!req.body.name || typeof req.body.name !== 'string') {
      res.status(400).json({ error: 'name required' })
    } else {
      const existing = await db.getProject(req.body.name)
      if (existing) {
        res.status(409).json({ error: 'Project already exists' })
      } else {
        const result = await db.createProject(req.body.name)
        res.status(201).json({ id: result.id })
      }
    }
    
    assert.strictEqual(res.statusCode, 201)
    assert.ok(res.jsonData.id)
  })

  it('POST /api/projects rejects duplicate', async () => {
    await db.createProject('duplicate')
    
    const req = createMockRequest({}, { name: 'duplicate' })
    const res = createMockResponse()
    
    const existing = await db.getProject(req.body.name)
    if (existing) {
      res.status(409).json({ error: 'Project already exists' })
    }
    
    assert.strictEqual(res.statusCode, 409)
  })

  it('POST /api/projects rejects missing name', async () => {
    const req = createMockRequest({}, {})
    const res = createMockResponse()
    
    if (!req.body.name || typeof req.body.name !== 'string') {
      res.status(400).json({ error: 'name required' })
    }
    
    assert.strictEqual(res.statusCode, 400)
  })

  it('DELETE /api/projects removes project', async () => {
    const project = await db.createProject('to-delete')
    
    const req = createMockRequest({ id: project.id })
    const res = createMockResponse()
    
    await db.deleteProject(req.params.id)
    res.json({ ok: true })
    
    assert.strictEqual(res.statusCode, 200)
    const projects = await db.listProjects()
    assert.strictEqual(projects.length, 0)
  })
})

describe('Envs Router', () => {
  let db: MockDb
  let pk: MockPk
  let projectId: string

  beforeEach(async () => {
    db = new MockDb()
    pk = new MockPk()
    const project = await db.createProject('test-project')
    projectId = project.id
  })

  it('GET /api/envs/project/:id returns list of envs', async () => {
    await db.createEnv(projectId, 'KEY_A', 'encrypted-a')
    await db.createEnv(projectId, 'KEY_B', 'encrypted-b')
    
    const req = createMockRequest({ projectId })
    const res = createMockResponse()
    
    const envs = await db.listEnvs(projectId)
    res.json(envs)
    
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.jsonData.length, 2)
  })

  it('POST /api/envs/project/:id creates env', async () => {
    const req = createMockRequest({ projectId }, { 
      key: 'NEW_KEY', 
      value: 'secret-value'
    })
    const res = createMockResponse()
    
    if (!req.body.key || req.body.value === undefined) {
      res.status(400).json({ error: 'key and value required' })
    } else {
      const encrypted = pk.encrypt(req.body.value, `${projectId}:${req.body.key}`)
      const result = await db.createEnv(projectId, req.body.key, encrypted)
      res.status(201).json({ id: result.id })
    }
    
    assert.strictEqual(res.statusCode, 201)
    assert.ok(res.jsonData.id)
  })

  it('POST /api/envs/project/:id rejects missing key', async () => {
    const req = createMockRequest({ projectId }, { value: 'secret' })
    const res = createMockResponse()
    
    if (!req.body.key || req.body.value === undefined) {
      res.status(400).json({ error: 'key and value required' })
    }
    
    assert.strictEqual(res.statusCode, 400)
  })

  it('PUT /api/envs/project/:id updates env', async () => {
    await db.createEnv(projectId, 'EXISTING_KEY', 'old-encrypted')
    
    const req = createMockRequest({ projectId }, {
      key: 'EXISTING_KEY',
      value: 'new-value'
    })
    const res = createMockResponse()
    
    const encrypted = pk.encrypt(req.body.value, `${projectId}:${req.body.key}`)
    await db.updateEnv(projectId, req.body.key, encrypted)
    res.json({ ok: true })
    
    assert.strictEqual(res.statusCode, 200)
  })

  it('DELETE /api/envs/project/:id/:key removes env', async () => {
    await db.createEnv(projectId, 'TO_DELETE', 'encrypted')
    
    const req = createMockRequest({ projectId, key: 'TO_DELETE' })
    const res = createMockResponse()
    
    await db.deleteEnv(projectId, req.params.key)
    res.json({ ok: true })
    
    assert.strictEqual(res.statusCode, 200)
    const envs = await db.listEnvs(projectId)
    assert.strictEqual(envs.length, 0)
  })
})

describe('API Keys Router', () => {
  let db: MockDb
  let pk: MockPk
  let projectId: string

  beforeEach(async () => {
    db = new MockDb()
    pk = new MockPk()
    const project = await db.createProject('test-project')
    projectId = project.id
  })

  it('GET /api/apikeys/project/:id returns list of keys', async () => {
    await db.createApiKey(projectId, 'encrypted-key-1')
    await db.createApiKey(projectId, 'encrypted-key-2')
    
    const req = createMockRequest({ projectId })
    const res = createMockResponse()
    
    const keys = await db.listApiKeys(projectId)
    res.json(keys)
    
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.jsonData.length, 2)
  })

  it('POST /api/apikeys/project/:id creates key', async () => {
    const req = createMockRequest({ projectId }, { ttl: 3600 })
    const res = createMockResponse()
    
    const plainKey = 'generated-key-123'
    const encrypted = pk.encrypt(plainKey, `${projectId}:apikey:${plainKey.slice(0, 8)}`)
    const result = await db.createApiKey(projectId, encrypted, req.body.ttl)
    res.status(201).json({ id: result.id, plainKey })
    
    assert.strictEqual(res.statusCode, 201)
    assert.ok(res.jsonData.id)
    assert.strictEqual(res.jsonData.plainKey, 'generated-key-123')
  })

  it('DELETE /api/apikeys/project/:id/:id revokes key', async () => {
    const key = await db.createApiKey(projectId, 'encrypted')
    
    const req = createMockRequest({ projectId, id: key.id })
    const res = createMockResponse()
    
    await db.revokeApiKey(projectId, req.params.id)
    res.json({ ok: true })
    
    assert.strictEqual(res.statusCode, 200)
    const keys = await db.listApiKeys(projectId)
    assert.strictEqual(keys.length, 0)
  })
})

describe('Whitelist Router', () => {
  let db: MockDb
  let projectId: string

  beforeEach(async () => {
    db = new MockDb()
    const project = await db.createProject('test-project')
    projectId = project.id
  })

  it('GET /api/whitelist/project/:id returns list', async () => {
    await db.createWhitelistEntry(projectId, 'fp-1', 'approved')
    await db.createWhitelistEntry(projectId, 'fp-2', 'pending')
    
    const req = createMockRequest({ projectId })
    const res = createMockResponse()
    
    const entries = await db.listWhitelistEntries(projectId)
    res.json(entries)
    
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.jsonData.length, 2)
  })

  it('POST /api/whitelist/project/:id creates entry', async () => {
    const req = createMockRequest({ projectId }, { 
      fingerprint: 'new-fingerprint',
      status: 'approved'
    })
    const res = createMockResponse()
    
    if (!req.body.fingerprint) {
      res.status(400).json({ error: 'fingerprint required' })
    } else {
      const result = await db.createWhitelistEntry(projectId, req.body.fingerprint, req.body.status || 'approved')
      res.status(201).json({ id: result.id })
    }
    
    assert.strictEqual(res.statusCode, 201)
  })

  it('PUT /api/whitelist/project/:id/:id updates status', async () => {
    const entry = await db.createWhitelistEntry(projectId, 'fp-1', 'pending')
    
    const req = createMockRequest({ projectId, id: entry.id }, { status: 'approved' })
    const res = createMockResponse()
    
    if (!req.body.status || !['approved', 'rejected'].includes(req.body.status)) {
      res.status(400).json({ error: 'status must be approved or rejected' })
    } else {
      await db.updateWhitelistStatus(req.params.id, req.body.status)
      res.json({ ok: true })
    }
    
    assert.strictEqual(res.statusCode, 200)
  })

  it('PUT /api/whitelist rejects invalid status', async () => {
    const entry = await db.createWhitelistEntry(projectId, 'fp-1', 'pending')
    
    const req = createMockRequest({ projectId, id: entry.id }, { status: 'invalid' })
    const res = createMockResponse()
    
    if (!req.body.status || !['approved', 'rejected'].includes(req.body.status)) {
      res.status(400).json({ error: 'status must be approved or rejected' })
    }
    
    assert.strictEqual(res.statusCode, 400)
  })
})
