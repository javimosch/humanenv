import express from 'express'
import http from 'http'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { PkManager } from './pk-manager'
import { createDatabase } from './db'
import { createBasicAuthMiddleware } from './auth'
import { createProjectsRouter, createEnvsRouter, createApiKeysRouter, createWhitelistRouter } from './routes'
import { WsRouter } from './ws/router'

// ============================================================
// Config resolution
// ============================================================

function parseIntOr(val: string | undefined, fallback: number): number {
  if (!val) return fallback
  const n = parseInt(val, 10)
  return isNaN(n) ? fallback : n
}

const PORT = parseIntOr(
  process.argv.find(a => a.startsWith('--port='))?.split('=')[1] ||
  process.argv[process.argv.indexOf('--port') + 1] ||
  process.env.PORT,
  3056
)
const BASIC_AUTH_ARG = process.argv.find(a => a.startsWith('--basicAuth'))
const dataDir = path.join(os.homedir(), '.humanenv')
const dbPath = path.join(dataDir, 'humanenv.db')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// ============================================================
// App bootstrap
// ============================================================

async function main() {
  console.log('Starting HumanEnv server...')
  console.log('Data directory:', dataDir)

  // Database
  const mongoUri = process.env.MONGODB_URI
  const { provider: db, active: activeDb } = await createDatabase(dbPath, mongoUri)
  console.log('Database:', activeDb)

  // PK Manager
  const pk = new PkManager()
  const storedHash = await db.getPkHash()
  const bootstrapResult = await pk.bootstrap(storedHash)

  // App
  const app = express()
  const server = http.createServer(app)

  app.use(express.json())

  // Basic auth for admin UI
  if (BASIC_AUTH_ARG) {
    const username = process.env.BASIC_AUTH_USERNAME || 'admin'
    const password = process.env.BASIC_AUTH_PASSWORD || 'admin'
    app.use(createBasicAuthMiddleware(username, password))
  }

  // WS Router
  const wsRouter = new WsRouter(server, db, pk)

  // REST routes
  app.use('/api/projects', createProjectsRouter(db, pk))
  app.use('/api/envs', createEnvsRouter(db, pk))
  app.use('/api/apikeys', createApiKeysRouter(db, pk))
  app.use('/api/whitelist', createWhitelistRouter(db))

  // PK setup endpoints
  app.post('/api/pk/setup', async (req, res) => {
    const { mnemonic } = req.body || {}
    if (!mnemonic) return res.status(400).json({ error: 'mnemonic required' })
    try {
      const result = pk.submitMnemonic(mnemonic, storedHash)
      await db.storePkHash(result.hash)
      res.json({ ok: true, firstSetup: result.firstSetup })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  app.get('/api/pk/generate', (_req, res) => {
    const mnemonic = pk.getMnemonic()
    res.json({ mnemonic })
  })

  app.get('/api/pk/status', (_req, res) => {
    res.json({ ready: pk.isReady(), existing: bootstrapResult.existing })
  })

  // Serve admin UI
  app.get('/', (_req, res) => {
    const status = pk.isReady() ? 'ready' : bootstrapResult.status === 'needs_input' ? 'needs-pk' : 'ready'
    const existing = bootstrapResult.existing || 'hash'
    console.log('pk status for ejs:', status, existing)
    res.render('index', {
      pkStatus: status,
      existing: existing,
      activeDb: activeDb,
      pkVerified: pk.isReady(),
    })
  })

  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, 'views'))

  // Start
  server.listen(PORT, () => {
    console.log('HumanEnv server listening on port', PORT)
    console.log('Admin UI:', `http://localhost:${PORT}`)
    if (!pk.isReady()) console.log('WARNING: PK not loaded. Admin must enter mnemonic to activate server.')
  })
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
