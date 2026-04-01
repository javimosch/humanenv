import { Router } from 'express'
import { IDatabaseProvider } from '../db/interface'
import { PkManager } from '../pk-manager'
import crypto from 'node:crypto'

export function createProjectsRouter(db: IDatabaseProvider, pk: PkManager): Router {
  const router = Router()

  router.get('/', async (_req, res) => {
    const projects = await db.listProjects()
    res.json(projects)
  })

  router.post('/', async (req, res) => {
    const { name } = req.body || {}
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' })
    const existing = await db.getProject(name)
    if (existing) return res.status(409).json({ error: 'Project already exists' })
    const result = await db.createProject(name)
    res.status(201).json({ id: result.id })
  })

  router.delete('/:id', async (req, res) => {
    await db.deleteProject(req.params.id)
    res.json({ ok: true })
  })

  return router
}

export function createEnvsRouter(db: IDatabaseProvider, pk: PkManager): Router {
  const router = Router()

  router.get('/project/:projectId', async (req, res) => {
    const envs = await db.listEnvs(req.params.projectId)
    res.json(envs)
  })

  router.post('/project/:projectId', async (req, res) => {
    const { key, value, apiModeOnly } = req.body || {}
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' })
    const encrypted = pk.encrypt(value, `${req.params.projectId}:${key}`)
    const result = await db.createEnv(req.params.projectId, key, encrypted, !!apiModeOnly)
    res.status(201).json({ id: result.id })
  })

  router.put('/project/:projectId', async (req, res) => {
    const { key, value, apiModeOnly } = req.body || {}
    if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' })
    const encrypted = pk.encrypt(value, `${req.params.projectId}:${key}`)
    await db.updateEnv(req.params.projectId, key, encrypted, !!apiModeOnly)
    res.json({ ok: true })
  })

  router.delete('/project/:projectId/:key', async (req, res) => {
    await db.deleteEnv(req.params.projectId, decodeURIComponent(req.params.key))
    res.json({ ok: true })
  })

  return router
}

export function createApiKeysRouter(db: IDatabaseProvider, pk: PkManager): Router {
  const router = Router()

  router.get('/project/:projectId', async (req, res) => {
    const keys = await db.listApiKeys(req.params.projectId)
    res.json(keys)
  })

  router.post('/project/:projectId', async (req, res) => {
    const { plainKey, ttl } = req.body || {}
    const keyToStore = plainKey || crypto.randomUUID()
    const encrypted = pk.encrypt(keyToStore, `${req.params.projectId}:apikey:${keyToStore.slice(0, 8)}`)
    const result = await db.createApiKey(req.params.projectId, encrypted, keyToStore, ttl)
    res.status(201).json({ id: result.id, plainKey: keyToStore })
  })

  router.delete('/project/:projectId/:id', async (req, res) => {
    await db.revokeApiKey(req.params.projectId, req.params.id)
    res.json({ ok: true })
  })

  return router
}

export function createWhitelistRouter(db: IDatabaseProvider): Router {
  const router = Router()

  router.get('/project/:projectId', async (req, res) => {
    const entries = await db.listWhitelistEntries(req.params.projectId)
    res.json(entries)
  })

  router.post('/project/:projectId', async (req, res) => {
    const { fingerprint, status } = req.body || {}
    if (!fingerprint) return res.status(400).json({ error: 'fingerprint required' })
    const result = await db.createWhitelistEntry(req.params.projectId, fingerprint, status || 'approved')
    res.status(201).json({ id: result.id })
  })

  router.put('/project/:projectId/:id', async (req, res) => {
    const { status } = req.body || {}
    if (!status || !['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be approved or rejected' })
    await db.updateWhitelistStatus(req.params.id, status)
    res.json({ ok: true })
  })

  return router
}
