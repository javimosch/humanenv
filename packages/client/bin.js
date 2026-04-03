#!/usr/bin/env node
"use strict";
// humanenv CLI - single entry point, works after both npm link and npm publish.
// Dependencies are bundled via dist/* or resolved from local src/ during development.

const path = require('path')
const fs = require('fs')
const os = require('os')

// ============================================================
// Resolve module loading strategy
// ============================================================

function loadModule(name) {
  // Try direct require (compiled / node_modules)
  try { return require(name) } catch {}
  // Try relative (workspace source)
  try { return require('./' + name) } catch {}
  // Try local dist
  try { return require('./dist/' + name) } catch {}
  throw new Error(`Cannot find module: ${name}`)
}

const { HumanEnvClient } = loadModule('ws-manager.js') || loadModule('client/ws-manager.js') || loadModule('./client/ws-manager.js')
const { Command } = loadModule('commander')
const { SKILL_CONTENT } = loadModule('shared/index.js') || loadModule('shared/index.ts') || {}

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
    fs.writeFileSync(skillPath, SKILL_CONTENT || 'HumanEnv skill placeholder', 'utf8')
    if (process.stdout.isTTY) console.log('Generated .agents/skills/humanenv-usage/SKILL.md')
  }
}

// ============================================================
// CLI
// ============================================================

const { createCommand } = require('commander')
const program = createCommand()

program
  .action(() => {
    ensureSkillFile()
    if (!process.stdout.isTTY) {
      const skillPath = path.join(process.cwd(), '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
      console.log(fs.readFileSync(skillPath, 'utf8'))
    } else {
      console.log('HumanEnv - Secure environment variable injection')
      console.log('')
      console.log('Usage:')
      console.log('  humanenv auth --project-name <name> --server-url <url> [--api-key <key>]')
      console.log('  humanenv get <key>')
      console.log('  humanenv set <key> <value>')
      console.log('  humanenv server [--port 3056] [--basicAuth]')
      console.log('')
    }
  })

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
    const creds = { projectName: opts.projectName, serverUrl: opts.serverUrl, apiKey: opts.apiKey || undefined }
    writeCredentials(creds)
    try {
      const client = new HumanEnvClient({ serverUrl: opts.serverUrl, projectName: opts.projectName, projectApiKey: opts.apiKey || '', maxRetries: 3 })
      await client.connect()
      console.log('Authenticated successfully.')
      client.disconnect()
    } catch (e) {
      console.error('Auth failed:', e.message)
      process.exit(1)
    }
    console.log('Credentials stored in', path.join(CREDENTIALS_DIR, 'credentials.json'))
  })

program
  .command('get')
  .argument('<key>', 'Environment variable key')
  .action(async (key) => {
    const creds = readCredentials()
    if (!creds) {
      console.error('Error: Not authenticated. Run: humanenv auth --project-name <name> --server-url <url>')
      process.exit(1)
    }
    try {
      const client = new HumanEnvClient({ serverUrl: creds.serverUrl, projectName: creds.projectName, projectApiKey: creds.apiKey || '', maxRetries: 3 })
      await client.connect()
      const value = await client.get(key)
      if (!process.stdout.isTTY) process.stdout.write(value)
      else console.log(value)
      client.disconnect()
    } catch (e) {
      console.error('Failed to get env:', e.message)
      process.exit(1)
    }
  })

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
    try {
      const client = new HumanEnvClient({ serverUrl: creds.serverUrl, projectName: creds.projectName, projectApiKey: creds.apiKey || '', maxRetries: 3 })
      await client.connect()
      await client.set(key, value)
      console.log('Set', key)
      client.disconnect()
    } catch (e) {
      console.error('Failed to set env:', e.message)
      process.exit(1)
    }
  })

program
  .command('server')
  .option('--port <number>')
  .option('--basicAuth', false)
  .action((opts) => {
    const portArg = opts.port ? `--port=${opts.port}` : ''
    const basicAuthArg = opts.basicAuth ? '--basicAuth' : ''
    const serverPath = path.join(__dirname, '..', 'server', 'src', 'index.ts')
    const distPath = path.join(__dirname, '..', 'server', 'dist', 'index.js')
    const finalPath = fs.existsSync(distPath) ? distPath : serverPath
    if (finalPath.endsWith('.js')) {
      require('child_process').fork(finalPath, [portArg, basicAuthArg].filter(Boolean), { stdio: 'inherit' })
    } else {
      const { spawn } = require('child_process')
      const args = ['tsx', serverPath, portArg, basicAuthArg].filter(Boolean)
      const child = spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })
      child.on('close', (code) => process.exit(code))
    }
  })

program.parse(process.argv)
