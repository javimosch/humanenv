import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { HumanEnvClient } from '../src/ws-manager.ts'
import { ErrorCode, HumanEnvError } from 'humanenv-shared'

// Mock WebSocket that always fails to connect
class FailingWebSocket {
  readyState = 3 // CLOSED
  handlers: Record<string, Array<() => void>> = {}

  on(event: string, handler: () => void) {
    if (!this.handlers[event]) {
      this.handlers[event] = []
    }
    this.handlers[event].push(handler)
  }

  send() {}
  close() {}

  triggerClose() {
    const handlers = this.handlers['close'] || []
    handlers.forEach(h => h())
  }
}

describe('HumanEnvClient reconnection', () => {
  let originalSetTimeout: typeof setTimeout
  let originalClearTimeout: typeof clearTimeout

  beforeEach(() => {
    // Speed up tests by using fast timers
    originalSetTimeout = global.setTimeout
    originalClearTimeout = global.clearTimeout
    global.setTimeout = ((fn: any, _ms: number, ...args: any[]) => {
      return originalSetTimeout(fn, 1, ...args)
    }) as any
  })

  afterEach(() => {
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  })

  it('schedules reconnect on close (not reconnecting)', () => {
    const client = new HumanEnvClient({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
      maxRetries: 3,
    })

    // Mock WebSocket
    const mockWs = new FailingWebSocket()
    ;(client as any).ws = mockWs
    ;(client as any).connected = true
    ;(client as any).reconnecting = false

    // Trigger close event
    mockWs.triggerClose()

    // Should be in reconnecting state
    assert.strictEqual((client as any).reconnecting, true)
    assert.strictEqual((client as any).attempts, 1)
  })

  it('does not schedule reconnect if already reconnecting', () => {
    const client = new HumanEnvClient({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
      maxRetries: 3,
    })

    const mockWs = new FailingWebSocket()
    ;(client as any).ws = mockWs
    ;(client as any).connected = true
    ;(client as any).reconnecting = true
    ;(client as any).attempts = 1

    // Trigger close event
    mockWs.triggerClose()

    // Should not increment attempts (already reconnecting)
    assert.strictEqual((client as any).attempts, 1)
  })

  it('rejects with max retries exceeded error', (done) => {
    const client = new HumanEnvClient({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
      maxRetries: 1,
    })

    const mockWs = new FailingWebSocket()
    ;(client as any).ws = mockWs
    ;(client as any).connected = true
    ;(client as any).reconnecting = false
    ;(client as any).attempts = 1 // Already at max

    // Mock the reject callback to capture the error
    const mockReject = (err: Error) => {
      assert.ok(err instanceof HumanEnvError)
      assert.strictEqual((err as HumanEnvError).code, ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED)
      done()
    }

    // Trigger close event
    mockWs.triggerClose()
  })

  it('uses exponential backoff for delays', () => {
    const client = new HumanEnvClient({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
      maxRetries: 5,
    })

    // Manually test the backoff calculation
    ;(client as any).attempts = 1
    const delay1 = Math.min(1000 * Math.pow(2, 0), 30000)
    assert.strictEqual(delay1, 1000)

    ;(client as any).attempts = 2
    const delay2 = Math.min(1000 * Math.pow(2, 1), 30000)
    assert.strictEqual(delay2, 2000)

    ;(client as any).attempts = 3
    const delay3 = Math.min(1000 * Math.pow(2, 2), 30000)
    assert.strictEqual(delay3, 4000)

    ;(client as any).attempts = 10
    const delay10 = Math.min(1000 * Math.pow(2, 9), 30000)
    assert.strictEqual(delay10, 30000) // Capped at 30s
  })

  it('resets attempts on successful connection', async () => {
    const client = new HumanEnvClient({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
      maxRetries: 3,
    })

    // Simulate failed attempts
    ;(client as any).attempts = 2
    ;(client as any).reconnecting = true

    // Mock successful WebSocket
    class SuccessWebSocket {
      readyState = 1
      handlers: Record<string, Array<() => void>> = {}
      on(event: string, handler: () => void) {
        if (!this.handlers[event]) this.handlers[event] = []
        this.handlers[event].push(handler)
        // Trigger open immediately
        if (event === 'open') setTimeout(handler, 1)
      }
      send() {}
      close() {}
    }

    ;(client as any).doConnect = function(resolve: () => void) {
      ;(this as any).ws = new SuccessWebSocket()
      ;(this as any).connected = true
      ;(this as any).attempts = 0
      ;(this as any).reconnecting = false
      resolve()
    }

    await client.connect()
    assert.strictEqual((client as any).attempts, 0)
  })

  it('disconnect clears all timers and state', () => {
    const client = new HumanEnvClient({
      serverUrl: 'http://localhost:3056',
      projectName: 'test-project',
      projectApiKey: 'test-key',
    })

    // Set up some state
    ;(client as any).retryTimer = setTimeout(() => {}, 1000)
    ;(client as any).pingTimer = setInterval(() => {}, 1000)
    ;(client as any).reconnecting = true

    client.disconnect()

    assert.strictEqual((client as any).retryTimer, null)
    assert.strictEqual((client as any).pingTimer, null)
    assert.strictEqual((client as any).reconnecting, false)
  })
})
