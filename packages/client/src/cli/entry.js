// humanenv CLI - entry point for bundling
const { Command } = require('commander')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

const { generateFingerprint, SKILL_CONTENT } = require('../shared/index')
const { HumanEnvClient } = require('../ws-manager')

const CREDENTIALS_DIR = path.join(os.homedir(), '.humanenv')

// --json / -j detected before Commander strips args
const rawArgs  = process.argv.slice(2)
const isJson   = rawArgs.includes('--json') || rawArgs.includes('-j')
const cleanArgs = rawArgs.filter(a => a !== '--json' && a !== '-j')
const hasCmd   = ['auth', 'get', 'set', 'server'].some(c => cleanArgs.includes(c))
const wantsHelp = cleanArgs.includes('--help') || cleanArgs.includes('-h')

// ==========================================================
// Helpers
// ==========================================================
function ensureSkillFile() {
  const sp = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
  if (!fs.existsSync(sp)) {
    fs.mkdirSync(path.dirname(sp), { recursive: true })
    fs.writeFileSync(sp, SKILL_CONTENT, 'utf8')
  }
  return sp
}

function readCredentials() {
  const p = path.join(CREDENTIALS_DIR, 'credentials.json')
  if (!fs.existsSync(p)) return {}
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return {} }
}

function writeCredentials(d) {
  if (!fs.existsSync(CREDENTIALS_DIR)) fs.mkdirSync(CREDENTIALS_DIR, { recursive: true })
  fs.writeFileSync(path.join(CREDENTIALS_DIR, 'credentials.json'), JSON.stringify(d, null, 2), 'utf8')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const pName    = o => o.projectName || o.pn
const pUrl     = o => o.serverUrl   || o.su
const nameOpt  = ['--project-name <name>', 'Project name']
const urlOpt   = ['--server-url <url>',    'Server URL']
const pnOpt    = ['--pn <name>',           'Project name (shorthand)']
const suOpt    = ['--su <url>',            'Server URL (shorthand)']

// ==========================================================
// Bare "humanenv" → show help (TTY) or skill (non-TTY / --json)
// ==========================================================
if (!hasCmd && !wantsHelp) {
  const sp = ensureSkillFile()
  if (!process.stdout.isTTY || isJson) {
    console.log(fs.readFileSync(sp, 'utf8'))
  } else {
    console.log('HumanEnv - Secure environment variable injection')
    console.log('')
    console.log('Usage:')
    console.log('  humanenv auth --project-name <name> --server-url <url> [--api-key <key>]')
    console.log('  humanenv auth --project-name <name> --server-url <url> --generate-api-key')
    console.log('  humanenv get <key>')
    console.log('  humanenv set <key> <value>')
    console.log('  humanenv server [--port 3056] [--basicAuth]')
    console.log('')
    console.log('Aliases:')
    console.log('  --pn  short for --project-name')
    console.log('  --su  short for --server-url')
    console.log('  --json  output JSON, behave like non-TTY')
    console.log('')
  }
  process.exit(0)
}

// ==========================================================
// Auth
// ==========================================================
async function runAuth(opts) {
  ensureSkillFile()
  const projectName = pName(opts)
  const serverUrl   = pUrl(opts)
  if (!projectName || !serverUrl) {
    if (isJson) console.log(JSON.stringify({ success: false, error: '--project-name and --server-url required' }))
    else console.error('Error: --project-name and --server-url required')
    process.exit(1)
  }
  writeCredentials({ projectName, serverUrl, apiKey: opts.apiKey || undefined })

  // --- generate-api-key one-shot ---
  if (opts.generateApiKey) {
    const client = new HumanEnvClient({ serverUrl, projectName, projectApiKey: opts.apiKey || '', maxRetries: 1 })
    try {
      await client.connect()
      const key = await client.generateApiKey()
      if (isJson) console.log(JSON.stringify({ success: true, apiKey: key }))
      else console.log('API key generated:', key)
    } catch (e) {
      if (isJson) console.log(JSON.stringify({ success: false, error: e.message }))
      else console.error('API key generation failed:', e.message)
      process.exit(1)
    } finally { client.disconnect() }
    return
  }

  // --- normal auth ---
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
      // TTY: poll every 1s until approved or 120 s
      console.log('Successfully authenticated.')
      console.log('Your fingerprint is not approved yet by the server.')
      console.log('Waiting for admin approval...')
      let n = 0
      while (n < 120) {
        n++
        await sleep(1000)
        try {
          if (client) client.disconnect()
          await sleep(100)
          client = new HumanEnvClient({ serverUrl, projectName, projectApiKey: opts.apiKey || '', maxRetries: 1 })
          await client.connect()
          if (client.whitelistStatus === 'approved') { console.log('Whitelisted and approved.'); break }
        } catch { /* retry */ }
      }
      if (client.whitelistStatus !== 'approved') console.log('Admin has not approved yet. The fingerprint will be pending until accepted.')
    } else {
      if (isJson) console.log(JSON.stringify({ success: true, whitelisted: false, status: client.whitelistStatus || 'pending' }))
      else { console.log('Successfully authenticated.'); console.log('Pending admin approval. (fingerprint:', generateFingerprint(), ')') }
    }
  }
  if (client) client.disconnect()
  if (!isJson) console.log('Credentials stored in', path.join(CREDENTIALS_DIR, 'credentials.json'))
}

// ==========================================================
// Resolve creds with overrides (get / set)
// ==========================================================
function resolveCreds(opts) {
  const st          = readCredentials()
  const projectName = pName(opts) || st.projectName
  const serverUrl   = pUrl(opts)  || st.serverUrl
  if (!projectName || !serverUrl) {
    if (isJson) console.log(JSON.stringify({ success: false, error: 'Not authenticated. Run: humanenv auth' }))
    else console.error('Error: Not authenticated. Run: humanenv auth')
    process.exit(1)
  }
  return { projectName, serverUrl, apiKey: opts.apiKey || st.apiKey || '' }
}

// ==========================================================
// Program
// ==========================================================
const program = new Command()

program
  .command('auth')
  .description('Authenticate with a HumanEnv server')
  .option(...nameOpt).option(...pnOpt).option(...urlOpt).option(...suOpt)
  .option('--api-key <key>', 'API key (optional)')
  .option('--generate-api-key', 'Request a new API key from the server')
  .action(async o => { await runAuth(o) })

program
  .command('get')
  .description('Retrieve an environment variable')
  .argument('<key>', 'Environment variable key')
  .option(...nameOpt).option(...pnOpt).option(...urlOpt).option(...suOpt)
  .action(async (key, opts) => {
    const c    = resolveCreds(opts)
    const cli  = new HumanEnvClient({ serverUrl: c.serverUrl, projectName: c.projectName, projectApiKey: c.apiKey || '', maxRetries: 3 })
    try {
      await cli.connect()
      const v = await cli.get(key)
      if (isJson) console.log(JSON.stringify({ value: v }))
      else if (!process.stdout.isTTY) process.stdout.write(v)
      else console.log(v)
    } catch (e) {
      if (isJson) console.log(JSON.stringify({ success: false, error: e.message }))
      else console.error('Failed to get env:', e.message)
      process.exit(1)
    } finally { cli.disconnect() }
  })

program
  .command('set')
  .description('Set an environment variable')
  .argument('<key>', 'Environment variable key')
  .argument('<value>', 'Environment variable value')
  .option(...nameOpt).option(...pnOpt).option(...urlOpt).option(...suOpt)
  .action(async (key, value, opts) => {
    const c    = resolveCreds(opts)
    const cli  = new HumanEnvClient({ serverUrl: c.serverUrl, projectName: c.projectName, projectApiKey: c.apiKey || '', maxRetries: 3 })
    try {
      await cli.connect()
      await cli.set(key, value)
      if (isJson) console.log(JSON.stringify({ success: true }))
      else console.log('Set', key)
    } catch (e) {
      if (isJson) console.log(JSON.stringify({ success: false, error: e.message }))
      else console.error('Failed to set env:', e.message)
      process.exit(1)
    } finally { cli.disconnect() }
  })

program
  .command('server')
  .description('Start the HumanEnv admin server')
  .option('--port <port>', 'Port to listen on (default: 3056)')
  .option('--basicAuth', 'Enable basic auth for admin UI')
  .action(opts => {
    const args = []
    if (opts.port)     args.push('--port', opts.port)
    if (opts.basicAuth) args.push('--basicAuth')
    // Try monorepo tsx → compiled → npm
    try  { execSync(`npx tsx ${path.join(__dirname, '..', '..', 'server', 'src', 'index.ts')} ${args.join(' ')}`, { stdio: 'inherit' }) }
    catch {
      try { execSync(`node ${path.join(__dirname, '..', '..', 'server', 'dist', 'index.js')} ${args.join(' ')}`, { stdio: 'inherit' }) }
      catch { console.error('Server not found. Install humanenv-server or run from monorepo.'); process.exit(1) }
    }
  })

program.parse(['node', 'humanenv', ...cleanArgs])
