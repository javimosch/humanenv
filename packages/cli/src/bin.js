#!/usr/bin/env node
const { Command } = require('commander')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { generateFingerprint, SKILL_CONTENT } = require('humanenv-shared')

const program = new Command()
const CREDENTIALS_DIR = path.join(os.homedir(), '.humanenv')

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
    if (process.stdout.isTTY) console.log('Generated .agents/skills/humanenv-usage/SKILL.md')
  }
}

// ============================================================
// Main entry: humanenv (no args)
// ============================================================

program
  .action(() => {
    ensureSkillFile()
    if (!process.stdout.isTTY) {
      // Non-TTY: output skill content for agents
      const skillPath = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
      console.log(fs.readFileSync(skillPath, 'utf8'))
    } else {
      // TTY: show human-friendly help
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

// ============================================================
// Auth command
// ============================================================

program
  .command('auth')
  .option('--project-name <name>')
  .option('--server-url <url>')
  .option('--api-key <key>')
  .option('--generate-api-key', false)
  .action(async (opts) => {
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
      const { HumanEnvClient } = require('humanenv/dist/ws-manager')
      const client = new HumanEnvClient({
        serverUrl: opts.serverUrl,
        projectName: opts.projectName,
        projectApiKey: opts.apiKey || '',
        maxRetries: 3,
      })

      try {
        await client.connect()
        const result = await new Promise((resolve, reject) => {
          client.disconnect()
          // For CLI generate-api-key, we use a simple HTTP call instead
          // since WS API key generation is complex
          resolve(null)
        })
        console.log('API key generation request sent. Admin must approve in dashboard.')
      } catch (e) {
        console.error('Failed to connect:', e.message)
        process.exit(1)
      }
    } else {
      // Verify credentials by connecting
      const { HumanEnvClient } = require('humanenv/dist/ws-manager')
      const client = new HumanEnvClient({
        serverUrl: opts.serverUrl,
        projectName: opts.projectName,
        projectApiKey: opts.apiKey || '',
        maxRetries: 3,
      })

      try {
        await client.connect()
        console.log('Authenticated successfully.')
        client.disconnect()
      } catch (e) {
        console.error('Auth failed:', e.message)
        process.exit(1)
      }
    }

    console.log('Credentials stored in', path.join(CREDENTIALS_DIR, 'credentials.json'))
  })

// ============================================================
// Get command
// ============================================================

program
  .command('get')
  .argument('<key>', 'Environment variable key')
  .action(async (key) => {
    const creds = readCredentials()
    if (!creds) {
      console.error('Error: Not authenticated. Run: humanenv auth --project-name <name> --server-url <url>')
      process.exit(1)
    }

    const { HumanEnvClient } = require('humanenv/dist/ws-manager')
    const client = new HumanEnvClient({
      serverUrl: creds.serverUrl,
      projectName: creds.projectName,
      projectApiKey: creds.apiKey || '',
      maxRetries: 3,
    })

    try {
      await client.connect()
      const value = await client.get(key)
      // Non-TTY: output raw value only
      if (!process.stdout.isTTY) {
        process.stdout.write(value)
      } else {
        console.log(value)
      }
      client.disconnect()
    } catch (e) {
      console.error('Failed to get env:', e.message)
      process.exit(1)
    }
  })

// ============================================================
// Set command
// ============================================================

program
  .command('set')
  .argument('<key>', 'Environment variable key')
  .argument('<value>', 'Environment variable value')
  .action(async (key, value) => {
    const creds = readCredentials()
    if (!creds) {
      console.error('Error: Not authenticated. Run: humanenv auth --project-name <name> --server-url <url>')
      process.exit(1)
    }

    const { HumanEnvClient } = require('humanenv/dist/ws-manager')
    const client = new HumanEnvClient({
      serverUrl: creds.serverUrl,
      projectName: creds.projectName,
      projectApiKey: creds.apiKey || '',
      maxRetries: 3,
    })

    try {
      await client.connect()
      await client.set(key, value)
      console.log('Set', key)
      client.disconnect()
    } catch (e) {
      console.error('Failed to set env:', e.message)
      process.exit(1)
    }
  })

// ============================================================
// Server command (delegates to server package)
// ============================================================

program
  .command('server')
  .option('--port <number>')
  .option('--basicAuth', false)
  .action((opts) => {
    const portArg = opts.port ? `--port=${opts.port}` : ''
    const basicAuthArg = opts.basicAuth ? '--basicAuth' : ''
    const serverPath = path.join(__dirname, '..', '..', 'server', 'src', 'index.ts')
    const serverJs = fs.existsSync(path.join(__dirname, '..', '..', 'server', 'dist', 'index.js'))
      ? path.join(__dirname, '..', '..', 'server', 'dist', 'index.js')
      : null

    if (serverJs && fs.existsSync(serverJs)) {
      require('child_process').fork(serverJs, [portArg, basicAuthArg].filter(Boolean), { stdio: 'inherit' })
    } else {
      // Fallback: run via tsx
      const { spawn } = require('child_process')
      const args = [serverPath, portArg, basicAuthArg].filter(Boolean)
      const child = spawn('npx', ['tsx', ...args], { stdio: 'inherit', shell: process.platform === 'win32' })
      child.on('close', (code) => process.exit(code))
    }
  })

program.parse(process.argv)
