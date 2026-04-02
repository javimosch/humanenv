// humanenv CLI - entry point for bundling
const { Command } = require('commander')
const fs = require('fs')
const path = require('path')
const os = require('os')

const { generateFingerprint, SKILL_CONTENT } = require('../shared/index')
const { HumanEnvClient } = require('../ws-manager')

const CREDENTIALS_DIR = path.join(os.homedir(), '.humanenv')

// --json must be detected before Commander strips args
const rawArgs = process.argv.slice(2)
const isJson = rawArgs.includes('--json')
const cleanArgs = rawArgs.filter(a => a !== '--json' && a !== '-j')

// ==========================================================
// Helpers
// ==========================================================
function ensureSkillFile() {
  const skillPath = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
  if (!fs.existsSync(skillPath)) {
    fs.mkdirSync(path.dirname(skillPath), { recursive: true })
    fs.writeFileSync(skillPath, SKILL_CONTENT, 'utf8')
    if (process.stdout.isTTY && !isJson) console.log('Generated .agents/skills/humanenv-usage/SKILL.md')
  }
}

function ensureCredentialsDir() {
  if (!fs.existsSync(CREDENTIALS_DIR)) fs.mkdirSync(CREDENTIALS_DIR, { recursive: true })
}

function readCredentials() {
  const p = path.join(CREDENTIALS_DIR, 'credentials.json')
  if (!fs.existsSync(p)) return {}
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return {} }
}

function writeCredentials(data) {
  ensureCredentialsDir()
  fs.writeFileSync(path.join(CREDENTIALS_DIR, 'credentials.json'), JSON.stringify(data, null, 2), 'utf8')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function mergeProjectName(opts) { return opts.projectName || opts.pn }
function mergeServerUrl(opts)  { return opts.serverUrl  || opts.su }

// ==========================================================
// Auth
// ==========================================================
async function runAuth(opts) {
  ensureSkillFile()

  const projectName = mergeProjectName(opts)
  const serverUrl   = mergeServerUrl(opts)

  if (!projectName || !serverUrl) {
    if (isJson) console.log(JSON.stringify({ success: false, error: '--project-name and --server-url required' }))
    else console.error('Error: --project-name and --server-url required')
    process.exit(1)
  }

  writeCredentials({ projectName, serverUrl, apiKey: opts.apiKey || undefined })

  // --generate-api-key: one-shot, no poll
  if (opts.generateApiKey) {
    const client = new HumanEnvClient({ serverUrl, projectName, projectApiKey: opts.apiKey || '', maxRetries: 1 })
    try {
      await client.connect()
      const apiKey = await client.generateApiKey()
      if (isJson) console.log(JSON.stringify({ success: true, apiKey }))
      else console.log('API key generated:', apiKey)
    } catch (e) {
      if (isJson) console.log(JSON.stringify({ success: false, error: e.message }))
      else console.error('Auth failed: API key generation rejected or timeout')
      process.exit(1)
    } finally { client.disconnect() }
    return
  }

  // Normal auth
  let client = new HumanEnvClient({ serverUrl, projectName, projectApiKey: opts.apiKey || '', maxRetries: 1 })

  try {
    await client.connect()
  } catch (e) {
    if (isJson) console.log(JSON.stringify({ success: false, error: e.message }))
    else console.error('Auth failed:', e.message)
    process.exit(1)
  }

  if (client.whitelistStatus === 'approved') {
    if (isJson) console.log(JSON.stringify({ success: true, whitelisted: true }))
    else console.log('Successfully authenticated.')
  } else {
    if (process.stdout.isTTY && !isJson) {
      // TTY: poll every 1s, fresh client each attempt
      console.log('Successfully authenticated.')
      console.log('Your fingerprint is not approved yet by the server.')
      console.log('Waiting for admin approval...')
      let attempts = 0
      const MAX = 120
      while (attempts < MAX) {
        attempts++
        await sleep(1000)
        try {
          if (client) client.disconnect()
          await sleep(100)
          client = new HumanEnvClient({ serverUrl, projectName, projectApiKey: opts.apiKey || '', maxRetries: 1 })
          await client.connect()
          if (client.whitelistStatus === 'approved') {
            console.log('Whitelisted and approved.')
            break
          }
        } catch { /* retry */ }
      }
      if (!client || client.whitelistStatus !== 'approved') {
        console.log('Admin has not approved yet. The fingerprint will be pending until accepted.')
      }
    } else {
      // Non-TTY / --json: return immediately
      if (isJson) console.log(JSON.stringify({ success: true, whitelisted: false, status: client.whitelistStatus || 'pending' }))
      else {
        console.log('Successfully authenticated.')
        console.log('Your fingerprint is not approved yet by the server.')
        console.log('Pending approval.')
      }
    }
  }

  if (client) client.disconnect()
  if (!isJson) console.log('Credentials stored in', path.join(CREDENTIALS_DIR, 'credentials.json'))
}

// ==========================================================
// Resolve creds with overrides (get / set)
// ==========================================================
function resolveCreds(opts) {
  const stored    = readCredentials()
  const projectName = mergeProjectName(opts) || stored.projectName
  const serverUrl   = mergeServerUrl(opts)  || stored.serverUrl
  if (!projectName || !serverUrl) {
    if (isJson) console.log(JSON.stringify({ success: false, error: 'Not authenticated. Run: humanenv auth --project-name <name> --server-url <url>' }))
    else console.error('Error: Not authenticated. Run: humanenv auth --project-name <name> --server-url <url>')
    process.exit(1)
  }
  return { projectName, serverUrl, apiKey: opts.apiKey || stored.apiKey || '' }
}

// ==========================================================
// Sub-commands
// ==========================================================
const program = new Command()

const nameOpt = { flags: '--project-name <name>', description: 'Project name' }
const urlOpt  = { flags: '--server-url <url>',    description: 'Server URL' }
const pnOpt   = { flags: '--pn <name>',           description: 'Project name (alias)' }
const suOpt   = { flags: '--su <url>',            description: 'Server URL (alias)' }

// auth
program
  .command('auth')
  .description('Authenticate with a HumanEnv server')
  .option(nameOpt.flags, nameOpt.description)
  .option(pnOpt.flags, pnOpt.description)
  .option(urlOpt.flags, urlOpt.description)
  .option(suOpt.flags, suOpt.description)
  .option('--api-key <key>', 'API key (optional)')
  .option('--generate-api-key', 'Request a new API key from the server')
  .action(async (opts) => { await runAuth(opts) })

// get
program
  .command('get')
  .description('Retrieve an environment variable')
  .argument('<key>', 'Environment variable key')
  .option(nameOpt.flags, nameOpt.description)
  .option(pnOpt.flags, pnOpt.description)
  .option(urlOpt.flags, urlOpt.description)
  .option(suOpt.flags, suOpt.description)
  .action(async (key, opts) => {
    const creds = resolveCreds(opts)
    const client = new HumanEnvClient({ serverUrl: creds.serverUrl, projectName: creds.projectName, projectApiKey: creds.apiKey || '', maxRetries: 3 })
    try {
      await client.connect()
      const value = await client.get(key)
      if (isJson)     console.log(JSON.stringify({ value }))
      else if (!process.stdout.isTTY) process.stdout.write(value)
      else            console.log(value)
    } catch (e) {
      if (isJson) console.log(JSON.stringify({ success: false, error: e.message }))
      else console.error('Failed to get env:', e.message)
      process.exit(1)
    } finally { client.disconnect() }
  })

// set
program
  .command('set')
  .description('Set an environment variable')
  .argument('<key>', 'Environment variable key')
  .argument('<value>', 'Environment variable value')
  .option(nameOpt.flags, nameOpt.description)
  .option(pnOpt.flags, pnOpt.description)
  .option(urlOpt.flags, urlOpt.description)
  .option(suOpt.flags, suOpt.description)
  .action(async (key, value, opts) => {
    const creds = resolveCreds(opts)
    const client = new HumanEnvClient({ serverUrl: creds.serverUrl, projectName: creds.projectName, projectApiKey: creds.apiKey || '', maxRetries: 3 })
    try {
      await client.connect()
      await client.set(key, value)
      if (isJson) console.log(JSON.stringify({ success: true }))
      else        console.log('Set', key)
    } catch (e) {
      if (isJson) console.log(JSON.stringify({ success: false, error: e.message }))
      else console.error('Failed to set env:', e.message)
      process.exit(1)
    } finally { client.disconnect() }
  })

program.parse(cleanArgs)

// No sub-command matched → bare `humanenv`
if (!process.argv.slice(2).some(a => /^auth|get|set$/.test(a))) {
  ensureSkillFile()
  if (!process.stdout.isTTY || isJson) {
    const sp = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
    if (fs.existsSync(sp)) console.log(fs.readFileSync(sp, 'utf8'))
  } else {
    console.log('HumanEnv - Secure environment variable injection')
    console.log('')
    console.log('Usage:')
    console.log('  humanenv auth --project-name <name> --server-url <url> [--api-key <key>]')
    console.log('  humanenv auth --project-name <name> --server-url <url> --generate-api-key')
    console.log('  humanenv get <key>')
    console.log('  your-app set <key> <value>')
    console.log('Flags:')
    console.log('  --pn  alias for --project-name')
    console.log('  --su  alias for --server-url')
    console.log('  --json  output JSON, behave like non-TTY')
    console.log('')
  }
}
