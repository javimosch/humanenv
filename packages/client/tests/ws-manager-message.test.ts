import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { ErrorCode } from 'humanenv-shared'
import { MockWebSocket, makeClient, injectMockWs } from './ws-test-helpers.ts'

describe('HumanEnvClient handleMessage', () => {
  let mockWs: MockWebSocket
  let client: ReturnType<typeof makeClient>

  beforeEach(() => {
    mockWs = new MockWebSocket()
    client = makeClient()
    injectMockWs(client, mockWs)
    // Wire up message handler (normally done by doConnect)
    mockWs.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString())
        ;(client as any).handleMessage(msg)
      } catch { /* ignore malformed */ }
    })
  })

  it('handles successful auth_response', async () => {
    const authPromise = new Promise<void>((resolve, reject) => {
      ;(client as any)._authResolve = resolve
      ;(client as any)._authReject = reject
    })

    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'auth_response',
      payload: { success: true, whitelisted: true }
    })))

    await authPromise
    assert.strictEqual((client as any).authenticated, true)
  })

  it('handles failed auth_response', async () => {
    const authPromise = new Promise<void>((resolve, reject) => {
      ;(client as any)._authResolve = resolve
      ;(client as any)._authReject = reject
    })

    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'auth_response',
      payload: {
        success: false,
        error: 'Invalid API key',
        code: ErrorCode.CLIENT_AUTH_INVALID_API_KEY
      }
    })))

    try {
      await authPromise
      assert.fail('Should have thrown')
    } catch (err: any) {
      assert.ok(err instanceof Error)
      assert.strictEqual(err.code, ErrorCode.CLIENT_AUTH_INVALID_API_KEY)
    }
  })

  it('handles get_response with value', async () => {
    const getPromise = client.get('TEST_KEY')

    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'get_response',
      payload: { key: 'TEST_KEY', value: 'test-value' }
    })))

    const value = await getPromise
    assert.strictEqual(value, 'test-value')
  })

  it('handles get_response with error', async () => {
    const getPromise = client.get('MISSING_KEY')

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

    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'set_response',
      payload: { success: true }
    })))

    await setPromise
  })

  it('handles set_response with error', async () => {
    const setPromise = client.set('TEST_KEY', 'test-value')

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
    mockWs.trigger('message', Buffer.from(JSON.stringify({
      type: 'pong'
    })))
  })
})
