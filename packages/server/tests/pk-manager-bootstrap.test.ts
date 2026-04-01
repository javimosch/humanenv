import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert'
import { PkManager } from '../src/pk-manager.ts'
import { HumanEnvError, ErrorCode } from 'humanenv-shared'

describe('PkManager.bootstrap', () => {
  let originalMnemonic: string | undefined

  beforeEach(() => {
    // Save original env var
    originalMnemonic = process.env.HUMANENV_MNEMONIC
    // Clear env var before each test
    delete process.env.HUMANENV_MNEMONIC
  })

  afterEach(() => {
    // Restore original env var
    if (originalMnemonic !== undefined) {
      process.env.HUMANENV_MNEMONIC = originalMnemonic
    } else {
      delete process.env.HUMANENV_MNEMONIC
    }
  })

  it('returns needs_input when no stored hash and no env var', async () => {
    const pkManager = new PkManager()
    const result = await pkManager.bootstrap(null)
    
    assert.strictEqual(result.status, 'needs_input')
    assert.strictEqual(result.existing, 'first')
    assert.strictEqual(pkManager.isReady(), false)
  })

  it('returns needs_input when stored hash exists but no env var', async () => {
    const pkManager = new PkManager()
    const storedHash = 'abc123def456'
    const result = await pkManager.bootstrap(storedHash)
    
    assert.strictEqual(result.status, 'needs_input')
    assert.strictEqual(result.existing, 'hash')
    assert.strictEqual(pkManager.isReady(), false)
  })

  it('returns ready when HUMANENV_MNEMONIC is set (first startup)', async () => {
    const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    process.env.HUMANENV_MNEMONIC = validMnemonic
    
    const pkManager = new PkManager()
    const result = await pkManager.bootstrap(null)
    
    assert.strictEqual(result.status, 'ready')
    assert.strictEqual(result.existing, 'first')
    assert.strictEqual(pkManager.isReady(), true)
  })

  it('returns ready when HUMANENV_MNEMONIC is set (existing hash)', async () => {
    const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    process.env.HUMANENV_MNEMONIC = validMnemonic
    
    // Need to derive the hash that matches this mnemonic
    const { derivePkFromMnemonic, hashPkForVerification } = await import('humanenv-shared')
    const pk = derivePkFromMnemonic(validMnemonic)
    const storedHash = hashPkForVerification(pk)
    
    const pkManager = new PkManager()
    const result = await pkManager.bootstrap(storedHash)
    
    assert.strictEqual(result.status, 'ready')
    assert.strictEqual(result.existing, 'hash')
    assert.strictEqual(pkManager.isReady(), true)
  })

  it('throws when HUMANENV_MNEMONIC contains invalid mnemonic', async () => {
    process.env.HUMANENV_MNEMONIC = 'invalid words not in wordlist xyz abc def ghi jkl mno pqr stu vwx'
    
    const pkManager = new PkManager()
    
    await assert.rejects(
      async () => pkManager.bootstrap(null),
      (err: Error) => {
        assert.ok(err instanceof HumanEnvError)
        assert.strictEqual((err as HumanEnvError).code, ErrorCode.SERVER_INTERNAL_ERROR)
        assert.ok(err.message.includes('invalid mnemonic'))
        return true
      }
    )
  })

  it('logs warning when derived hash does not match stored hash', async () => {
    const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    process.env.HUMANENV_MNEMONIC = validMnemonic
    const wrongStoredHash = 'wronghash123'
    
    const pkManager = new PkManager()
    const consoleWarnMock = mock.method(console, 'warn', () => {})
    
    const result = await pkManager.bootstrap(wrongStoredHash)
    
    assert.strictEqual(result.status, 'ready')
    assert.strictEqual(consoleWarnMock.mock.callCount(), 1)
    assert.ok(consoleWarnMock.mock.calls[0].arguments[0].includes('does not match'))
    
    consoleWarnMock.restore()
  })

  it('logs success message when PK restored from env', async () => {
    const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    process.env.HUMANENV_MNEMONIC = validMnemonic
    
    const pkManager = new PkManager()
    const consoleLogMock = mock.method(console, 'log', () => {})
    
    await pkManager.bootstrap(null)
    
    assert.strictEqual(consoleLogMock.mock.callCount(), 1)
    assert.ok(consoleLogMock.mock.calls[0].arguments[0].includes('PK restored'))
    
    consoleLogMock.restore()
  })
})
