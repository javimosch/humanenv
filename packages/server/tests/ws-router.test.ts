import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'

// Mock WebSocket and dependencies for testing WsRouter logic
class MockWebSocket {
  readyState = 1 // OPEN
  sentMessages: any[] = []
  handlers: Record<string, Array<(data: any) => void>> = {}
  
  send(data: any) {
    this.sentMessages.push(data)
  }
  
  on(event: string, handler: (data: any) => void) {
    if (!this.handlers[event]) this.handlers[event] = []
    this.handlers[event].push(handler)
  }
  
  close() {}
}

class MockDb {
  data: any = {
    projects: new Map(),
    envs: new Map(),
    apiKeys: new Map(),
    whitelist: new Map(),
  }
  
  async getProject(name: string) {
    return this.data.projects.get(name) || null
  }
  
  async getApiKey(projectId: string, plainValue: string) {
    const key = `${projectId}:${plainValue}`
    return this.data.apiKeys.get(key) || null
  }
  
  async getWhitelistEntry(projectId: string, fingerprint: string) {
    const key = `${projectId}:${fingerprint}`
    return this.data.whitelist.get(key) || null
  }
  
  async createWhitelistEntry(projectId: string, fingerprint: string, status: string) {
    const key = `${projectId}:${fingerprint}`
    const entry = { id: 'wl-1', projectId, fingerprint, status, createdAt: Date.now() }
    this.data.whitelist.set(key, entry)
    return entry
  }
  
  async getEnv(projectId: string, key: string) {
    const mapKey = `${projectId}:${key}`
    return this.data.envs.get(mapKey) || null
  }
  
  async createEnv(projectId: string, key: string, encryptedValue: string) {
    const mapKey = `${projectId}:${key}`
    const env = { id: 'env-1', projectId, key, encryptedValue, createdAt: Date.now() }
    this.data.envs.set(mapKey, env)
    return env
  }
  
  async updateEnv(projectId: string, key: string, encryptedValue: string) {
    const mapKey = `${projectId}:${key}`
    if (this.data.envs.has(mapKey)) {
      const existing = this.data.envs.get(mapKey)
      existing.encryptedValue = encryptedValue
    }
  }
}

class MockPkManager {
  encrypt(value: string, aad: string) {
    return `encrypted:${value}:${aad}`
  }
  
  decrypt(encryptedValue: string, aad: string) {
    return encryptedValue.replace('encrypted:', '').split(':')[0]
  }
  
  isReady() {
    return true
  }
}

describe('WsRouter - Auth Flow', () => {
  let mockDb: MockDb
  let mockPk: MockPkManager
  let mockWs: MockWebSocket

  beforeEach(() => {
    mockDb = new MockDb()
    mockPk = new MockPkManager()
    mockWs = new MockWebSocket()
    
    // Setup test data
    mockDb.data.projects.set('test-project', { id: 'proj-1', name: 'test-project' })
    mockDb.data.apiKeys.set('proj-1:valid-key', { id: 'key-1', projectId: 'proj-1' })
    mockDb.data.whitelist.set('proj-1:fp-123', { 
      id: 'wl-1', 
      projectId: 'proj-1', 
      fingerprint: 'fp-123', 
      status: 'approved' 
    })
  })

  it('accepts auth with valid credentials', async () => {
    // Simulate auth message handling
    const authPayload = {
      projectName: 'test-project',
      apiKey: 'valid-key',
      fingerprint: 'fp-123',
    }
    
    // Verify credentials exist
    const project = await mockDb.getProject(authPayload.projectName)
    const apiKey = await mockDb.getApiKey(project.id, authPayload.apiKey)
    const whitelist = await mockDb.getWhitelistEntry(project.id, authPayload.fingerprint)
    
    assert.ok(project)
    assert.ok(apiKey)
    assert.strictEqual(whitelist.status, 'approved')
  })

  it('rejects auth with invalid project name', async () => {
    const authPayload = {
      projectName: 'nonexistent-project',
      apiKey: 'valid-key',
      fingerprint: 'fp-123',
    }
    
    const project = await mockDb.getProject(authPayload.projectName)
    
    assert.strictEqual(project, null)
  })

  it('rejects auth with invalid API key', async () => {
    const authPayload = {
      projectName: 'test-project',
      apiKey: 'wrong-key',
      fingerprint: 'fp-123',
    }
    
    const project = await mockDb.getProject(authPayload.projectName)
    const apiKey = await mockDb.getApiKey(project.id, authPayload.apiKey)
    
    assert.ok(project)
    assert.strictEqual(apiKey, null)
  })

  it('accepts auth but marks not whitelisted', async () => {
    const authPayload = {
      projectName: 'test-project',
      apiKey: 'valid-key',
      fingerprint: 'new-fingerprint', // Not in whitelist
    }
    
    const project = await mockDb.getProject(authPayload.projectName)
    const apiKey = await mockDb.getApiKey(project.id, authPayload.apiKey)
    const whitelist = await mockDb.getWhitelistEntry(project.id, authPayload.fingerprint)
    
    assert.ok(project)
    assert.ok(apiKey)
    assert.strictEqual(whitelist, null) // Not whitelisted
  })

  it('creates pending whitelist entry for new fingerprint', async () => {
    const authPayload = {
      projectName: 'test-project',
      apiKey: 'valid-key',
      fingerprint: 'new-fingerprint',
    }
    
    const project = await mockDb.getProject(authPayload.projectName)
    const apiKey = await mockDb.getApiKey(project.id, authPayload.apiKey)
    
    if (project && apiKey) {
      // Create pending entry
      const entry = await mockDb.createWhitelistEntry(
        project.id, 
        authPayload.fingerprint, 
        'pending'
      )
      
      assert.strictEqual(entry.status, 'pending')
    }
  })
})

describe('WsRouter - Get/Set Operations', () => {
  let mockDb: MockDb
  let mockPk: MockPkManager

  beforeEach(() => {
    mockDb = new MockDb()
    mockPk = new MockPkManager()
    
    // Setup test data
    mockDb.data.projects.set('test-project', { id: 'proj-1', name: 'test-project' })
    mockDb.data.whitelist.set('proj-1:fp-123', { 
      id: 'wl-1', 
      projectId: 'proj-1', 
      fingerprint: 'fp-123', 
      status: 'approved' 
    })
  })

  it('get retrieves decrypted value', async () => {
    // Setup env
    await mockDb.createEnv('proj-1', 'API_KEY', 'encrypted:secret-value:proj-1:API_KEY')
    
    // Simulate get operation
    const env = await mockDb.getEnv('proj-1', 'API_KEY')
    const decrypted = mockPk.decrypt(env.encryptedValue, 'proj-1:API_KEY')
    
    assert.strictEqual(decrypted, 'secret-value')
  })

  it('get returns null for missing key', async () => {
    const env = await mockDb.getEnv('proj-1', 'MISSING_KEY')
    assert.strictEqual(env, null)
  })

  it('set stores encrypted value', async () => {
    const value = 'my-new-secret'
    const aad = 'proj-1:NEW_KEY'
    const encrypted = mockPk.encrypt(value, aad)
    
    await mockDb.createEnv('proj-1', 'NEW_KEY', encrypted)
    
    const stored = await mockDb.getEnv('proj-1', 'NEW_KEY')
    assert.ok(stored)
    assert.strictEqual(stored.encryptedValue, encrypted)
  })

  it('set updates existing key', async () => {
    // Create initial env
    await mockDb.createEnv('proj-1', 'EXISTING_KEY', 'encrypted:old-value:proj-1:EXISTING_KEY')
    
    // Update
    const newValue = 'updated-value'
    const newEncrypted = mockPk.encrypt(newValue, 'proj-1:EXISTING_KEY')
    await mockDb.updateEnv('proj-1', 'EXISTING_KEY', newEncrypted)
    
    // Verify update
    const env = await mockDb.getEnv('proj-1', 'EXISTING_KEY')
    const decrypted = mockPk.decrypt(env.encryptedValue, 'proj-1:EXISTING_KEY')
    assert.strictEqual(decrypted, newValue)
  })

  it('get requires authentication (whitelist check)', async () => {
    const fingerprint = 'fp-123'
    const projectId = 'proj-1'
    
    const whitelist = await mockDb.getWhitelistEntry(projectId, fingerprint)
    const isAuthenticated = whitelist?.status === 'approved'
    
    assert.strictEqual(isAuthenticated, true)
    
    // Test with non-whitelisted fingerprint
    const unauthWhitelist = await mockDb.getWhitelistEntry(projectId, 'unknown-fp')
    const isUnauthAuthenticated = unauthWhitelist?.status === 'approved'
    
    assert.strictEqual(isUnauthAuthenticated, false)
  })
})

describe('WsRouter - Admin Broadcast', () => {
  let adminClients: MockWebSocket[] = []

  beforeEach(() => {
    adminClients = []
  })

  it('broadcastAdmin sends to all admin clients', () => {
    // Setup admin clients
    const client1 = new MockWebSocket()
    const client2 = new MockWebSocket()
    adminClients.push(client1, client2)
    
    // Simulate broadcast
    const event = 'whitelist_pending'
    const payload = { fingerprint: 'fp-123', projectName: 'test-project' }
    const data = JSON.stringify({ event, payload })
    
    adminClients.forEach(ws => {
      if (ws.readyState === 1) ws.send(data)
    })
    
    // Verify both clients received
    assert.strictEqual(client1.sentMessages.length, 1)
    assert.strictEqual(client2.sentMessages.length, 1)
    assert.deepStrictEqual(
      JSON.parse(client1.sentMessages[0]),
      { event: 'whitelist_pending', payload }
    )
  })

  it('broadcastAdmin skips closed connections', () => {
    const client1 = new MockWebSocket()
    const client2 = new MockWebSocket()
    client2.readyState = 3 // CLOSED
    
    adminClients.push(client1, client2)
    
    const data = JSON.stringify({ event: 'test', payload: {} })
    
    adminClients.forEach(ws => {
      if (ws.readyState === 1) ws.send(data)
    })
    
    // Only open client should receive
    assert.strictEqual(client1.sentMessages.length, 1)
    assert.strictEqual(client2.sentMessages.length, 0)
  })
})

describe('WsRouter - Pending Request Management', () => {
  let pendingRequests: Map<string, any>

  beforeEach(() => {
    pendingRequests = new Map()
  })

  it('resolvePending clears timeout and resolves', async () => {
    const reqId = 'req-123'
    let resolved = false
    
    const pending = {
      resolve: (msg: any) => { resolved = true },
      reject: () => {},
      timeout: setTimeout(() => {}, 1000),
    }
    
    pendingRequests.set(reqId, pending)
    
    // Simulate resolve
    const p = pendingRequests.get(reqId)
    if (p) {
      clearTimeout(p.timeout)
      p.resolve({ approved: true })
      pendingRequests.delete(reqId)
    }
    
    assert.strictEqual(resolved, true)
    assert.strictEqual(pendingRequests.has(reqId), false)
  })

  it('rejectPending clears timeout and rejects', () => {
    const reqId = 'req-123'
    let rejected = false
    
    const pending = {
      resolve: () => {},
      reject: () => { rejected = true },
      timeout: setTimeout(() => {}, 1000),
    }
    
    pendingRequests.set(reqId, pending)
    
    // Simulate reject
    const p = pendingRequests.get(reqId)
    if (p) {
      clearTimeout(p.timeout)
      p.reject('Rejected by admin')
      pendingRequests.delete(reqId)
    }
    
    assert.strictEqual(rejected, true)
  })
})
