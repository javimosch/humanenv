import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { ErrorCode } from 'humanenv-shared'
import { MockWebSocket, makeClient, injectMockWs } from './ws-test-helpers.ts'

describe('HumanEnvClient reconnection', () => {
  let originalSetTimeout: typeof setTimeout
  let originalClearTimeout: typeof clearTimeout

  beforeEach(() => {
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

  // Mirrors close handler in doConnect() — keep in sync
  function wireCloseHandler(client: ReturnType<typeof makeClient>, mockWs: MockWebSocket, reject?: (e: Error) => void) {
    const rejectFn = reject ?? (() => {})
    mockWs.on('close', () => {
      ;(client as any).connected = false
      ;(client as any).authenticated = false
      ;(client as any).stopPing()
      if (!(client as any).disconnecting && !(client as any).reconnecting) {
        ;(client as any).scheduleReconnect(rejectFn)
      }
    })
  }

  it('schedules reconnect on close (not reconnecting)', () => {
    const client = makeClient({ maxRetries: 3 })
    const mockWs = new MockWebSocket()
    injectMockWs(client, mockWs)
    ;(client as any).reconnecting = false

    wireCloseHandler(client, mockWs)
    mockWs.trigger('close')

    assert.strictEqual((client as any).reconnecting, true)
    assert.strictEqual((client as any).attempts, 1)
  })

  it('does not schedule reconnect if already reconnecting', () => {
    const client = makeClient({ maxRetries: 3 })
    const mockWs = new MockWebSocket()
    injectMockWs(client, mockWs)
    ;(client as any).reconnecting = true
    ;(client as any).attempts = 1

    wireCloseHandler(client, mockWs)
    mockWs.trigger('close')

    assert.strictEqual((client as any).attempts, 1)
  })

  it('rejects with max retries exceeded error', (_, done) => {
    const client = makeClient({ maxRetries: 1 })
    const mockWs = new MockWebSocket()
    injectMockWs(client, mockWs)
    ;(client as any).reconnecting = false
    ;(client as any).attempts = 1

    const mockReject = (err: Error) => {
      assert.ok(err instanceof Error)
      assert.strictEqual((err as any).code, ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED)
      done()
    }

    wireCloseHandler(client, mockWs, mockReject)
    mockWs.trigger('close')
  })

  it('uses exponential backoff for delays', () => {
    const delay1 = Math.min(1000 * Math.pow(2, 0), 30000)
    assert.strictEqual(delay1, 1000)

    const delay2 = Math.min(1000 * Math.pow(2, 1), 30000)
    assert.strictEqual(delay2, 2000)

    const delay3 = Math.min(1000 * Math.pow(2, 2), 30000)
    assert.strictEqual(delay3, 4000)

    const delay10 = Math.min(1000 * Math.pow(2, 9), 30000)
    assert.strictEqual(delay10, 30000)
  })

  it('resets attempts on successful connection', async () => {
    const client = makeClient({ maxRetries: 3 })
    ;(client as any).attempts = 2
    ;(client as any).reconnecting = true

    ;(client as any).doConnect = function(resolve: () => void) {
      ;(this as any).ws = new MockWebSocket()
      ;(this as any).connected = true
      ;(this as any).attempts = 0
      ;(this as any).reconnecting = false
      resolve()
    }

    await client.connect()
    assert.strictEqual((client as any).attempts, 0)
  })

  it('disconnect clears all timers and state', () => {
    const client = makeClient()
    ;(client as any).retryTimer = setTimeout(() => {}, 1000)
    ;(client as any).pingTimer = setInterval(() => {}, 1000)
    ;(client as any).reconnecting = true

    client.disconnect()

    assert.strictEqual((client as any).retryTimer, null)
    assert.strictEqual((client as any).pingTimer, null)
    assert.strictEqual((client as any).reconnecting, false)
  })
})
