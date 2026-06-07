import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'http'
import { startApp } from './route-test-helpers.ts'

describe('Health endpoint', () => {
  let server: http.Server
  let base: string

  before(async () => {
    const result = await startApp((app) => {
      app.get('/health', (_req, res) => {
        res.json({ status: 'ok', pk: false, uptime: process.uptime() })
      })
    })
    server = result.server
    base = result.base
  })

  after(() => { server.close() })

  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${base}/health`)
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.strictEqual(data.status, 'ok')
    assert.strictEqual(typeof data.uptime, 'number')
    assert.strictEqual(typeof data.pk, 'boolean')
  })
})

describe('Graceful shutdown - guards', () => {
  it('shutdown guard prevents double shutdown', async () => {
    let disconnectCount = 0
    let saveCount = 0
    let shutdownCount = 0

    const mockDb = {
      disconnect: async () => { disconnectCount++ },
    }
    const mockPk = {
      isReady: () => false,
      saveTemporalPk: async () => { saveCount++ },
      bootstrap: async () => ({ existing: false, status: 'needs_input' }),
    }
    const mockWsRouter = {
      shutdown: async () => { shutdownCount++ },
    }

    let shuttingDown = false
    const shutdown = async (signal: string) => {
      if (shuttingDown) return
      shuttingDown = true
      await mockWsRouter.shutdown()
      await mockPk.saveTemporalPk()
      await mockDb.disconnect()
    }

    await shutdown('SIGTERM')
    await shutdown('SIGTERM')

    assert.strictEqual(disconnectCount, 1)
    assert.strictEqual(saveCount, 1)
    assert.strictEqual(shutdownCount, 1)
  })
})
