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
const isJson   = process.argv.includes('--json') || process.argv.includes('-j')
const cleanArgs = process.argv.slice(2).filter(a => a !== '--json' && a !== '-j')
const hasCmd   = ['auth', 'get', 'set', 'server'].some(c => cleanArgs.includes(c))
const wantsHelp = cleanArgs.includes('--help') || cleanArgs.includes('-h')

// Handle --help --json before anything else
if (wantsHelp && isJson) {
  const commandName = cleanArgs.find(a => ['auth', 'get', 'set', 'server'].includes(a))
  const commandsConfig = {
    'auth': {
      command: 'auth',
      description: 'Authenticate with a HumanEnv server',
      usage: 'humanenv auth [options]',
      options: [
        { flags: '--project-name <name>', description: 'Project name', required: false, optional: true, shorthand: 'pn' },
        { flags: '--pn <name>', description: 'Project name (shorthand)', required: false, optional: true, shorthand: null },
        { flags: '--server-url <url>', description: 'Server URL', required: false, optional: true, shorthand: 'su' },
        { flags: '--su <url>', description: 'Server URL (shorthand)', required: false, optional: true, shorthand: null },
        { flags: '--api-key <key>', description: 'API key (optional)', required: false, optional: true, shorthand: null },
        { flags: '-h, --help', description: 'Display help', required: false, optional: false, shorthand: 'h' }
      ],
      arguments: []
    },
    'get': {
      command: 'get',
      description: 'Retrieve an environment variable',
      usage: 'humanenv get <key>',
      options: [
        { flags: '-h, --help', description: 'Display help', required: false, optional: false, shorthand: 'h' }
      ],
      arguments: [{ name: 'key', required: true, description: 'Environment variable key' }]
    },
    'set': {
      command: 'set',
      description: 'Set an environment variable',
      usage: 'humanenv set <key> <value>',
      options: [
        { flags: '-h, --help', description: 'Display help', required: false, optional: false, shorthand: 'h' }
      ],
      arguments: [
        { name: 'key', required: true, description: 'Environment variable key' },
        { name: 'value', required: true, description: 'Environment variable value' }
      ]
    },
    'server': {
      command: 'server',
      description: 'Start the HumanEnv admin server',
      usage: 'humanenv server [options]',
      options: [
        { flags: '--port <port>', description: 'Port to listen on (default: 3056)', required: false, optional: true, shorthand: null },
        { flags: '--basicAuth', description: 'Enable basic auth for admin UI', required: false, optional: false, shorthand: null },
        { flags: '-h, --help', description: 'Display help', required: false, optional: false, shorthand: 'h' }
      ],
      arguments: []
    }
  }
  
  if (commandName && commandsConfig[commandName]) {
    console.log(JSON.stringify(commandsConfig[commandName], null, 2))
  } else {
    console.log(JSON.stringify({
      command: 'humanenv',
      description: 'Secure environment variable injection',
      usage: 'humanenv [command] [options]',
      commands: ['auth', 'get', 'set', 'server'],
      options: [
        { flags: '--json', description: 'Output in JSON format' },
        { flags: '-j', description: 'Shorthand for --json' },
        { flags: '-h, --help', description: 'Display help' }
      ]
    }, null, 2))
  }
  process.exit(0)
}

// ==========================================================
// AGENTS_FRIENDLY error helper
// ==========================================================
function errJson(code, msg, hint, extras) {
  return JSON.stringify(Object.assign(
    { success: false, code, error: msg },
    hint ? { hint } : {},
    extras || {}
  ), null, 2)
}

function failJson(code, msg, hint, extras) {
  if (isJson) {
    console.error(errJson(code, msg, hint, extras))
  } else {
    console.error('Error:', msg)
    if (hint) console.error('Hint:', hint)
  }
  process.exit(1)
}

// ==========================================================
// No sub-command → show fingerprint + usage (before Commander runs)
// ==========================================================
if (!hasCmd && !wantsHelp) {
  ensureSkillFile()
  const sp = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
  const creds = readCredentials()

  if (!process.stdout.isTTY || isJson) {
    if (fs.existsSync(sp)) console.log(fs.readFileSync(sp, 'utf8'))
    console.log('')
    printCredentials(creds, true)
  } else {
    console.log('HumanEnv - Secure environment variable injection')
    console.log('')
    printCredentials(creds, false)
    console.log('')
    console.log('Aliases:')
    console.log('  --pn  short for --project-name')
    console.log('  --su  short for --server-url')
    console.log('  --json  structured JSON output (agent-friendly)')
    console.log('')
  }
  process.exit(0)
}

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

function obfuscateKey(key) {
  if (!key) return null
  if (key.length <= 4) return '****'
  return '****-' + key.slice(-4)
}

function printCredentials(creds, jsonMode) {
  const obApiKey = obfuscateKey(creds?.apiKey)
  const data = {
    projectName: creds?.projectName || null,
    serverUrl: creds?.serverUrl || 'http://localhost:3056',
    apiKey: obApiKey,
  }
  if (jsonMode) {
    console.log(JSON.stringify({
      code: 'CREDENTIALS_STATUS',
      configured: !!creds?.projectName,
      ...data,
      updateCommands: [
        'humanenv auth --project-name <name>',
        'humanenv auth --server-url <url>',
        'humanenv auth --api-key <key>',
      ]
    }))
  } else {
    console.log('Current credentials:')
    console.log('  projectName:', data.projectName || '(not set)')
    console.log('  serverUrl:', data.serverUrl)
    console.log('  api-key:', data.apiKey || '(none)')
    console.log('')
    console.log('To update:')
    console.log('  humanenv auth --project-name <name>')
    console.log('  humanenv auth --server-url <url>')
    console.log('  humanenv auth --api-key <key>')
  }
}

const pName   = o => o.projectName || o.pn
const pUrl    = o => o.serverUrl   || o.su
const nameOpt = ['--project-name <name>', 'Project name']
const urlOpt  = ['--server-url <url>',    'Server URL']
const pnOpt   = ['--pn <name>',           'Project name (shorthand)']
const suOpt   = ['--su <url>',            'Server URL (shorthand)']

// ==========================================================
// Auth
// ==========================================================
async function runAuth(opts) {
  ensureSkillFile()
  const existing = readCredentials() || {}
  const serverUrl = pUrl(opts) || existing.serverUrl || 'http://localhost:3056'
  const creds = {
    projectName: pName(opts) || existing.projectName,
    serverUrl,
    apiKey: opts.apiKey || existing.apiKey || undefined,
  }

  if (!creds.projectName && !opts.projectName && !opts.serverUrl && !opts.apiKey) {
    printCredentials(creds, isJson)
    return
  }

  writeCredentials(creds)

  if (!creds.projectName || !creds.serverUrl) {
    if (isJson) {
      console.log(JSON.stringify({ code: 'CREDENTIALS_UPDATED', ...creds }))
    } else {
      console.log('Credentials updated.')
    }
    printCredentials(creds, isJson)
    return
  }

  let client = new HumanEnvClient({ serverUrl: creds.serverUrl, projectName: creds.projectName, projectApiKey: creds.apiKey || '', maxRetries: 1 })
  try {
    await client.connect()
  } catch (e) {
    const fingerprint = generateFingerprint()
    const adminUiWhitelistUrl = `${serverUrl.replace(/\/$/, '')}/#/whitelist`
    let hint = 'Re-run auth to retry.'
    if (/ECONNREFUSED|ENOTFOUND/i.test(e.message)) {
      hint = `Start the server first:  humanenv server   (or check --server-url)`
    } else if (/project.*not.*found/i.test(e.message)) {
      hint = `Create the project first via the admin UI at ${serverUrl}`
    } else if (/api.*key.*invalid/i.test(e.message)) {
      hint = 'Verify your API key is correct or request a new one from the admin.'
    }
    if (isJson) {
      console.log(JSON.stringify({ code: 'AUTH_FAILED', error: e.message, hint }))
    } else {
      console.log('Auth warning:', e.message)
    }
    printCredentials(creds, isJson)
    if (client) client.disconnect()
    return
  }

  if (client.whitelistStatus === 'approved') {
    if (isJson) {
      console.log(JSON.stringify({ code: 'AUTH_OK', success: true, whitelisted: true }))
    } else {
      console.log('Authenticated successfully.')
    }
    if (client) client.disconnect()
  } else {
    if (isJson) {
      console.log(JSON.stringify({ code: 'AUTH_PENDING', success: true, whitelisted: false }))
    } else {
      console.log('Authenticated, not whitelisted yet.')
    }
  }

  printCredentials(creds, isJson)
  if (client) client.disconnect()
}

// ==========================================================
// Resolve creds with overrides (get / set)
// ==========================================================
function resolveCreds(opts) {
  const st          = readCredentials()
  const serverUrl   = pUrl(opts) || st.serverUrl || 'http://localhost:3056'
  const projectName = pName(opts) || st.projectName

  if (!projectName || !serverUrl) {
    failJson('NOT_AUTHENTICATED',
      'No credentials found.',
      'Run: humanenv auth --project-name <name> --server-url <url>  (or pass --pn / --su per-command)',
      { tip: 'You can also set HUMANENV_PROJECT_NAME and HUMANENV_SERVER_URL env vars.' })
  }

  return {
    projectName,
    serverUrl,
    apiKey: opts.apiKey || st.apiKey || '',
    fingerprint: generateFingerprint(),
    adminUiWhitelistUrl: `${serverUrl.replace(/\/$/, '')}/#/whitelist`
  }
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
  .action(async o => { await runAuth(o) })

program
  .command('get')
  .description('Retrieve an environment variable')
  .argument('<key>', 'Environment variable key')
  .option(...nameOpt).option(...pnOpt).option(...urlOpt).option(...suOpt)
  .action(async (key, opts) => {
    const c = resolveCreds(opts)
    const cli = new HumanEnvClient({ 
      serverUrl: c.serverUrl, 
      projectName: c.projectName, 
      projectApiKey: c.apiKey || '', 
      maxRetries: 3 
    })
    try {
      await cli.connect()
      const value = await cli.get(key)
      if (isJson) {
        console.log(JSON.stringify({ success: true, code: 'ENV_RETRIEVED', key, hasValue: !!value, value }, null, 2))
      } else if (!process.stdout.isTTY) {
        process.stdout.write(value)
      } else {
        console.log(value)
      }
    } catch (e) {
      const fingerprint = c.fingerprint
      const adminUiWhitelistUrl = c.adminUiWhitelistUrl
      let hint = null
      let code = 'GET_FAILED'

      if (/whitelist/i.test(e.message) || /not.*approved/i.test(e.message)) {
        code = 'CLIENT_NOT_WHITELISTED'
        hint = `Run humanenv auth to submit your fingerprint. Then ask the admin to approve it at ${adminUiWhitelistUrl}`
      } else if (/not.*found|key.*not.*exist/i.test(e.message)) {
        code = 'ENV_KEY_NOT_FOUND'
        hint = `Key "${key}" does not exist. Create it via humanenv set or the admin UI.`
      } else if (/ECONNREFUSED|ENOTFOUND/i.test(e.message)) {
        hint = `Start the server first: humanenv server  (or verify ${c.serverUrl})`
      } else if (/timeout/i.test(e.message)) {
        hint = 'Server took too long to respond. Check network connectivity.'
      } else if (/invalid.*api.*key/i.test(e.message)) {
        hint = 'Your API key may have expired. Contact the admin for a new one.'
      }

      failJson(code, `Failed to get env: ${e.message}`, hint,
        { key, fingerprint, projectName: c.projectName, serverUrl: c.serverUrl, adminUiWhitelistUrl })
    } finally { cli.disconnect() }
  })

program
  .command('set')
  .description('Set an environment variable')
  .argument('<key>', 'Environment variable key')
  .argument('<value>', 'Environment variable value')
  .option(...nameOpt).option(...pnOpt).option(...urlOpt).option(...suOpt)
  .action(async (key, value, opts) => {
    const c = resolveCreds(opts)
    const cli = new HumanEnvClient({ 
      serverUrl: c.serverUrl, 
      projectName: c.projectName, 
      projectApiKey: c.apiKey || '', 
      maxRetries: 3 
    })
    try {
      await cli.connect()
      await cli.set(key, value)
      if (isJson) {
        console.log(JSON.stringify({ success: true, code: 'ENV_SET', key }, null, 2))
      } else {
        console.log('Set', key)
      }
    } catch (e) {
      const fingerprint = c.fingerprint
      const adminUiWhitelistUrl = c.adminUiWhitelistUrl
      let hint = null
      let code = 'SET_FAILED'

      if (/whitelist/i.test(e.message) || /not.*approved/i.test(e.message)) {
        code = 'CLIENT_NOT_WHITELISTED'
        hint = `Run humanenv auth to submit your fingerprint. Then ask the admin to approve it at ${adminUiWhitelistUrl}`
      } else if (/ECONNREFUSED|ENOTFOUND/i.test(e.message)) {
        hint = `Start the server first: humanenv server  (or verify ${c.serverUrl})`
      } else if (/timeout/i.test(e.message)) {
        hint = 'Server took too long to respond. Check network connectivity.'
      }

      failJson(code, `Failed to set env: ${e.message}`, hint,
        { key, fingerprint, projectName: c.projectName, serverUrl: c.serverUrl, adminUiWhitelistUrl })
    } finally { cli.disconnect() }
  })

program
  .command('server')
  .description('Start the HumanEnv admin server')
  .option('--port <port>', 'Port to listen on (default: 3056)')
  .option('--basicAuth', 'Enable basic auth for admin UI')
  .action(opts => {
    const args = []
    if (opts.port)      args.push('--port', opts.port)
    if (opts.basicAuth) args.push('--basicAuth')
    try {
      execSync(`npx tsx ${path.join(__dirname, '..', '..', 'server', 'src', 'index.ts')} ${args.join(' ')}`, 
        { stdio: 'inherit' })
    } catch {
      try {
        execSync(`node ${path.join(__dirname, '..', '..', 'server', 'dist', 'index.js')} ${args.join(' ')}`, 
          { stdio: 'inherit' })
      } catch {
        failJson('SERVER_NOT_FOUND', 
          'Server binary not found.',
          'Install humanenv-server or run from the monorepo.')
      }
    }
  })

program.parse(['node', 'humanenv', ...cleanArgs])
