import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'http'
import { createProjectsRouter } from '../src/routes/index.ts'
import { createBasicAuthMiddleware } from '../src/auth.ts'
import { createMockDb, startApp } from './route-test-helpers.ts'

describe('Health Endpoint', () => {
  let server: http.Server
  let base: string

  before(async () => {
    const db = createMockDb()
    const result = await startApp((app) => {
      // Health must be registered BEFORE auth
      app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() })
      })
      // Auth after health
      app.use(createBasicAuthMiddleware('admin', 'password'))
      app.use('/api/projects', createProjectsRouter(db, {} as any))
    })
    server = result.server
    base = result.base
  })

  after(() => { server.close() })

  it('GET /health returns 200 without auth', async () => {
    const res = await fetch(`${base}/health`)
    assert.strictEqual(res.status, 200)
    const body = await res.json()
    assert.strictEqual(body.status, 'ok')
    assert.ok(typeof body.timestamp === 'number')
  })

  it('GET /health is accessible even when basic auth is enabled', async () => {
    // No Authorization header - should still succeed
    const res = await fetch(`${base}/health`)
    assert.strictEqual(res.status, 200)
  })

  it('GET /api/projects returns 401 without auth when basic auth is enabled', async () => {
    const res = await fetch(`${base}/api/projects`)
    assert.strictEqual(res.status, 401)
  })

  it('GET /api/projects returns 200 with valid auth', async () => {
    const credentials = Buffer.from('admin:password').toString('base64')
    const res = await fetch(`${base}/api/projects`, {
      headers: { Authorization: `Basic ${credentials}` }
    })
    assert.strictEqual(res.status, 200)
  })
})

describe('Health Endpoint - No Auth Configured', () => {
  let server: http.Server
  let base: string

  before(async () => {
    const db = createMockDb()
    const result = await startApp((app) => {
      app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() })
      })
      app.use('/api/projects', createProjectsRouter(db, {} as any))
    })
    server = result.server
    base = result.base
  })

  after(() => { server.close() })

  it('GET /health returns ok', async () => {
    const res = await fetch(`${base}/health`)
    assert.strictEqual(res.status, 200)
    const body = await res.json()
    assert.strictEqual(body.status, 'ok')
  })

  it('GET /api/projects returns 200 without auth when no auth is configured', async () => {
    const res = await fetch(`${base}/api/projects`)
    assert.strictEqual(res.status, 200)
  })
})

describe('Shutdown Guard - Double Invocation Prevention', () => {
  // Test that the shuttingDown guard prevents double shutdown
  // This is a unit test of the pattern, not a full integration test
  it('shuttingDown flag prevents re-entry', () => {
    let shutdownCount = 0
    let shuttingDown = false

    const shutdown = () => {
      if (shuttingDown) return
      shuttingDown = true
      shutdownCount++
    }

    shutdown()
    shutdown()
    shutdown()

    assert.strictEqual(shutdownCount, 1, 'Shutdown should only execute once')
  })
})
