import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { encryptWithPk, decryptWithPk, derivePkFromMnemonic } from '../src/index.ts'

describe('encryptWithPk / decryptWithPk', () => {
  let pk: Buffer
  const testValue = 'super-secret-api-key-12345'
  const aad = 'test-project:API_KEY'

  before(() => {
    // Derive a consistent PK for testing
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    pk = derivePkFromMnemonic(mnemonic)
  })

  it('decrypt(encrypt(value)) returns original value', () => {
    const encrypted = encryptWithPk(testValue, pk, aad)
    const decrypted = decryptWithPk(encrypted, pk, aad)
    assert.strictEqual(decrypted, testValue)
  })

  it('encrypt produces different ciphertext each time (random IV)', () => {
    const encrypted1 = encryptWithPk(testValue, pk, aad)
    const encrypted2 = encryptWithPk(testValue, pk, aad)
    assert.notStrictEqual(encrypted1, encrypted2)
    
    // Both should decrypt to the same value
    const decrypted1 = decryptWithPk(encrypted1, pk, aad)
    const decrypted2 = decryptWithPk(encrypted2, pk, aad)
    assert.strictEqual(decrypted1, testValue)
    assert.strictEqual(decrypted2, testValue)
  })

  it('decrypt with wrong AAD throws error', () => {
    const encrypted = encryptWithPk(testValue, pk, aad)
    const wrongAad = 'wrong-project:WRONG_KEY'
    
    assert.throws(
      () => decryptWithPk(encrypted, pk, wrongAad),
      /error:0407106B:rsa routines:RSA_padding_check_PKCS1_type_2:block type is not 02|digital envelope routines|Unsupported state or unable to authenticate data/
    )
  })

  it('decrypt with wrong PK throws error', () => {
    const encrypted = encryptWithPk(testValue, pk, aad)
    const wrongPk = crypto.randomBytes(32)
    
    assert.throws(
      () => decryptWithPk(encrypted, wrongPk, aad),
      /error:0407106B:rsa routines:RSA_padding_check_PKCS1_type_2:block type is not 02|digital envelope routines|Unsupported state or unable to authenticate data/
    )
  })

  it('encrypt empty string works', () => {
    const encrypted = encryptWithPk('', pk, aad)
    const decrypted = decryptWithPk(encrypted, pk, aad)
    assert.strictEqual(decrypted, '')
  })

  it('encrypt unicode characters works', () => {
    const unicodeValue = 'secret-🔑-キー-ключ'
    const encrypted = encryptWithPk(unicodeValue, pk, aad)
    const decrypted = decryptWithPk(encrypted, pk, aad)
    assert.strictEqual(decrypted, unicodeValue)
  })

  it('encrypted output is base64 encoded', () => {
    const encrypted = encryptWithPk(testValue, pk, aad)
    // Should be valid base64
    assert.doesNotThrow(() => Buffer.from(encrypted, 'base64'))
    
    // Should contain IV (12) + tag (16) + ciphertext
    const decoded = Buffer.from(encrypted, 'base64')
    assert.ok(decoded.length > 28) // At least IV + tag
  })
})
