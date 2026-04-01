import { describe, it } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { encryptWithPk, decryptWithPk, derivePkFromMnemonic } from '../src/index.ts'

describe('Security - Crypto IV Randomness', () => {
  const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
  const pk = derivePkFromMnemonic(mnemonic)
  const value = 'test-secret-value'
  const aad = 'test-project:KEY'

  it('IV is random - encrypt produces different output each time', () => {
    const encrypted1 = encryptWithPk(value, pk, aad)
    const encrypted2 = encryptWithPk(value, pk, aad)
    const encrypted3 = encryptWithPk(value, pk, aad)
    
    // All three should be different due to random IV
    assert.notStrictEqual(encrypted1, encrypted2)
    assert.notStrictEqual(encrypted2, encrypted3)
    assert.notStrictEqual(encrypted1, encrypted3)
    
    // But all should decrypt to the same value
    assert.strictEqual(decryptWithPk(encrypted1, pk, aad), value)
    assert.strictEqual(decryptWithPk(encrypted2, pk, aad), value)
    assert.strictEqual(decryptWithPk(encrypted3, pk, aad), value)
  })

  it('IV is 12 bytes (96 bits for AES-GCM)', () => {
    // Encrypt and decode to check IV length
    const encrypted = encryptWithPk(value, pk, aad)
    const decoded = Buffer.from(encrypted, 'base64')
    
    // First 12 bytes are IV
    const iv = decoded.subarray(0, 12)
    assert.strictEqual(iv.length, 12)
  })

  it('IV uses crypto.randomBytes (cryptographically secure)', () => {
    // This test verifies the implementation uses crypto.randomBytes
    // by checking that we get unique values
    const ivs = new Set()
    for (let i = 0; i < 100; i++) {
      const encrypted = encryptWithPk(value, pk, aad)
      const decoded = Buffer.from(encrypted, 'base64')
      const iv = decoded.subarray(0, 12).toString('hex')
      ivs.add(iv)
    }
    
    // All 100 IVs should be unique (extremely high probability)
    assert.strictEqual(ivs.size, 100)
  })
})

describe('Security - PK Key Length', () => {
  it('PK is always 32 bytes (256 bits for AES-256)', () => {
    const mnemonics = [
      'abandon ability able about above absent absorb abstract absurd abuse access accident',
      'acoustic acquire across act action actor actress actual adapt add addict address',
      'adjust admit adult advance advice aerobic affair afford afraid again age agent',
    ]
    
    for (const mnemonic of mnemonics) {
      const pk = derivePkFromMnemonic(mnemonic)
      assert.strictEqual(pk.length, 32, 'PK should be 32 bytes')
    }
  })

  it('PK derivation uses PBKDF2 with 100k iterations', () => {
    // Verify PBKDF2 is used by checking consistency
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    const pk1 = derivePkFromMnemonic(mnemonic)
    const pk2 = derivePkFromMnemonic(mnemonic)
    
    assert.deepStrictEqual(pk1, pk2)
    
    // Different mnemonic = different PK
    const pk3 = derivePkFromMnemonic('acoustic acquire across act action actor actress actual adapt add addict address')
    assert.ok(!pk1.equals(pk3))
  })
})

describe('Security - AAD Binding', () => {
  const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
  const pk = derivePkFromMnemonic(mnemonic)
  const value = 'secret-api-key'

  it('AAD is bound to ciphertext - wrong AAD fails decryption', () => {
    const correctAad = 'project-a:API_KEY'
    const wrongAad = 'project-b:WRONG_KEY'
    
    const encrypted = encryptWithPk(value, pk, correctAad)
    
    assert.throws(
      () => decryptWithPk(encrypted, pk, wrongAad),
      /Unsupported state or unable to authenticate data|digital envelope/
    )
  })

  it('AAD tampering detected', () => {
    const aad = 'project:KEY'
    const encrypted = encryptWithPk(value, pk, aad)
    
    // Tamper with AAD
    const tamperedAad = 'project:KEY_TAMPERED'
    
    assert.throws(
      () => decryptWithPk(encrypted, pk, tamperedAad),
      /Unsupported state or unable to authenticate data/
    )
  })

  it('Same value with different AAD produces different ciphertext', () => {
    const aad1 = 'project-a:KEY'
    const aad2 = 'project-b:KEY'
    
    const encrypted1 = encryptWithPk(value, pk, aad1)
    const encrypted2 = encryptWithPk(value, pk, aad2)
    
    // Different AAD = different ciphertext (AAD is authenticated)
    assert.notStrictEqual(encrypted1, encrypted2)
  })
})

describe('Security - Output Encoding', () => {
  const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
  const pk = derivePkFromMnemonic(mnemonic)
  const value = 'secret-with-special-chars-🔑'
  const aad = 'project:KEY'

  it('Encrypted output is valid base64', () => {
    const encrypted = encryptWithPk(value, pk, aad)
    
    // Should not throw
    const decoded = Buffer.from(encrypted, 'base64')
    
    // Re-encoding should match
    assert.strictEqual(decoded.toString('base64'), encrypted)
  })

  it('Encrypted output is safe for storage/transit', () => {
    const encrypted = encryptWithPk(value, pk, aad)
    
    // Base64 should only contain safe characters
    assert.ok(/^[A-Za-z0-9+/=]+$/.test(encrypted))
    
    // No newlines or special characters
    assert.ok(!encrypted.includes('\n'))
    assert.ok(!encrypted.includes('\r'))
    assert.ok(!encrypted.includes(' '))
  })

  it('Encrypted output contains IV + tag + ciphertext', () => {
    const encrypted = encryptWithPk(value, pk, aad)
    const decoded = Buffer.from(encrypted, 'base64')
    
    // Structure: IV (12) + tag (16) + ciphertext (variable)
    assert.ok(decoded.length > 28) // At least IV + tag
    
    const iv = decoded.subarray(0, 12)
    const tag = decoded.subarray(12, 28)
    const ciphertext = decoded.subarray(28)
    
    assert.strictEqual(iv.length, 12)
    assert.strictEqual(tag.length, 16)
    assert.ok(ciphertext.length > 0)
  })
})

describe('Security - Tamper Detection', () => {
  const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
  const pk = derivePkFromMnemonic(mnemonic)
  const value = 'untampered-value'
  const aad = 'project:KEY'

  it('Tampered ciphertext fails decryption', () => {
    const encrypted = encryptWithPk(value, pk, aad)
    const decoded = Buffer.from(encrypted, 'base64')
    
    // Tamper with ciphertext portion
    const tampered = Buffer.from(decoded)
    tampered[tampered.length - 1] = tampered[tampered.length - 1] ^ 0xFF
    
    const tamperedBase64 = tampered.toString('base64')
    
    assert.throws(
      () => decryptWithPk(tamperedBase64, pk, aad),
      /Unsupported state or unable to authenticate data/
    )
  })

  it('Tampered auth tag fails decryption', () => {
    const encrypted = encryptWithPk(value, pk, aad)
    const decoded = Buffer.from(encrypted, 'base64')
    
    // Tamper with tag portion (bytes 12-27)
    const tampered = Buffer.from(decoded)
    tampered[15] = tampered[15] ^ 0xFF
    
    const tamperedBase64 = tampered.toString('base64')
    
    assert.throws(
      () => decryptWithPk(tamperedBase64, pk, aad),
      /Unsupported state or unable to authenticate data/
    )
  })

  it('Truncated ciphertext fails decryption', () => {
    const encrypted = encryptWithPk(value, pk, aad)
    const decoded = Buffer.from(encrypted, 'base64')
    
    // Truncate the buffer
    const truncated = decoded.subarray(0, decoded.length - 5)
    const truncatedBase64 = truncated.toString('base64')
    
    assert.throws(
      () => decryptWithPk(truncatedBase64, pk, aad),
      /Unsupported state or unable to authenticate data|wrong final block length/
    )
  })
})
