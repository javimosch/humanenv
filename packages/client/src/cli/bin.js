#!/usr/bin/env node
const { Command } = require('commander')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { generateFingerprint, SKILL_CONTENT } = require('../shared/index')

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

function obfuscateKey(key) {
  if (!key) return null
  if (key.length <= 4) return '****'
  return '****-' + key.slice(-4)
}

function printCredentials(creds, isJson) {
  const obApiKey = obfuscateKey(creds?.apiKey)
  const data = {
    projectName: creds?.projectName || null,
    serverUrl: creds?.serverUrl || 'http://localhost:3056',
    apiKey: obApiKey,
  }
  if (isJson) {
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

// ============================================================
// Main entry: humanenv (no args)
// ============================================================

program
  .action(() => {
    ensureSkillFile()
    const creds = readCredentials()
    if (!process.stdout.isTTY) {
      const skillPath = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
      console.log(fs.readFileSync(skillPath, 'utf8'))
      console.log('')
    }
    printCredentials(creds, !process.stdout.isTTY)
  })

// ============================================================
// Auth command
// ============================================================

program
  .command('auth')
  .option('--project-name <name>')
  .option('--server-url <url>')
  .option('--api-key <key>')
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

    // Verify credentials by connecting
    const { HumanEnvClient } = require('../ws-manager')

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

    const { HumanEnvClient } = require('../ws-manager')
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

    const { HumanEnvClient } = require('../ws-manager')
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
