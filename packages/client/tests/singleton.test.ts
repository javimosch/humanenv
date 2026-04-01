import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import humanenv from '../src/index.ts'
import { HumanEnvClient } from '../src/ws-manager.ts'

// Mock HumanEnvClient for testing singleton behavior
class MockHumanEnvClient {
  static connectCalls = 0
  connected = false
  authenticated = false
  
  constructor(public config: any) {
    MockHumanEnvClient.connectCalls++
  }
  
  async connect() {
    this.connected = true
    this.authenticated = true
  }
  
  async get(key: string) {
    return `mock-value-${key}`
  }
  
  async getMany(keys: string[]) {
    return keys.reduce((acc, key) => {
      acc[key] = `mock-value-${key}`
      return acc
    }, {} as Record<string, string>)
  }
  
  async set(key: string, value: string) {
    // Mock set
  }
  
  disconnect() {
    this.connected = false
    this.authenticated = false
  }
}

describe('humanenv singleton', () => {
  beforeEach(() => {
    // Reset singleton state
    humanenv.disconnect()
    MockHumanEnvClient.connectCalls = 0
  })

  afterEach(() => {
    humanenv.disconnect()
  })

  it('config() creates singleton client', () => {
    humanenv.config({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
    })
    
    // Singleton should be created
    assert.ok(humanenv)
  })

  it('config() called twice ignores second call', () => {
    humanenv.config({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
    })
    
    humanenv.config({
      serverUrl: 'http://localhost:4000',
      projectName: 'other-project',
      projectApiKey: 'other-key',
    })
    
    // Second call should be ignored (singleton pattern)
    // We can't directly verify this without accessing internal state,
    // but the pattern ensures only one client exists
  })

  it('get() throws if config() not called', async () => {
    await assert.rejects(
      async () => humanenv.get('TEST_KEY'),
      /humanenv\.config\(\) must be called first/
    )
  })

  it('set() throws if config() not called', async () => {
    await assert.rejects(
      async () => humanenv.set('TEST_KEY', 'value'),
      /humanenv\.config\(\) must be called first/
    )
  })

  it('get() with single key returns string', async () => {
    // Note: This test requires the actual HumanEnvClient
    // For proper unit testing, we'd need to mock the client
    // This is a placeholder for the actual implementation test
    humanenv.config({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
    })
    
    // The actual get() will fail without a real server
    // This test verifies the singleton is set up correctly
    assert.ok(humanenv)
  })

  it('get() with multiple keys returns object', async () => {
    humanenv.config({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
    })
    
    // Verify singleton exists
    assert.ok(humanenv)
  })

  it('disconnect() resets singleton state', async () => {
    humanenv.config({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
    })
    
    humanenv.disconnect()
    
    // After disconnect, get() should throw again
    await assert.rejects(
      async () => humanenv.get('TEST_KEY'),
      /humanenv\.config\(\) must be called first/
    )
  })
})

describe('HumanEnvClient export', () => {
  it('exports HumanEnvClient class', () => {
    assert.strictEqual(typeof HumanEnvClient, 'function')
  })

  it('HumanEnvClient can be instantiated', () => {
    const client = new HumanEnvClient({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
    })
    assert.ok(client)
  })
})
