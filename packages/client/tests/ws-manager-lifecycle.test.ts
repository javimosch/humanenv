import { describe, it } from 'node:test'
import assert from 'node:assert'
import { HumanEnvClient } from '../src/ws-manager.ts'
import { ErrorCode } from 'humanenv-shared'
import { MockWebSocket, makeClient, injectMockWs } from './ws-test-helpers.ts'

describe('HumanEnvClient constructor', () => {
  it('stores required config fields', () => {
    const client = makeClient()
    const cfg = (client as any).config
    assert.strictEqual(cfg.serverUrl, 'http://localhost:3056')
    assert.strictEqual(cfg.projectName, 'test-project')
    assert.strictEqual(cfg.projectApiKey, 'test-key')
  })

  it('defaults maxRetries to 10', () => {
    const client = makeClient()
    assert.strictEqual((client as any).config.maxRetries, 10)
  })

  it('allows custom maxRetries', () => {
    const client = makeClient({ maxRetries: 3 })
    assert.strictEqual((client as any).config.maxRetries, 3)
  })

  it('defaults projectApiKey to empty string when omitted', () => {
    const client = new HumanEnvClient({ serverUrl: 'http://localhost:3056', projectName: 'p' })
    assert.strictEqual((client as any).config.projectApiKey, '')
  })

  it('initialises internal state correctly', () => {
    const client = makeClient()
    assert.strictEqual((client as any).connected, false)
    assert.strictEqual((client as any).authenticated, false)
    assert.strictEqual((client as any).attempts, 0)
    assert.strictEqual((client as any).reconnecting, false)
    assert.strictEqual((client as any).disconnecting, false)
    assert.strictEqual(client.whitelistStatus, null)
  })
})

describe('HumanEnvClient whitelistStatus', () => {
  it('returns null before auth', () => {
    const client = makeClient()
    assert.strictEqual(client.whitelistStatus, null)
  })

  it('returns approved after auth with status field', () => {
    const client = makeClient()
    ;(client as any)._whitelistStatus = 'approved'
    assert.strictEqual(client.whitelistStatus, 'approved')
  })

  it('returns pending after auth with status field', () => {
    const client = makeClient()
    ;(client as any)._whitelistStatus = 'pending'
    assert.strictEqual(client.whitelistStatus, 'pending')
  })

  it('returns rejected after auth with status field', () => {
    const client = makeClient()
    ;(client as any)._whitelistStatus = 'rejected'
    assert.strictEqual(client.whitelistStatus, 'rejected')
  })
})

describe('HumanEnvClient auth handling', () => {
  it('sets whitelistStatus from payload.status field', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws, { connected: true, authenticated: false })

    ;(client as any).handleMessage({
      type: 'auth_response',
      payload: { success: true, status: 'pending' }
    })

    assert.strictEqual((client as any).authenticated, true)
    assert.strictEqual(client.whitelistStatus, 'pending')
  })

  it('falls back to whitelisted boolean when status absent', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws, { connected: true, authenticated: false })

    ;(client as any).handleMessage({
      type: 'auth_response',
      payload: { success: true, whitelisted: true }
    })

    assert.strictEqual(client.whitelistStatus, 'approved')
  })

  it('sets pending when whitelisted is false and no status', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws, { connected: true, authenticated: false })

    ;(client as any).handleMessage({
      type: 'auth_response',
      payload: { success: true, whitelisted: false }
    })

    assert.strictEqual(client.whitelistStatus, 'pending')
  })

  it('sends auth payload with fingerprint on open', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    ;(client as any).ws = ws

    const resolve = () => {}
    const reject = () => {}
    ;(client as any).sendAuth(resolve, reject)

    const msg = ws.lastSent()
    assert.strictEqual(msg.type, 'auth')
    assert.strictEqual(msg.payload.projectName, 'test-project')
    assert.strictEqual(msg.payload.apiKey, 'test-key')
    assert.strictEqual(typeof msg.payload.fingerprint, 'string')
    assert.ok(msg.payload.fingerprint.length > 0)
  })

  it('clears auth callbacks after successful auth', () => {
    const client = makeClient()
    injectMockWs(client, new MockWebSocket(), { connected: true, authenticated: false })
    ;(client as any)._authResolve = () => {}
    ;(client as any)._authReject = () => {}

    ;(client as any).handleMessage({
      type: 'auth_response',
      payload: { success: true, whitelisted: true }
    })

    assert.strictEqual((client as any)._authResolve, null)
    assert.strictEqual((client as any)._authReject, null)
  })

  it('clears auth callbacks after failed auth', () => {
    const client = makeClient()
    injectMockWs(client, new MockWebSocket(), { connected: true, authenticated: false })
    ;(client as any)._authResolve = () => {}
    ;(client as any)._authReject = () => {}

    ;(client as any).handleMessage({
      type: 'auth_response',
      payload: { success: false, error: 'bad', code: ErrorCode.CLIENT_AUTH_INVALID_API_KEY }
    })

    assert.strictEqual((client as any)._authResolve, null)
    assert.strictEqual((client as any)._authReject, null)
  })
})

describe('HumanEnvClient get()', () => {
  it('throws when not connected', async () => {
    const client = makeClient()
    ;(client as any).connected = false
    ;(client as any).authenticated = true

    await assert.rejects(
      () => client.get('KEY'),
      (err: any) => err instanceof Error && err.code === ErrorCode.CLIENT_AUTH_INVALID_API_KEY
    )
  })

  it('throws when not authenticated', async () => {
    const client = makeClient()
    ;(client as any).connected = true
    ;(client as any).authenticated = false

    await assert.rejects(
      () => client.get('KEY'),
      (err: any) => err instanceof Error && err.code === ErrorCode.CLIENT_AUTH_INVALID_API_KEY
    )
  })

  it('sends get message with correct key', async () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws)

    const p = client.get('MY_SECRET')
    const msg = ws.lastSent()
    assert.strictEqual(msg.type, 'get')
    assert.strictEqual(msg.payload.key, 'MY_SECRET')

    // Resolve pending to avoid hanging
    ;(client as any).handleMessage({
      type: 'get_response',
      payload: { key: 'MY_SECRET', value: 'val' }
    })
    const val = await p
    assert.strictEqual(val, 'val')
  })

  it('get() with array calls _getSingle for each key', async () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws)

    const p = client.get(['A', 'B'])

    // Two get messages should have been sent
    const msgs = ws.sentMessages.map(s => JSON.parse(s))
    assert.strictEqual(msgs.length, 2)
    const keys = msgs.map((m: any) => m.payload.key).sort()
    assert.deepStrictEqual(keys, ['A', 'B'])

    // Resolve both
    ;(client as any).handleMessage({ type: 'get_response', payload: { key: 'A', value: 'va' } })
    ;(client as any).handleMessage({ type: 'get_response', payload: { key: 'B', value: 'vb' } })

    const result = await p
    assert.deepStrictEqual(result, { A: 'va', B: 'vb' })
  })

  it('get() with array throws when not authenticated', async () => {
    const client = makeClient()
    ;(client as any).connected = false

    await assert.rejects(
      () => client.get(['A', 'B']),
      (err: any) => err instanceof Error && err.code === ErrorCode.CLIENT_AUTH_INVALID_API_KEY
    )
  })
})

describe('HumanEnvClient set()', () => {
  it('throws when not connected', async () => {
    const client = makeClient()
    ;(client as any).connected = false
    ;(client as any).authenticated = true

    await assert.rejects(
      () => client.set('KEY', 'val'),
      (err: any) => err instanceof Error && err.code === ErrorCode.CLIENT_AUTH_INVALID_API_KEY
    )
  })

  it('throws when not authenticated', async () => {
    const client = makeClient()
    ;(client as any).connected = true
    ;(client as any).authenticated = false

    await assert.rejects(
      () => client.set('KEY', 'val'),
      (err: any) => err instanceof Error && err.code === ErrorCode.CLIENT_AUTH_INVALID_API_KEY
    )
  })

  it('sends set message with key and value', async () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws)

    const p = client.set('DB_PASS', 'secret123')
    const msg = ws.lastSent()
    assert.strictEqual(msg.type, 'set')
    assert.strictEqual(msg.payload.key, 'DB_PASS')
    assert.strictEqual(msg.payload.value, 'secret123')

    ;(client as any).handleMessage({ type: 'set_response', payload: { success: true } })
    await p
  })
})

describe('HumanEnvClient ping', () => {
  it('startPing sends ping messages on interval', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    ;(client as any).ws = ws

    // Use a short interval for testing
    ;(client as any).startPing()
    assert.ok((client as any).pingTimer !== null)

    // Clean up
    ;(client as any).stopPing()
    assert.strictEqual((client as any).pingTimer, null)
  })

  it('stopPing clears the ping timer', () => {
    const client = makeClient()
    ;(client as any).pingTimer = setInterval(() => {}, 100000)
    ;(client as any).stopPing()
    assert.strictEqual((client as any).pingTimer, null)
  })

  it('stopPing is safe to call when no timer exists', () => {
    const client = makeClient()
    ;(client as any).pingTimer = null
    ;(client as any).stopPing() // should not throw
    assert.strictEqual((client as any).pingTimer, null)
  })
})

describe('HumanEnvClient connectAndWaitForAuth', () => {
  it('resolves immediately if already connected and authenticated', async () => {
    const client = makeClient()
    ;(client as any).connected = true
    ;(client as any).authenticated = true

    await client.connectAndWaitForAuth(5000)
    // Should resolve without delay
  })

  it('resolves on timeout when auth never completes', async () => {
    const client = makeClient()
    ;(client as any).connected = true
    ;(client as any).authenticated = false

    // Use a very short timeout
    await client.connectAndWaitForAuth(50)
    // Should resolve silently even though not authenticated
    assert.strictEqual((client as any).authenticated, false)
  })
})

describe('HumanEnvClient disconnect', () => {
  it('sets disconnecting flag to true', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    ;(client as any).ws = ws
    ;(client as any).connected = true

    client.disconnect()
    assert.strictEqual((client as any).disconnecting, true)
  })

  it('clears reconnecting flag', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    ;(client as any).ws = ws
    ;(client as any).reconnecting = true

    client.disconnect()
    assert.strictEqual((client as any).reconnecting, false)
  })

  it('closes the WebSocket', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    ;(client as any).ws = ws

    client.disconnect()
    assert.strictEqual(ws.closed, true)
  })

  it('clears retry timer', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    ;(client as any).ws = ws
    ;(client as any).retryTimer = setTimeout(() => {}, 100000)

    client.disconnect()
    assert.strictEqual((client as any).retryTimer, null)
  })

  it('clears ping timer', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    ;(client as any).ws = ws
    ;(client as any).pingTimer = setInterval(() => {}, 100000)

    client.disconnect()
    assert.strictEqual((client as any).pingTimer, null)
  })
})

describe('HumanEnvClient malformed messages', () => {
  it('ignores unknown message types', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws)

    // Should not throw
    ;(client as any).handleMessage({ type: 'unknown_type', payload: {} })
  })

  it('ignores messages with no type', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws)

    ;(client as any).handleMessage({ payload: {} })
  })

  it('ignores pong messages without side effects', () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws)
    const pendingBefore = (client as any).pending.size

    ;(client as any).handleMessage({ type: 'pong' })

    assert.strictEqual((client as any).pending.size, pendingBefore)
  })
})

describe('HumanEnvClient _resolvePending', () => {
  it('resolves the first pending op and removes it', async () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws)

    const p = client.get('X')
    assert.strictEqual((client as any).pending.size, 1)

    ;(client as any).handleMessage({ type: 'get_response', payload: { key: 'X', value: 'hello' } })

    const val = await p
    assert.strictEqual(val, 'hello')
    assert.strictEqual((client as any).pending.size, 0)
  })

  it('rejects pending op when payload has error', async () => {
    const client = makeClient()
    const ws = new MockWebSocket()
    injectMockWs(client, ws)

    const p = client.get('MISSING')

    ;(client as any).handleMessage({
      type: 'get_response',
      payload: { error: 'Not found', code: ErrorCode.SERVER_INTERNAL_ERROR }
    })

    await assert.rejects(
      () => p,
      (err: any) => err instanceof Error && err.code === ErrorCode.SERVER_INTERNAL_ERROR
    )
  })

  it('is a no-op when no pending operations exist', () => {
    const client = makeClient()
    // Should not throw
    ;(client as any)._resolvePending('get', { key: 'X', value: 'v' })
  })
})
