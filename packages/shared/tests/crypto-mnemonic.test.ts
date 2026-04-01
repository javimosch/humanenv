import { describe, it } from 'node:test'
import assert from 'node:assert'
import { generateMnemonic, validateMnemonic, derivePkFromMnemonic, hashPkForVerification } from '../src/index.ts'

describe('generateMnemonic', () => {
  it('returns 12 space-separated words', () => {
    const mnemonic = generateMnemonic()
    const words = mnemonic.split(' ')
    assert.strictEqual(words.length, 12)
  })

  it('returns words from BIP39 wordlist', () => {
    const mnemonic = generateMnemonic()
    const words = mnemonic.split(' ')
    
    // All words should be valid (validation checks wordlist)
    const isValid = validateMnemonic(mnemonic)
    assert.strictEqual(isValid, true)
  })

  it('generates different mnemonics each call', () => {
    const mnemonic1 = generateMnemonic()
    const mnemonic2 = generateMnemonic()
    assert.notStrictEqual(mnemonic1, mnemonic2)
  })
})

describe('validateMnemonic', () => {
  it('accepts valid 12-word phrase', () => {
    const valid = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    assert.strictEqual(validateMnemonic(valid), true)
  })

  it('rejects phrase with wrong word count', () => {
    const elevenWords = 'abandon ability able about above absent absorb abstract absurd abuse access'
    const thirteenWords = 'abandon ability able about above absent absorb abstract absurd abuse access accident acid'
    
    assert.strictEqual(validateMnemonic(elevenWords), false)
    assert.strictEqual(validateMnemonic(thirteenWords), false)
  })

  it('rejects phrase with invalid word', () => {
    const invalid = 'abandon ability able about above absent absorb abstract absurd abuse access invalidword'
    assert.strictEqual(validateMnemonic(invalid), false)
  })

  it('rejects empty string', () => {
    assert.strictEqual(validateMnemonic(''), false)
  })

  it('rejects non-string input', () => {
    // @ts-ignore - testing invalid input
    assert.strictEqual(validateMnemonic(123), false)
    // @ts-ignore
    assert.strictEqual(validateMnemonic(null), false)
  })

  it('trims whitespace before validation', () => {
    const valid = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const withWhitespace = `  ${valid}  `
    assert.strictEqual(validateMnemonic(withWhitespace), true)
  })

  it('case insensitive validation', () => {
    const upperCase = 'ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT'
    assert.strictEqual(validateMnemonic(upperCase), true)
  })
})

describe('derivePkFromMnemonic', () => {
  it('produces 32-byte key', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pk = derivePkFromMnemonic(mnemonic)
    assert.strictEqual(pk.length, 32)
  })

  it('produces consistent key for same mnemonic', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pk1 = derivePkFromMnemonic(mnemonic)
    const pk2 = derivePkFromMnemonic(mnemonic)
    assert.deepStrictEqual(pk1, pk2)
  })

  it('produces different keys for different mnemonics', () => {
    const mnemonic1 = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const mnemonic2 = 'acoustic acquire across act action actor actress actual adapt add addict address'
    const pk1 = derivePkFromMnemonic(mnemonic1)
    const pk2 = derivePkFromMnemonic(mnemonic2)
    assert.ok(!pk1.equals(pk2))
  })

  it('case insensitive (lowercase trim)', () => {
    const lower = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const upper = 'ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT'
    const pkLower = derivePkFromMnemonic(lower)
    const pkUpper = derivePkFromMnemonic(upper)
    assert.deepStrictEqual(pkLower, pkUpper)
  })
})

describe('hashPkForVerification', () => {
  it('produces 64-character hex string', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pk = derivePkFromMnemonic(mnemonic)
    const hash = hashPkForVerification(pk)
    assert.strictEqual(hash.length, 64)
    assert.ok(/^[0-9a-f]+$/i.test(hash))
  })

  it('produces consistent hash for same PK', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pk = derivePkFromMnemonic(mnemonic)
    const hash1 = hashPkForVerification(pk)
    const hash2 = hashPkForVerification(pk)
    assert.strictEqual(hash1, hash2)
  })

  it('produces different hashes for different PKs', () => {
    const mnemonic1 = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const mnemonic2 = 'acoustic acquire across act action actor actress actual adapt add addict address'
    const pk1 = derivePkFromMnemonic(mnemonic1)
    const pk2 = derivePkFromMnemonic(mnemonic2)
    const hash1 = hashPkForVerification(pk1)
    const hash2 = hashPkForVerification(pk2)
    assert.notStrictEqual(hash1, hash2)
  })
})
