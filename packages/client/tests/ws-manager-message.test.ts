import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert'
import { HumanEnvClient } from '../src/ws-manager.ts'
import { ErrorCode } from 'humanenv-shared'

// Mock WebSocket for testing message handling
class MockWebSocket {
  readyState = 1 // OPEN
  handlers: Record<string, Array<(data: any) => void>> = {}
  sentMessages: any[] = []

  on(event: string, handler: (data: any) => void) {
    if (!this.handlers[event]) {
      this.handlers[event] = []
    }
    this.handlers[event].push(handler)
  }

  send(data: any) {
    this.sentMessages.push(data)
  }

  close() {}

  trigger(event: string, data: any) {
    const handlers = this.handlers[event] || []
    handlers.forEach(h => h(data))
  }
}

describe('HumanEnvClient handleMessage', () => {
  let mockWs: MockWebSocket
  let client: HumanEnvClient

  beforeEach(() => {
    mockWs = new MockWebSocket()
    client = new HumanEnvClient({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
    })
    // Inject mock WebSocket
    ;(client as any).ws = mockWs
    ;(client as any).connected = true
  })

  it('handles successful auth_response', async () => {
    const connectPromise = client.connect()
    
    // Trigger auth success response
    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'auth_response',
      payload: { success: true, whitelisted: true }
    })))

    await connectPromise
    assert.strictEqual((client as any).authenticated, true)
  })

  it('handles failed auth_response', async () => {
    const connectPromise = client.connect()

    try {
      // Trigger auth failure response
      mockWs.trigger('message', Buffer.from(JSON.stringify({
        type: 'auth_response',
        payload: { 
          success: false, 
          error: 'Invalid API key',
          code: ErrorCode.CLIENT_AUTH_INVALID_API_KEY
        }
      })))

      await connectPromise
      assert.fail('Should have thrown')
    } catch (err: any) {
      assert.ok(err instanceof Error)
      assert.strictEqual(err.code, ErrorCode.CLIENT_AUTH_INVALID_API_KEY)
    }
  })

  it('handles get_response with value', async () => {
    const getPromise = client.get('TEST_KEY')

    // Trigger get response
    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'get_response',
      payload: { key: 'TEST_KEY', value: 'test-value' }
    })))

    const value = await getPromise
    assert.strictEqual(value, 'test-value')
  })

  it('handles get_response with error', async () => {
    const getPromise = client.get('MISSING_KEY')

    // Trigger get error response
    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'get_response',
      payload: { 
        error: 'Key not found',
        code: ErrorCode.SERVER_INTERNAL_ERROR
      }
    })))

    try {
      await getPromise
      assert.fail('Should have thrown')
    } catch (err: any) {
      assert.ok(err instanceof Error)
      assert.ok(err.message.includes('Key not found'))
    }
  })

  it('handles set_response success', async () => {
    const setPromise = client.set('TEST_KEY', 'test-value')

    // Trigger set success response
    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'set_response',
      payload: { success: true }
    })))

    await setPromise // Should resolve without error
  })

  it('handles set_response with error', async () => {
    const setPromise = client.set('TEST_KEY', 'test-value')

    // Trigger set error response
    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'set_response',
      payload: { 
        error: 'Not authenticated',
        code: ErrorCode.CLIENT_AUTH_INVALID_API_KEY
      }
    })))

    try {
      await setPromise
      assert.fail('Should have thrown')
    } catch (err: any) {
      assert.ok(err instanceof Error)
      assert.ok(err.message.includes('Not authenticated'))
    }
  })

  it('ignores pong messages', () => {
    // Should not throw or affect state
    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'pong'
    })))
    // No assertions needed - test passes if no error
  })
})
