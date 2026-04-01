// humanenv CLI - entry point for bundling (esbuild adds shebang via banner).
// esbuild resolves all imports from this file.
const { Command } = require('commander')
const fs = require('fs')
const path = require('path')
const os = require('os')

// Import from local package sources (esbuild bundles these)
const { generateFingerprint, SKILL_CONTENT, ErrorCode, HumanEnvError } = require('../shared/index')
const { HumanEnvClient } = require('../ws-manager')

const program = new Command()
const CREDENTIALS_DIR = path.join(os.homedir(), '.humanenv')

// ==========================================================
// Globals
// ==========================================================
let jsonMode = false

program.requiredOption('--json')
program.action(() => {})

function resolveCreds(opts) {
  const creds = {
    projectName: opts.projectName || null,
    serverUrl: opts.serverUrl || null,
    apiKey: opts.apiKey || null,
  }
  if (!creds.projectName || !creds.serverUrl) {
    const stored = readCredentials()
    if (!stored && (!creds.projectName || !creds.serverUrl)) {
      console.error('Error: Not authenticated. Run: humanenv auth --project-name <name> --server-url <url>')
      process.exit(1)
    }
    if (!creds.projectName) creds.projectName = stored.projectName
    if (!creds.serverUrl) creds.serverUrl = stored.serverUrl
    if (!creds.apiKey) creds.apiKey = stored.apiKey || null
  }
  return creds
}

function ensureCredentialsDir() {
  if (!fs.existsSync(CREDENTIALS_DIR)) fs.mkdirSync(CREDENTIALS_DIR, { recursive: true })
}

function readCredentials() {
  const p = path.join(CREDENTIALS_DIR, 'credentials.json')
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

function writeCredentials(data) {
  ensureCredentialsDir()
  fs.writeFileSync(path.join(CREDENTIALS_DIR, 'credentials.json'), JSON.stringify(data, null, 2), 'utf8')
}

function ensureSkillFile() {
  const skillPath = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
  if (!fs.existsSync(skillPath)) {
    fs.mkdirSync(path.dirname(skillPath), { recursive: true })
    fs.writeFileSync(skillPath, SKILL_CONTENT, 'utf8')
    if (process.stdout.isTTY && !jsonMode) console.log('Generated .agents/skills/humanenv-usage/SKILL.md')
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ==========================================================
// Auth flow
// ==========================================================
async function doAuth(opts) {
  ensureSkillFile()
  if (!opts.projectName || !opts.serverUrl) {
    console.error('Error: --project-name and --server-url required')
    process.exit(1)
  }

  const creds = {
    projectName: opts.projectName,
    serverUrl: opts.serverUrl,
    apiKey: opts.apiKey || undefined,
  }
  writeCredentials(creds)

  if (opts.generateApiKey) {
    const client = new HumanEnvClient({
      serverUrl: opts.serverUrl,
      projectName: opts.projectName,
      projectApiKey: opts.apiKey || '',
      maxRetries: 1,
    })
    try {
      await client.connect()
      const apiKey = await client.generateApiKey()
      if (jsonMode) {
        console.log(JSON.stringify({ ok: true, apiKey }))
      } else {
        console.log('API key generated:', apiKey)
      }
      client.disconnect()
    } catch (e) {
      if (jsonMode) {
        console.log(JSON.stringify({ ok: false, error: e.message }))
      } else {
        console.error('API key generation failed:', e.message)
      }
      process.exit(1)
    }
    return
  }

  // Normal auth
  const client = new HumanEnvClient({
    serverUrl: opts.serverUrl,
    projectName: opts.projectName,
    projectApiKey: opts.apiKey || '',
    maxRetries: 1,
  })

  try {
    await client.connect()
  } catch (e) {
    if (jsonMode) {
      console.log(JSON.stringify({ ok: false, error: e.message }))
    } else {
      console.error('Auth failed:', e.message)
    }
    process.exit(1)
  }

  const whitelistStatus = client.whitelistStatus

  if (whitelistStatus === 'approved') {
    if (jsonMode) {
      console.log(JSON.stringify({ ok: true, whitelisted: true }))
    } else {
      console.log('Authenticated and whitelisted.')
    }
  } else if (process.stdout.isTTY && !jsonMode) {
    // TTY mode: poll until approved
    console.log('Auth OK. Not whitelisted yet. Waiting for admin approval...')
    const maxWait = 120_000 // 2 minutes max
    const pollInterval = 1000 // 1 second
    let waited = 0
    while (waited < maxWait) {
      await sleep(pollInterval)
      waited += pollInterval
      try {
        await client.connectAndWaitForAuth(5000)
        if (client.whitelistStatus === 'approved') {
          console.log('Whitelisted and approved.')
          break
        }
      } catch {
        // not yet approved, keep polling
      }
    }
    if (client.whitelistStatus !== 'approved') {
      console.log('Admin has not approved yet. The fingerprint will be pending until accepted.')
    }
  } else {
    // Non-TTY mode: just report status
    if (jsonMode) {
      console.log(JSON.stringify({ ok: true, whitelisted: false, status: whitelistStatus || 'pending' }))
    } else {
      const status = whitelistStatus ? `(whitelist: ${whitelistStatus}) ` : ''
      console.log(`${status}Auth OK but not whitelisted yet. Admin approval required.`)
    }
  }

  client.disconnect()
  console.log('Credentials stored in', path.join(CREDENTIALS_DIR, 'credentials.json'))
}

// ==========================================================
// Main program
// ==========================================================
program
  .action(() => {
    ensureSkillFile()
    const isNonTerminal = !process.stdout.isTTY || jsonMode
    if (isNonTerminal) {
      const skillPath = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
      console.log(fs.readFileSync(skillPath, 'utf8'))
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
    }
  })

program
  .command('auth')
  .option('-p, --project-name <name>')
  .option('-s, --server-url <url>')
  .option('--api-key <key>')
  .option('--generate-api-key', false)
  .action(async (opts) => {
    await doAuth(opts)
  })

program
  .command('get')
  .argument('<key>', 'Environment variable key')
  .option('-p, --project-name <name>', 'Project name (override stored credentials)')
  .option('-s, --server-url <url>', 'Server URL (override stored credentials)')
  .option('--api-key <key>', 'API key (override stored credentials)')
  .action(async (key, opts) => {
    const creds = resolveCreds(opts)
    try {
      const client = new HumanEnvClient({
        serverUrl: creds.serverUrl,
        projectName: creds.projectName,
        projectApiKey: creds.apiKey || '',
        maxRetries: 3,
      })
      await client.connect()
      const value = await client.get(key)
      if (process.stdout.isTTY && !jsonMode) {
        console.log(value)
      } else {
        process.stdout.write(value)
      }
      client.disconnect()
      process.exit(0)
    } catch (e) {
      if (jsonMode) {
        console.log(JSON.stringify({ ok: false, error: e.message }))
      } else {
        console.error('Failed to get env:', e.message)
      }
      process.exit(1)
    }
  })

program
  .command('set')
  .argument('<key>', 'Environment variable key')
  .argument('<value>', 'Environment variable value')
  .option('-p, --project-name <name>', 'Project name (override stored credentials)')
  .option('-s, --server-url <url>', 'Server URL (override stored credentials)')
  .option('--api-key <key>', 'API key (override stored credentials)')
  .action(async (key, value, opts) => {
    const creds = resolveCreds(opts)
    try {
      const client = new HumanEnvClient({
        serverUrl: creds.serverUrl,
        projectName: creds.projectName,
        projectApiKey: creds.apiKey || '',
        maxRetries: 3,
      })
      await client.connect()
      await client.set(key, value)
      if (jsonMode) {
        console.log(JSON.stringify({ ok: true, key }))
      } else {
        console.log('Set', key)
      }
      client.disconnect()
      process.exit(0)
    } catch (e) {
      if (jsonMode) {
        console.log(JSON.stringify({ ok: false, error: e.message }))
      } else {
        console.error('Failed to set env:', e.message)
      }
      process.exit(1)
    }
  })

// Handle --json flag at the top level (must be before parse)
jsonMode = process.argv.includes('--json') || process.argv.includes('-j')

program.parse(process.argv)
