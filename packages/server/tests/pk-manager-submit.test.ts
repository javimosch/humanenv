import { describe, it } from 'node:test'
import assert from 'node:assert'
import { PkManager } from '../src/pk-manager.ts'
import { HumanEnvError, ErrorCode } from 'humanenv-shared'

describe('PkManager.submitMnemonic', () => {
  it('accepts valid 12-word mnemonic (first setup)', () => {
    const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pkManager = new PkManager()
    
    const result = pkManager.submitMnemonic(validMnemonic, null)
    
    assert.strictEqual(result.verified, true)
    assert.strictEqual(result.firstSetup, true)
    assert.ok(result.hash.length > 0)
    assert.strictEqual(pkManager.isReady(), true)
  })

  it('accepts valid mnemonic matching stored hash', () => {
    const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pkManager = new PkManager()
    
    // First submit to get the hash
    const firstResult = pkManager.submitMnemonic(validMnemonic, null)
    
    // Clear and resubmit with stored hash
    pkManager.clear()
    const secondResult = pkManager.submitMnemonic(validMnemonic, firstResult.hash)
    
    assert.strictEqual(secondResult.verified, true)
    assert.strictEqual(secondResult.firstSetup, false)
  })

  it('rejects invalid mnemonic (wrong word count)', () => {
    const invalidMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access'
    const pkManager = new PkManager()
    
    assert.throws(
      () => pkManager.submitMnemonic(invalidMnemonic, null),
      /Invalid mnemonic/
    )
  })

  it('rejects invalid mnemonic (invalid words)', () => {
    const invalidMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access invalidword'
    const pkManager = new PkManager()
    
    assert.throws(
      () => pkManager.submitMnemonic(invalidMnemonic, null),
      /Invalid mnemonic/
    )
  })

  it('rejects mnemonic that does not match stored hash', () => {
    const mnemonic1 = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const mnemonic2 = 'acoustic acquire across act action actor actress actual adapt add addict address'
    const pkManager = new PkManager()
    
    // Submit first mnemonic to establish hash
    const firstResult = pkManager.submitMnemonic(mnemonic1, null)
    
    // Clear and try to submit different mnemonic with stored hash
    pkManager.clear()
    
    assert.throws(
      () => pkManager.submitMnemonic(mnemonic2, firstResult.hash),
      /Mnemonic does not match the stored hash/
    )
  })

  it('trims whitespace from mnemonic', () => {
    const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const withWhitespace = `  ${validMnemonic}  `
    const pkManager = new PkManager()
    
    const result = pkManager.submitMnemonic(withWhitespace, null)
    
    assert.strictEqual(result.verified, true)
    assert.strictEqual(pkManager.isReady(), true)
  })

  it('case insensitive mnemonic handling', () => {
    const lower = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const upper = 'ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT'
    const pkManager = new PkManager()
    
    const result1 = pkManager.submitMnemonic(lower, null)
    pkManager.clear()
    const result2 = pkManager.submitMnemonic(upper, result1.hash)
    
    assert.strictEqual(result2.verified, true)
  })
})

describe('PkManager.encrypt / decrypt', () => {
  it('encrypt and decrypt roundtrip', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pkManager = new PkManager()
    pkManager.submitMnemonic(mnemonic, null)
    
    const value = 'my-secret-api-key'
    const aad = 'test-project:API_KEY'
    
    const encrypted = pkManager.encrypt(value, aad)
    const decrypted = pkManager.decrypt(encrypted, aad)
    
    assert.strictEqual(decrypted, value)
  })

  it('decrypt with wrong AAD fails', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pkManager = new PkManager()
    pkManager.submitMnemonic(mnemonic, null)
    
    const value = 'my-secret-api-key'
    const aad = 'test-project:API_KEY'
    const wrongAad = 'wrong-project:WRONG_KEY'
    
    const encrypted = pkManager.encrypt(value, aad)
    
    assert.throws(
      () => pkManager.decrypt(encrypted, wrongAad),
      /Unsupported state or unable to authenticate data|digital envelope/
    )
  })

  it('encrypt produces different output each time', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pkManager = new PkManager()
    pkManager.submitMnemonic(mnemonic, null)
    
    const value = 'my-secret-api-key'
    const aad = 'test-project:API_KEY'
    
    const encrypted1 = pkManager.encrypt(value, aad)
    const encrypted2 = pkManager.encrypt(value, aad)
    
    assert.notStrictEqual(encrypted1, encrypted2)
    
    // Both decrypt to same value
    const decrypted1 = pkManager.decrypt(encrypted1, aad)
    const decrypted2 = pkManager.decrypt(encrypted2, aad)
    assert.strictEqual(decrypted1, value)
    assert.strictEqual(decrypted2, value)
  })
})

describe('PkManager.getPk', () => {
  it('throws when PK not loaded', () => {
    const pkManager = new PkManager()
    
    assert.throws(
      () => pkManager.getPk(),
      (err: Error) => {
        assert.ok(err instanceof HumanEnvError)
        assert.strictEqual((err as HumanEnvError).code, ErrorCode.SERVER_PK_NOT_AVAILABLE)
        return true
      }
    )
  })

  it('returns PK after mnemonic submitted', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pkManager = new PkManager()
    pkManager.submitMnemonic(mnemonic, null)
    
    const pk = pkManager.getPk()
    assert.strictEqual(pk.length, 32)
  })
})

describe('PkManager.clear', () => {
  it('removes PK from memory', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pkManager = new PkManager()
    pkManager.submitMnemonic(mnemonic, null)
    
    assert.strictEqual(pkManager.isReady(), true)
    
    pkManager.clear()
    
    assert.strictEqual(pkManager.isReady(), false)
    
    // getPk should throw after clear
    assert.throws(
      () => pkManager.getPk(),
      (err: Error) => {
        assert.ok(err instanceof HumanEnvError)
        assert.strictEqual((err as HumanEnvError).code, ErrorCode.SERVER_PK_NOT_AVAILABLE)
        return true
      }
    )
  })
})

describe('PkManager.getMnemonic', () => {
  it('generates new mnemonic if not set', () => {
    const pkManager = new PkManager()
    const mnemonic = pkManager.getMnemonic()
    
    const words = mnemonic.split(' ')
    assert.strictEqual(words.length, 12)
  })

  it('returns same mnemonic on subsequent calls', () => {
    const pkManager = new PkManager()
    const mnemonic1 = pkManager.getMnemonic()
    const mnemonic2 = pkManager.getMnemonic()
    
    assert.strictEqual(mnemonic1, mnemonic2)
  })

  it('returns submitted mnemonic', () => {
    const submittedMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pkManager = new PkManager()
    pkManager.submitMnemonic(submittedMnemonic, null)
    
    const retrievedMnemonic = pkManager.getMnemonic()
    assert.strictEqual(retrievedMnemonic, submittedMnemonic)
  })
})
