import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { LocalDatabase } from 'humanenv-shared'
import { derivePkFromMnemonic, validateMnemonic, hashPkForVerification, encryptWithPk, decryptWithPk, generateFingerprint, generateMnemonic as genMnemonic } from 'humanenv-shared'
import inquirer from 'inquirer'

const LOCAL_DB_DIR = path.join(os.homedir(), '.humanenv')
const LOCAL_DB_PATH = path.join(LOCAL_DB_DIR, 'data.db')
const LOCK_FILE_PATH = path.join(LOCAL_DB_DIR, '.lock')
const MAX_AUTH_ATTEMPTS = 3
const LOCK_DURATION_MS = 60 * 1000

export interface LocalSession {
  db: LocalDatabase
  pk: Buffer
  mnemonic: string
  projectId: string | null
  projectName: string | null
}

export interface AuthResult {
  success: boolean
  error?: string
  hint?: string
}

function getLockInfo(): { attempts: number; lockedUntil?: number } {
  if (!fs.existsSync(LOCK_FILE_PATH)) return { attempts: 0 }
  try {
    const content = fs.readFileSync(LOCK_FILE_PATH, 'utf8')
    const data = JSON.parse(content)
    if (data.lockedUntil && Date.now() < data.lockedUntil) {
      return { attempts: data.attempts, lockedUntil: data.lockedUntil }
    }
    fs.unlinkSync(LOCK_FILE_PATH)
    return { attempts: 0 }
  } catch {
    return { attempts: 0 }
  }
}

function incrementLockAttempts(): { attempts: number; lockedUntil?: number } {
  const lock = getLockInfo()
  const attempts = (lock.attempts || 0) + 1
  if (attempts >= MAX_AUTH_ATTEMPTS) {
    const lockedUntil = Date.now() + LOCK_DURATION_MS
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify({ attempts, lockedUntil }), { mode: 0o600 })
    return { attempts, lockedUntil }
  }
  fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify({ attempts }), { mode: 0o600 })
  return { attempts }
}

function clearLock(): void {
  if (fs.existsSync(LOCK_FILE_PATH)) {
    fs.unlinkSync(LOCK_FILE_PATH)
  }
}

function isLocked(): { locked: boolean; remainingMs?: number } {
  const lock = getLockInfo()
  if (lock.lockedUntil) {
    const remainingMs = lock.lockedUntil - Date.now()
    return { locked: remainingMs > 0, remainingMs }
  }
  return { locked: false }
}

export async function ensureLocalDb(): Promise<LocalDatabase> {
  if (!fs.existsSync(LOCAL_DB_DIR)) {
    fs.mkdirSync(LOCAL_DB_DIR, { recursive: true })
  }
  const db = new LocalDatabase(LOCAL_DB_PATH)
  await db.connect()
  return db
}

export async function authenticateMnemonic(mnemonic: string, db: LocalDatabase): Promise<AuthResult> {
  const lockStatus = isLocked()
  if (lockStatus.locked) {
    const secs = Math.ceil((lockStatus.remainingMs || 0) / 1000)
    return {
      success: false,
      error: `Too many failed attempts. Try again in ${secs} seconds.`,
      hint: `Remove ${LOCK_FILE_PATH} if you're the admin and need to reset urgently.`
    }
  }

  if (!mnemonic || !validateMnemonic(mnemonic)) {
    const lock = incrementLockAttempts()
    if (lock.lockedUntil) {
      const secs = Math.ceil((lock.lockedUntil - Date.now()) / 1000)
      return {
        success: false,
        error: `Invalid mnemonic. Locked for ${secs} seconds.`,
        hint: `Remove ${LOCK_FILE_PATH} if you're the admin and need to reset urgently.`
      }
    }
    return {
      success: false,
      error: 'Invalid mnemonic. Must be a 12-word BIP39 phrase.',
      hint: `Attempts: ${lock.attempts}/${MAX_AUTH_ATTEMPTS}`
    }
  }

  const storedHash = await db.getPkHash()
  const pk = derivePkFromMnemonic(mnemonic)
  const derivedHash = hashPkForVerification(pk)

  if (storedHash && derivedHash !== storedHash) {
    const lock = incrementLockAttempts()
    return {
      success: false,
      error: 'Mnemonic does not match the stored key.',
      hint: lock.lockedUntil
        ? `Locked for ${Math.ceil((lock.lockedUntil - Date.now()) / 1000)} seconds.`
        : `Attempts: ${lock.attempts}/${MAX_AUTH_ATTEMPTS}`
    }
  }

  clearLock()
  return { success: true }
}

export async function authenticateFromEnv(db: LocalDatabase): Promise<AuthResult & { pk?: Buffer; mnemonic?: string }> {
  const mnemonicEnv = process.env.HUMANENV_LOCAL_MNEMONIC
  if (!mnemonicEnv) {
    return { success: false, error: 'HUMANENV_LOCAL_MNEMONIC not set', hint: 'Run: export HUMANENV_LOCAL_MNEMONIC="your 12-word mnemonic"' }
  }
  const result = await authenticateMnemonic(mnemonicEnv, db)
  if (!result.success) return result
  const pk = derivePkFromMnemonic(mnemonicEnv)
  return { success: true, pk, mnemonic: mnemonicEnv }
}

export async function promptMnemonic(db: LocalDatabase, isInteractive: boolean): Promise<AuthResult & { pk?: Buffer; mnemonic?: string }> {
  const lockStatus = isLocked()
  if (lockStatus.locked) {
    const secs = Math.ceil((lockStatus.remainingMs || 0) / 1000)
    return {
      success: false,
      error: `Locked. Try again in ${secs} seconds.`,
      hint: `Remove ${LOCK_FILE_PATH} if you're the admin and need to reset urgently.`
    }
  }

  if (!isInteractive) {
    return { success: false, error: 'HUMANENV_LOCAL_MNEMONIC not set', hint: 'Run: export HUMANENV_LOCAL_MNEMONIC="your 12-word mnemonic"' }
  }

  const { mnemonic } = await inquirer.prompt([
    {
      type: 'password',
      name: 'mnemonic',
      message: 'Enter your 12-word mnemonic:',
      mask: '*',
      validate: (input: string) => {
        const words = input.trim().toLowerCase().split(/\s+/)
        if (words.length !== 12) return 'Must be exactly 12 words'
        const valid = words.every(w => /^[a-z]+$/.test(w))
        if (!valid) return 'All words must be lowercase letters only'
        return true
      }
    }
  ])

  const result = await authenticateMnemonic(mnemonic, db)
  if (!result.success) return result

  const pk = derivePkFromMnemonic(mnemonic)
  console.log('\n✓ Authenticated. Run this command to export your mnemonic:')
  console.log(`  export HUMANENV_LOCAL_MNEMONIC="${mnemonic}"`)
  console.log('')
  return { success: true, pk, mnemonic }
}

export async function getOrCreateSession(isInteractive: boolean): Promise<LocalSession | null> {
  const db = await ensureLocalDb()

  let authResult = await authenticateFromEnv(db)
  if (!authResult.success) {
    if (isInteractive) {
      authResult = await promptMnemonic(db, isInteractive)
    }
    if (!authResult.success) {
      await db.disconnect()
      if (isInteractive) {
        console.error('Error:', authResult.error)
        if (authResult.hint) console.error('Hint:', authResult.hint)
      }
      return null
    }
  }

  const pk = authResult.pk!
  const mnemonic = authResult.mnemonic!
  const projects = await db.listProjects()

  return { db, pk, mnemonic, projectId: null, projectName: null }
}

export function encrypt(value: string, pk: Buffer, projectId: string, key: string): string {
  return encryptWithPk(value, pk, `${projectId}:${key}`)
}

export function decrypt(encryptedValue: string, pk: Buffer, projectId: string, key: string): string {
  return decryptWithPk(encryptedValue, pk, `${projectId}:${key}`)
}

export async function runLocalInit(mnemonic?: string, isInteractive = false, force = false): Promise<void> {
  const existingDb = fs.existsSync(LOCAL_DB_PATH)
  
  if (existingDb && !force) {
    console.error('Error: Database already exists at ~/.humanenv/data.db')
    console.error('Use --force to reset the database, or manually delete it first.')
    process.exit(1)
  }

  if (existingDb && force) {
    if (isInteractive) {
      const { confirmReset } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmReset',
          message: 'Database exists. Reset it? This will delete ALL data.',
          default: false
        }
      ])
      if (!confirmReset) {
        console.log('Cancelled.')
        return
      }
    }
    fs.unlinkSync(LOCAL_DB_PATH)
    console.log('Existing database deleted.')
  }

  const db = await ensureLocalDb()

  if (mnemonic) {
    const result = await authenticateMnemonic(mnemonic, db)
    if (!result.success) {
      console.error('Error:', result.error)
      await db.disconnect()
      process.exit(1)
    }
  } else if (isInteractive) {
    const { useExisting } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useExisting',
        message: 'Do you have an existing mnemonic?',
        default: false
      }
    ])

    if (useExisting) {
      const { enteredMnemonic } = await inquirer.prompt([
        {
          type: 'password',
          name: 'enteredMnemonic',
          message: 'Enter your 12-word mnemonic:',
          mask: '*'
        }
      ])
      const enteredMn = enteredMnemonic
      const result = await authenticateMnemonic(enteredMn, db)
      if (!result.success) {
        console.error('Error:', result.error)
        await db.disconnect()
        process.exit(1)
      }
    }
  }

  mnemonic = mnemonic || generateMnemonicWords()
  const pk = derivePkFromMnemonic(mnemonic)
  const hash = hashPkForVerification(pk)

  await db.storePkHash(hash)

  if (isInteractive) {
    const { projectName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Enter a name for your first project:',
        default: 'default',
        validate: (input: string) => {
          if (!input.trim()) return 'Project name cannot be empty'
          if (input.length > 50) return 'Project name too long'
          return true
        }
      }
    ])
    await db.createProject(projectName)
    console.log(`\n✓ Created project "${projectName}"`)
  } else {
    const project = await db.createProject('default')
    console.log('\n✓ Created default project')
  }

  console.log('\n✓ Local database initialized at ~/.humanenv/data.db')
  console.log('\nYour mnemonic is:')
  console.log(`  ${mnemonic}`)
  console.log('\n⚠️  Save this mnemonic securely! It cannot be recovered.')
  console.log('\nRun this command to export your mnemonic:')
  console.log(`  export HUMANENV_LOCAL_MNEMONIC="${mnemonic}"`)
  console.log('')

  await db.disconnect()
}

function generateMnemonicWords(): string {
  return genMnemonic()
}

export async function runLocalGet(key: string, isInteractive: boolean): Promise<void> {
  const session = await getOrCreateSession(isInteractive)
  if (!session) {
    process.exit(1)
  }

  const projects = await session.db.listProjects()

  if (projects.length === 0) {
    console.error('Error: No projects found. Run "humanenv local init" first.')
    await session.db.disconnect()
    process.exit(1)
  }

  let projectId = projects[0].id
  let projectName = projects[0].name

  if (projects.length > 1) {
    if (!isInteractive) {
      console.error('Error: Multiple projects found. Use -i to select one.')
      await session.db.disconnect()
      process.exit(1)
    }
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select a project:',
        choices: projects.map(p => ({ name: p.name, value: p.id }))
      }
    ])
    projectId = selected
    projectName = projects.find(p => p.id === projectId)!.name
  }

  const env = await session.db.getEnv(projectId, key)
  if (!env) {
    console.error(`Error: Key "${key}" not found in project "${projectName}"`)
    await session.db.disconnect()
    process.exit(1)
  }

  const decrypted = decrypt(env.encryptedValue, session.pk, projectId, key)
  console.log(decrypted)
  await session.db.disconnect()
}

export async function runLocalSet(key: string, value: string, isInteractive: boolean, force = false): Promise<void> {
  if (!isInteractive && !force) {
    console.error('Error: Setting env values in non-interactive mode requires --force flag.')
    console.error('Or run with -i to use interactive mode.')
    process.exit(1)
  }

  const session = await getOrCreateSession(isInteractive)
  if (!session) {
    process.exit(1)
  }
  if (!session) {
    process.exit(1)
  }

  const projects = await session.db.listProjects()
  if (projects.length === 0) {
    console.error('Error: No projects found. Run "humanenv local init" first.')
    await session.db.disconnect()
    process.exit(1)
  }

  let projectId = projects[0].id
  let projectName = projects[0].name

  if (projects.length > 1) {
    if (!isInteractive) {
      console.error('Error: Multiple projects found. Use -i to select one.')
      await session.db.disconnect()
      process.exit(1)
    }
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select a project:',
        choices: projects.map(p => ({ name: p.name, value: p.id }))
      }
    ])
    projectId = selected
    projectName = projects.find(p => p.id === projectId)!.name
  }

  const encrypted = encrypt(value, session.pk, projectId, key)
  const existing = await session.db.getEnv(projectId, key)

  if (existing) {
    if (isInteractive) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Update existing key "${key}"?`,
          default: true
        }
      ])
      if (!confirm) {
        console.log('Cancelled.')
        await session.db.disconnect()
        return
      }
    }
    await session.db.updateEnv(projectId, key, encrypted)
    console.log(`Updated ${key} in project "${projectName}"`)
  } else {
    await session.db.createEnv(projectId, key, encrypted)
    console.log(`Created ${key} in project "${projectName}"`)
  }

  await session.db.disconnect()
}

export async function runLocalProjects(isInteractive: boolean): Promise<void> {
  const session = await getOrCreateSession(isInteractive)
  if (!session) {
    process.exit(1)
  }

  const projects = await session.db.listProjects()

  if (!isInteractive) {
    if (projects.length === 0) {
      console.log('[]')
      await session.db.disconnect()
      return
    }
    console.log(JSON.stringify(projects, null, 2))
    await session.db.disconnect()
    return
  }

  const choices = [
    { name: 'List projects', value: 'list' },
    { name: 'Add project', value: 'add' },
    { name: 'Delete project', value: 'delete' }
  ]

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices
    }
  ])

  switch (action) {
    case 'list':
      if (projects.length === 0) {
        console.log('No projects found.')
      } else {
        console.log('\nProjects:')
        projects.forEach(p => {
          console.log(`  - ${p.name} (${new Date(p.createdAt).toISOString()})`)
        })
      }
      break

    case 'add':
      const { newName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newName',
          message: 'Enter project name:',
          validate: (input: string) => {
            if (!input.trim()) return 'Name cannot be empty'
            if (projects.some(p => p.name === input)) return 'Project already exists'
            return true
          }
        }
      ])
      await session.db.createProject(newName)
      console.log(`\n✓ Created project "${newName}"`)
      break

    case 'delete':
      if (projects.length === 0) {
        console.log('No projects to delete.')
        break
      }
      const { selectedProject, confirmDelete } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProject',
          message: 'Select project to delete:',
          choices: projects.map(p => ({ name: p.name, value: p.id }))
        },
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: 'Are you sure? This will delete all envs, api keys, and whitelist entries.',
          default: false
        }
      ])
      if (confirmDelete) {
        await session.db.deleteProject(selectedProject)
        console.log('\n✓ Deleted project')
      } else {
        console.log('Cancelled.')
      }
      break
  }

  await session.db.disconnect()
}

export async function runLocalEnvs(isInteractive: boolean): Promise<void> {
  const session = await getOrCreateSession(isInteractive)
  if (!session) {
    process.exit(1)
  }

  const projects = await session.db.listProjects()
  if (projects.length === 0) {
    console.error('Error: No projects found.')
    await session.db.disconnect()
    process.exit(1)
  }

  let projectId = projects[0].id
  if (projects.length > 1) {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select a project:',
        choices: projects.map(p => ({ name: p.name, value: p.id }))
      }
    ])
    projectId = selected
  }

  const envs = await session.db.listEnvs(projectId)

  if (!isInteractive) {
    if (envs.length === 0) {
      console.log('[]')
    } else {
      console.log(JSON.stringify(envs, null, 2))
    }
    await session.db.disconnect()
    return
  }

  const choices = [
    { name: 'List envs', value: 'list' },
    { name: 'Add/Update env', value: 'add' },
    { name: 'Delete env', value: 'delete' }
  ]

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices
    }
  ])

  switch (action) {
    case 'list':
      if (envs.length === 0) {
        console.log('No envs found.')
      } else {
        console.log('\nEnvs:')
        envs.forEach(e => {
          console.log(`  - ${e.key} (${new Date(e.createdAt).toISOString()})`)
        })
      }
      break

    case 'add':
      const { envKey, envValue } = await inquirer.prompt([
        { type: 'input', name: 'envKey', message: 'Enter env key:' },
        { type: 'input', name: 'envValue', message: 'Enter env value:' }
      ])
      const encrypted = encrypt(envValue, session.pk, projectId, envKey)
      const existing = await session.db.getEnv(projectId, envKey)
      if (existing) {
        await session.db.updateEnv(projectId, envKey, encrypted)
        console.log(`\n✓ Updated "${envKey}"`)
      } else {
        await session.db.createEnv(projectId, envKey, encrypted)
        console.log(`\n✓ Created "${envKey}"`)
      }
      break

    case 'delete':
      if (envs.length === 0) {
        console.log('No envs to delete.')
        break
      }
      const { selectedEnv, confirmDelete } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedEnv',
          message: 'Select env to delete:',
          choices: envs.map(e => ({ name: e.key, value: e.key }))
        },
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: 'Are you sure?',
          default: false
        }
      ])
      if (confirmDelete) {
        await session.db.deleteEnv(projectId, selectedEnv)
        console.log('\n✓ Deleted env')
      } else {
        console.log('Cancelled.')
      }
      break
  }

  await session.db.disconnect()
}

export async function runLocalApiKeys(isInteractive: boolean): Promise<void> {
  const session = await getOrCreateSession(isInteractive)
  if (!session) {
    process.exit(1)
  }

  const projects = await session.db.listProjects()
  if (projects.length === 0) {
    console.error('Error: No projects found.')
    await session.db.disconnect()
    process.exit(1)
  }

  let projectId = projects[0].id
  if (projects.length > 1) {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select a project:',
        choices: projects.map(p => ({ name: p.name, value: p.id }))
      }
    ])
    projectId = selected
  }

  const apiKeys = await session.db.listApiKeys(projectId)

  if (!isInteractive) {
    if (apiKeys.length === 0) {
      console.log('[]')
    } else {
      console.log(JSON.stringify(apiKeys, null, 2))
    }
    await session.db.disconnect()
    return
  }

  const choices = [
    { name: 'List API keys', value: 'list' },
    { name: 'Create API key', value: 'create' },
    { name: 'Revoke API key', value: 'revoke' }
  ]

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices
    }
  ])

  switch (action) {
    case 'list':
      if (apiKeys.length === 0) {
        console.log('No API keys found.')
      } else {
        console.log('\nAPI Keys:')
        apiKeys.forEach(k => {
          const expires = k.expiresAt ? new Date(k.expiresAt).toISOString() : 'never'
          console.log(`  - ${k.maskedPreview} (${k.name || 'unnamed'}) - expires: ${expires}`)
        })
      }
      break

    case 'create':
      const { name, ttl } = await inquirer.prompt([
        { type: 'input', name: 'name', message: 'Enter API key name (optional):' },
        {
          type: 'input',
          name: 'ttl',
          message: 'Enter TTL in seconds (optional, leave empty for no expiration):',
          validate: (input: string) => {
            if (!input) return true
            const num = parseInt(input, 10)
            if (isNaN(num) || num <= 0) return 'Must be a positive number'
            return true
          }
        }
      ])
      const plainKey = crypto.randomBytes(32).toString('hex')
      const encrypted = encryptWithPk(plainKey, session.pk, `${projectId}:apikey:${plainKey.slice(0, 8)}`)
      const ttlNum = ttl ? parseInt(ttl, 10) : undefined
      await session.db.createApiKey(projectId, encrypted, plainKey, ttlNum, name || undefined)
      console.log(`\n✓ Created API key`)
      console.log(`  Name: ${name || 'unnamed'}`)
      console.log(`  Key: ${plainKey}`)
      console.log('⚠️  Save this key! It cannot be recovered.')
      break

    case 'revoke':
      if (apiKeys.length === 0) {
        console.log('No API keys to revoke.')
        break
      }
      const { selectedKey, confirmRevoke } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedKey',
          message: 'Select API key to revoke:',
          choices: apiKeys.map(k => ({ name: `${k.maskedPreview} (${k.name || 'unnamed'})`, value: k.id }))
        },
        {
          type: 'confirm',
          name: 'confirmRevoke',
          message: 'Are you sure? This cannot be undone.',
          default: false
        }
      ])
      if (confirmRevoke) {
        await session.db.revokeApiKey(projectId, selectedKey)
        console.log('\n✓ Revoked API key')
      } else {
        console.log('Cancelled.')
      }
      break
  }

  await session.db.disconnect()
}

export async function runLocalWhitelist(isInteractive: boolean): Promise<void> {
  const session = await getOrCreateSession(isInteractive)
  if (!session) {
    process.exit(1)
  }

  const projects = await session.db.listProjects()
  if (projects.length === 0) {
    console.error('Error: No projects found.')
    await session.db.disconnect()
    process.exit(1)
  }

  let projectId = projects[0].id
  if (projects.length > 1) {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select a project:',
        choices: projects.map(p => ({ name: p.name, value: p.id }))
      }
    ])
    projectId = selected
  }

  const entries = await session.db.listWhitelistEntries(projectId)

  if (!isInteractive) {
    if (entries.length === 0) {
      console.log('[]')
    } else {
      console.log(JSON.stringify(entries, null, 2))
    }
    await session.db.disconnect()
    return
  }

  const choices = [
    { name: 'List whitelist entries', value: 'list' },
    { name: 'Approve fingerprint', value: 'approve' },
    { name: 'Reject fingerprint', value: 'reject' }
  ]

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices
    }
  ])

  switch (action) {
    case 'list':
      if (entries.length === 0) {
        console.log('No whitelist entries.')
      } else {
        console.log('\nWhitelist entries:')
        entries.forEach(e => {
          const statusIcon = e.status === 'approved' ? '✓' : e.status === 'rejected' ? '✗' : '○'
          console.log(`  ${statusIcon} ${e.fingerprint} (${e.status}) - ${new Date(e.createdAt).toISOString()}`)
        })
      }
      break

    case 'approve':
    case 'reject':
      const pendingEntries = entries.filter(e => e.status === 'pending')
      if (pendingEntries.length === 0) {
        console.log('No pending entries to process.')
        break
      }
      const { selectedEntry, confirmUpdate } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedEntry',
          message: `Select fingerprint to ${action}:`,
          choices: pendingEntries.map(e => ({ name: e.fingerprint, value: e.id }))
        },
        {
          type: 'confirm',
          name: 'confirmUpdate',
          message: `${action === 'approve' ? 'Approve' : 'Reject'} this fingerprint?`,
          default: true
        }
      ])
      if (confirmUpdate) {
        await session.db.updateWhitelistStatus(selectedEntry, action === 'approve' ? 'approved' : 'rejected')
        console.log(`\n✓ ${action === 'approve' ? 'Approved' : 'Rejected'} fingerprint`)
      } else {
        console.log('Cancelled.')
      }
      break
  }

  await session.db.disconnect()
}

export async function runLocalExport(filePath: string, isInteractive: boolean): Promise<void> {
  const session = await getOrCreateSession(isInteractive)
  if (!session) {
    process.exit(1)
  }

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: [] as any[],
    apiKeys: [] as any[],
    whitelist: [] as any[],
    globalSettings: [] as any[]
  }

  const projects = await session.db.listProjects()
  for (const project of projects) {
    const projectData = await session.db.getProjectById(project.id)
    if (projectData) {
      exportData.projects.push(projectData)
    }
    const envs = await session.db.listEnvsWithValues(project.id)
    exportData.projects.push(...envs)
  }

  const allProjects = await session.db.listProjects()
  const apiKeys = await session.db.listApiKeys(allProjects[0]?.id || '')
  exportData.apiKeys.push(...apiKeys)

  const whitelist = await session.db.listWhitelistEntries(allProjects[0]?.id || '')
  exportData.whitelist.push(...whitelist)

  const globalKeys = ['pk_hash', 'temporal-pk']
  for (const key of globalKeys) {
    const value = await session.db.getGlobalSetting(key)
    if (value) {
      exportData.globalSettings.push({ key, value })
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), { mode: 0o600 })
  console.log(`✓ Exported to ${filePath}`)

  await session.db.disconnect()
}

export async function runLocalImport(filePath: string, isInteractive: boolean): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`)
    process.exit(1)
  }

  const session = await getOrCreateSession(isInteractive)
  if (!session) {
    process.exit(1)
  }

  let importData: any
  try {
    importData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    console.error('Error: Invalid JSON file')
    await session.db.disconnect()
    process.exit(1)
  }

  if (!importData.version || !importData.projects) {
    console.error('Error: Invalid export file format')
    await session.db.disconnect()
    process.exit(1)
  }

  if (isInteractive) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'This will merge data into existing database. Continue?',
        default: false
      }
    ])
    if (!confirm) {
      console.log('Cancelled.')
      await session.db.disconnect()
      return
    }
  }

  let importedProjects = 0
  let importedEnvs = 0

  for (const item of importData.projects) {
    if (item.encryptedValue !== undefined) {
      const project = await session.db.getProject(item.projectId || item.id)
      if (project) {
        await session.db.createEnv(project.id, item.key, item.encryptedValue)
        importedEnvs++
      }
    }
  }

  for (const item of importData.globalSettings || []) {
    await session.db.storeGlobalSetting(item.key, item.value)
  }

  console.log(`✓ Imported ${importedProjects} projects and ${importedEnvs} envs`)

  await session.db.disconnect()
}