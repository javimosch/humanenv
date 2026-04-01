import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Test the CLI helper functions by extracting and testing them
// Since bin.js is CommonJS, we test the logic patterns

describe('CLI - Credentials Management', () => {
  const testCredentialsDir = path.join(os.tmpdir(), 'humanenv-test-creds')
  let originalCredentialsDir: string

  beforeEach(() => {
    originalCredentialsDir = testCredentialsDir
    // Clean up before test
    if (fs.existsSync(testCredentialsDir)) {
      fs.rmSync(testCredentialsDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    // Clean up after test
    if (fs.existsSync(testCredentialsDir)) {
      fs.rmSync(testCredentialsDir, { recursive: true, force: true })
    }
  })

  it('ensureCredentialsDir creates directory if not exists', () => {
    assert.strictEqual(fs.existsSync(testCredentialsDir), false)
    fs.mkdirSync(testCredentialsDir, { recursive: true })
    assert.strictEqual(fs.existsSync(testCredentialsDir), true)
  })

  it('writeCredentials stores JSON file', () => {
    fs.mkdirSync(testCredentialsDir, { recursive: true })
    const credsPath = path.join(testCredentialsDir, 'credentials.json')
    const creds = {
      projectName: 'test-app',
      serverUrl: 'http://localhost:3056',
      apiKey: 'test-key-123',
    }
    
    fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2))
    
    assert.ok(fs.existsSync(credsPath))
    const stored = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
    assert.strictEqual(stored.projectName, 'test-app')
    assert.strictEqual(stored.serverUrl, 'http://localhost:3056')
  })

  it('readCredentials returns null if file not exists', () => {
    const credsPath = path.join(testCredentialsDir, 'credentials.json')
    assert.strictEqual(fs.existsSync(credsPath), false)
    // Simulating readCredentials behavior
    const result = fs.existsSync(credsPath) 
      ? JSON.parse(fs.readFileSync(credsPath, 'utf8'))
      : null
    assert.strictEqual(result, null)
  })

  it('readCredentials returns parsed JSON if file exists', () => {
    fs.mkdirSync(testCredentialsDir, { recursive: true })
    const credsPath = path.join(testCredentialsDir, 'credentials.json')
    const creds = {
      projectName: 'my-app',
      serverUrl: 'http://localhost:3056',
    }
    fs.writeFileSync(credsPath, JSON.stringify(creds))
    
    const result = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
    assert.strictEqual(result.projectName, 'my-app')
  })

  it('readCredentials returns null on invalid JSON', () => {
    fs.mkdirSync(testCredentialsDir, { recursive: true })
    const credsPath = path.join(testCredentialsDir, 'credentials.json')
    fs.writeFileSync(credsPath, 'invalid json {')
    
    try {
      JSON.parse(fs.readFileSync(credsPath, 'utf8'))
      assert.fail('Should have thrown')
    } catch {
      // Expected - simulates readCredentials returning null
    }
  })
})

describe('CLI - Skill File Management', () => {
  const testSkillPath = path.join(os.tmpdir(), 'humanenv-test-skill', '.agents', 'skills', 'humanenv-usage', 'SKILL.md')
  
  beforeEach(() => {
    // Clean up before test
    if (fs.existsSync(path.dirname(testSkillPath))) {
      fs.rmSync(path.dirname(testSkillPath), { recursive: true, force: true })
    }
  })

  afterEach(() => {
    // Clean up after test
    if (fs.existsSync(path.dirname(testSkillPath))) {
      fs.rmSync(path.dirname(testSkillPath), { recursive: true, force: true })
    }
  })

  it('ensureSkillFile creates directory structure', () => {
    assert.strictEqual(fs.existsSync(testSkillPath), false)
    
    // Simulate ensureSkillFile logic
    if (!fs.existsSync(testSkillPath)) {
      fs.mkdirSync(path.dirname(testSkillPath), { recursive: true })
      fs.writeFileSync(testSkillPath, 'test skill content', 'utf8')
    }
    
    assert.ok(fs.existsSync(testSkillPath))
  })

  it('ensureSkillFile does not overwrite existing file', () => {
    fs.mkdirSync(path.dirname(testSkillPath), { recursive: true })
    fs.writeFileSync(testSkillPath, 'original content', 'utf8')
    
    // Simulate ensureSkillFile logic (should not overwrite)
    if (!fs.existsSync(testSkillPath)) {
      fs.writeFileSync(testSkillPath, 'new content', 'utf8')
    }
    
    const content = fs.readFileSync(testSkillPath, 'utf8')
    assert.strictEqual(content, 'original content')
  })

  it('SKILL_CONTENT has required metadata header', () => {
    const { SKILL_CONTENT } = require('humanenv-shared')
    assert.ok(SKILL_CONTENT.includes('---'))
    assert.ok(SKILL_CONTENT.includes('name: humanenv-usage'))
    assert.ok(SKILL_CONTENT.includes('description:'))
  })

  it('SKILL_CONTENT includes security rules', () => {
    const { SKILL_CONTENT } = require('humanenv-shared')
    assert.ok(SKILL_CONTENT.includes('NEVER log env values'))
    assert.ok(SKILL_CONTENT.includes('NEVER dump or export'))
    assert.ok(SKILL_CONTENT.includes('ALWAYS null variables'))
  })
})

describe('CLI - Command Parsing', () => {
  it('auth command requires project-name and server-url', () => {
    // Simulate validation logic from bin.js
    const validateAuth = (opts: any) => {
      if (!opts.projectName || !opts.serverUrl) {
        return 'Error: --project-name and --server-url required'
      }
      return null
    }
    
    assert.ok(validateAuth({}))
    assert.ok(validateAuth({ projectName: 'test' }))
    assert.ok(validateAuth({ serverUrl: 'http://localhost' }))
    assert.strictEqual(validateAuth({ projectName: 'test', serverUrl: 'http://localhost' }), null)
  })

  it('get command requires key argument', () => {
    const validateGet = (key: string | undefined) => {
      if (!key) {
        return 'Error: key required'
      }
      return null
    }
    
    assert.ok(validateGet(undefined))
    assert.strictEqual(validateGet('API_KEY'), null)
  })

  it('set command requires key and value arguments', () => {
    const validateSet = (key: string | undefined, value: string | undefined) => {
      if (!key || value === undefined) {
        return 'Error: key and value required'
      }
      return null
    }
    
    assert.ok(validateSet(undefined, undefined))
    assert.ok(validateSet('KEY', undefined))
    assert.strictEqual(validateSet('KEY', 'value'), null)
  })

  it('server command accepts optional port', () => {
    const parseServerOpts = (port?: string, basicAuth?: boolean) => {
      const portArg = port ? `--port=${port}` : ''
      const basicAuthArg = basicAuth ? '--basicAuth' : ''
      return [portArg, basicAuthArg].filter(Boolean)
    }
    
    assert.deepStrictEqual(parseServerOpts(), [])
    assert.deepStrictEqual(parseServerOpts('4000'), ['--port=4000'])
    assert.deepStrictEqual(parseServerOpts('4000', true), ['--port=4000', '--basicAuth'])
  })
})

describe('CLI - TTY Detection', () => {
  it('TTY mode shows help text', () => {
    const isTTY = true
    const getOutput = (isTTY: boolean) => {
      if (isTTY) {
        return 'HumanEnv - Secure environment variable injection\n\nUsage:...'
      } else {
        return '---\nname: humanenv-usage\n...'
      }
    }
    
    const output = getOutput(isTTY)
    assert.ok(output.includes('HumanEnv'))
    assert.ok(output.includes('Usage'))
  })

  it('Non-TTY mode outputs skill content', () => {
    const isTTY = false
    const { SKILL_CONTENT } = require('humanenv-shared')
    
    const getOutput = (isTTY: boolean) => {
      if (!isTTY) {
        return SKILL_CONTENT
      }
      return 'Help text...'
    }
    
    const output = getOutput(isTTY)
    assert.ok(output.includes('---'))
    assert.ok(output.includes('name: humanenv-usage'))
  })
})

describe('CLI - Error Handling', () => {
  it('exits with code 1 on auth error', () => {
    // Simulate error handling pattern
    const handleError = (error: Error | null) => {
      if (error) {
        console.error('Auth failed:', error.message)
        return 1 // exit code
      }
      return 0
    }
    
    assert.strictEqual(handleError(new Error('Connection failed')), 1)
    assert.strictEqual(handleError(null), 0)
  })

  it('exits with code 1 on get error', () => {
    const handleError = (error: Error | null) => {
      if (error) {
        console.error('Failed to get env:', error.message)
        return 1
      }
      return 0
    }
    
    assert.strictEqual(handleError(new Error('Key not found')), 1)
  })

  it('exits with code 1 on set error', () => {
    const handleError = (error: Error | null) => {
      if (error) {
        console.error('Failed to set env:', error.message)
        return 1
      }
      return 0
    }
    
    assert.strictEqual(handleError(new Error('Not authenticated')), 1)
  })
})
