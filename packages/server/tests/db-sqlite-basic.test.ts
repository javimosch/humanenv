import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { SqliteProvider } from '../src/db/sqlite.ts'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('SqliteProvider - Projects', () => {
  let db: SqliteProvider
  let dbPath: string

  beforeEach(async () => {
    // Create temp file for each test
    dbPath = path.join('/tmp', `humanenv-test-${Date.now()}-${Math.random()}.db`)
    db = new SqliteProvider(dbPath)
    await db.connect()
  })

  afterEach(async () => {
    await db.disconnect()
    // Clean up temp file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  it('createProject returns id', async () => {
    const result = await db.createProject('test-project')
    assert.ok(result.id)
    assert.strictEqual(typeof result.id, 'string')
  })

  it('getProject retrieves by name', async () => {
    await db.createProject('my-app')
    const project = await db.getProject('my-app')
    
    assert.ok(project)
    assert.strictEqual(project?.name, 'my-app')
    assert.ok(project?.createdAt)
  })

  it('getProject returns null for missing project', async () => {
    const project = await db.getProject('nonexistent')
    assert.strictEqual(project, null)
  })

  it('listProjects returns all projects sorted by date', async () => {
    await db.createProject('project-a')
    await new Promise(r => setTimeout(r, 10))
    await db.createProject('project-b')
    
    const projects = await db.listProjects()
    assert.strictEqual(projects.length, 2)
    // Most recent first
    assert.strictEqual(projects[0].name, 'project-b')
    assert.strictEqual(projects[1].name, 'project-a')
  })

  it('deleteProject removes project', async () => {
    await db.createProject('to-delete')
    const project = await db.getProject('to-delete')
    assert.ok(project)
    
    await db.deleteProject(project!.id)
    const afterDelete = await db.getProject('to-delete')
    assert.strictEqual(afterDelete, null)
  })

  it('deleteProject cascades to envs', async () => {
    const project = await db.createProject('cascade-test')
    await db.createEnv(project.id, 'KEY1', 'encrypted-value-1', false)
    await db.createEnv(project.id, 'KEY2', 'encrypted-value-2', true)
    
    await db.deleteProject(project.id)
    
    const envs = await db.listEnvs(project.id)
    assert.strictEqual(envs.length, 0)
  })

  it('rejects duplicate project names', async () => {
    await db.createProject('duplicate')
    
    try {
      await db.createProject('duplicate')
      assert.fail('Should have failed')
    } catch (err: any) {
      assert.ok(err.message.includes('UNIQUE constraint failed'))
    }
  })
})

describe('SqliteProvider - Envs', () => {
  let db: SqliteProvider
  let dbPath: string
  let projectId: string

  beforeEach(async () => {
    dbPath = path.join('/tmp', `humanenv-test-${Date.now()}-${Math.random()}.db`)
    db = new SqliteProvider(dbPath)
    await db.connect()
    const project = await db.createProject('env-test-project')
    projectId = project.id
  })

  afterEach(async () => {
    await db.disconnect()
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  it('createEnv stores encrypted value', async () => {
    const result = await db.createEnv(projectId, 'API_KEY', 'encrypted-abc123', false)
    assert.ok(result.id)
  })

  it('getEnv retrieves encrypted value and apiModeOnly', async () => {
    await db.createEnv(projectId, 'SECRET', 'encrypted-xyz', true)
    const env = await db.getEnv(projectId, 'SECRET')
    
    assert.ok(env)
    assert.strictEqual(env?.encryptedValue, 'encrypted-xyz')
    assert.strictEqual(env?.apiModeOnly, true)
  })

  it('getEnv returns null for missing key', async () => {
    const env = await db.getEnv(projectId, 'MISSING')
    assert.strictEqual(env, null)
  })

  it('updateEnv updates existing key', async () => {
    await db.createEnv(projectId, 'KEY', 'old-value', false)
    await db.updateEnv(projectId, 'KEY', 'new-value', true)
    
    const env = await db.getEnv(projectId, 'KEY')
    assert.strictEqual(env?.encryptedValue, 'new-value')
    assert.strictEqual(env?.apiModeOnly, true)
  })

  it('listEnvs returns all envs for project', async () => {
    await db.createEnv(projectId, 'KEY_A', 'val-a', false)
    await db.createEnv(projectId, 'KEY_B', 'val-b', true)
    
    const envs = await db.listEnvs(projectId)
    assert.strictEqual(envs.length, 2)
    // Sorted by key
    assert.strictEqual(envs[0].key, 'KEY_A')
    assert.strictEqual(envs[1].key, 'KEY_B')
    assert.strictEqual(envs[1].apiModeOnly, true)
  })

  it('deleteEnv removes env', async () => {
    await db.createEnv(projectId, 'TO_DELETE', 'value', false)
    await db.deleteEnv(projectId, 'TO_DELETE')
    
    const env = await db.getEnv(projectId, 'TO_DELETE')
    assert.strictEqual(env, null)
  })
})

describe('SqliteProvider - PK Hash', () => {
  let db: SqliteProvider
  let dbPath: string

  beforeEach(async () => {
    dbPath = path.join('/tmp', `humanenv-test-${Date.now()}-${Math.random()}.db`)
    db = new SqliteProvider(dbPath)
    await db.connect()
  })

  afterEach(async () => {
    await db.disconnect()
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  it('storePkHash and getPkHash roundtrip', async () => {
    const testHash = 'abc123def456789'
    await db.storePkHash(testHash)
    
    const retrieved = await db.getPkHash()
    assert.strictEqual(retrieved, testHash)
  })

  it('getPkHash returns null when not set', async () => {
    const hash = await db.getPkHash()
    assert.strictEqual(hash, null)
  })

  it('storePkHash updates existing hash', async () => {
    await db.storePkHash('hash-v1')
    await db.storePkHash('hash-v2')
    
    const retrieved = await db.getPkHash()
    assert.strictEqual(retrieved, 'hash-v2')
  })
})
