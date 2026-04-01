import { MongoClient, Db } from 'mongodb'
import { IDatabaseProvider } from './interface'
import { HumanEnvError, ErrorCode } from 'humanenv-shared'
import crypto from 'node:crypto'

const COLLECTIONS = {
  projects: 'projects',
  envs: 'envs',
  apiKeys: 'apiKeys',
  whitelist: 'whitelist',
  serverConfig: 'serverConfig',
} as const

export class MongoProvider implements IDatabaseProvider {
  private client: MongoClient | null = null
  private db: Db | null = null
  private reconnectInterval: ReturnType<typeof setInterval> | null = null

  constructor(private uri: string) {}

  async connect(): Promise<void> {
    this.client = new MongoClient(this.uri)
    await this.client.connect()
    this.db = this.client.db('humanenv')
    this.initIndexes()
  }

  async disconnect(): Promise<void> {
    if (this.reconnectInterval) clearInterval(this.reconnectInterval)
    if (this.client) await this.client.close()
  }

  private initIndexes(): void {
    const d = this.db!
    d.collection(COLLECTIONS.projects).createIndex({ name: 1 }, { unique: true })
    d.collection(COLLECTIONS.envs).createIndex({ projectId: 1, key: 1 }, { unique: true })
    d.collection(COLLECTIONS.apiKeys).createIndex({ projectId: 1, lookupHash: 1 }, { unique: true })
    d.collection(COLLECTIONS.whitelist).createIndex({ projectId: 1, fingerprint: 1 }, { unique: true })
    d.collection(COLLECTIONS.serverConfig).createIndex({ key: 1 }, { unique: true })
  }

  async createProject(name: string): Promise<{ id: string }> {
    const doc = { id: crypto.randomUUID(), name, createdAt: Date.now() }
    await this.col('projects').insertOne(doc)
    return { id: doc.id }
  }

  async getProject(name: string): Promise<{ id: string; name: string; createdAt: number } | null> {
    const doc = await this.col('projects').findOne({ name }) as any
    return doc ? { id: doc.id, name: doc.name, createdAt: doc.createdAt } : null
  }

  async listProjects(): Promise<Array<{ id: string; name: string; createdAt: number }>> {
    return await this.col('projects').find({}).sort({ createdAt: -1 }).toArray() as any
  }

  async deleteProject(id: string): Promise<void> {
    await this.col('projects').deleteOne({ id })
    await this.col('envs').deleteMany({ projectId: id })
    await this.col('apiKeys').deleteMany({ projectId: id })
    await this.col('whitelist').deleteMany({ projectId: id })
  }

  async createEnv(projectId: string, key: string, encryptedValue: string, apiModeOnly: boolean): Promise<{ id: string }> {
    const doc = { id: crypto.randomUUID(), projectId, key, encryptedValue, apiModeOnly, createdAt: Date.now() }
    await this.col('envs').updateOne(
      { projectId, key },
      { $set: doc },
      { upsert: true }
    )
    return { id: doc.id }
  }

  async getEnv(projectId: string, key: string): Promise<{ encryptedValue: string; apiModeOnly: boolean } | null> {
    const doc = await this.col('envs').findOne({ projectId, key }) as any
    return doc ? { encryptedValue: doc.encryptedValue, apiModeOnly: doc.apiModeOnly } : null
  }

  async listEnvs(projectId: string): Promise<Array<{ id: string; key: string; apiModeOnly: boolean; createdAt: number }>> {
    return await this.col('envs').find({ projectId }).sort({ key: 1 }).toArray() as any
  }

  async updateEnv(projectId: string, key: string, encryptedValue: string, apiModeOnly: boolean): Promise<void> {
    await this.col('envs').updateOne(
      { projectId, key },
      { $set: { encryptedValue, apiModeOnly } }
    )
  }

  async deleteEnv(projectId: string, key: string): Promise<void> {
    await this.col('envs').deleteOne({ projectId, key })
  }

  async createApiKey(projectId: string, encryptedValue: string, plainValue: string, ttl?: number): Promise<{ id: string }> {
    const id = crypto.randomUUID()
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined
    const lookupHash = crypto.createHash('sha256').update(plainValue).digest('hex')
    const doc = { id, projectId, encryptedValue, lookupHash, ttl: ttl ?? null, expiresAt: expiresAt ?? null, createdAt: Date.now() }
    await this.col('apiKeys').insertOne(doc)
    return { id }
  }

  async getApiKey(projectId: string, plainValue: string): Promise<{ id: string; expiresAt?: number } | null> {
    const lookupHash = crypto.createHash('sha256').update(plainValue).digest('hex')
    const doc = await this.col('apiKeys').findOne({ projectId, lookupHash }) as any
    if (!doc) return null
    if (doc.expiresAt && doc.expiresAt < Date.now()) return null
    return { id: doc.id, expiresAt: doc.expiresAt }
  }

  async listApiKeys(projectId: string): Promise<Array<{ id: string; maskedPreview: string; ttl?: number; expiresAt?: number; createdAt: number }>> {
    const docs = await this.col('apiKeys').find({ projectId }).sort({ createdAt: -1 }).toArray() as any[]
    return docs.map(d => ({
      id: d.id,
      maskedPreview: d.lookupHash.slice(0, 8) + '...',
      ttl: d.ttl,
      expiresAt: d.expiresAt,
      createdAt: d.createdAt,
    }))
  }

  async revokeApiKey(projectId: string, id: string): Promise<void> {
    await this.col('apiKeys').deleteOne({ id, projectId })
  }

  async createWhitelistEntry(projectId: string, fingerprint: string, status: 'pending' | 'approved' | 'rejected'): Promise<{ id: string }> {
    const doc = { id: crypto.randomUUID(), projectId, fingerprint, status, createdAt: Date.now() }
    await this.col('whitelist').updateOne(
      { projectId, fingerprint },
      { $set: doc },
      { upsert: true }
    )
    return { id: doc.id }
  }

  async getWhitelistEntry(projectId: string, fingerprint: string): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' } | null> {
    const doc = await this.col('whitelist').findOne({ projectId, fingerprint }) as any
    return doc ? { id: doc.id, status: doc.status } : null
  }

  async listWhitelistEntries(projectId: string): Promise<Array<{ id: string; fingerprint: string; status: 'pending' | 'approved' | 'rejected'; createdAt: number }>> {
    return await this.col('whitelist').find({ projectId }).sort({ createdAt: -1 }).toArray() as any
  }

  async updateWhitelistStatus(id: string, status: 'approved' | 'rejected'): Promise<void> {
    await this.col('whitelist').updateOne({ id }, { $set: { status } })
  }

  async storePkHash(hash: string): Promise<void> {
    await this.col('serverConfig').updateOne(
      { key: 'pk_hash' },
      { $set: { key: 'pk_hash', value: hash } },
      { upsert: true }
    )
  }

  async getPkHash(): Promise<string | null> {
    const doc = await this.col('serverConfig').findOne({ key: 'pk_hash' }) as any
    return doc?.value ?? null
  }

  private col(name: string) {
    if (!this.db) throw new HumanEnvError(ErrorCode.DB_OPERATION_FAILED, 'MongoDB not connected')
    return this.db.collection(name)
  }
}
