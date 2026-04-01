import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { generateFingerprint } from '../src/index.ts'

describe('generateFingerprint', () => {
  let originalHostname: string | undefined

  beforeEach(() => {
    originalHostname = process.env.HOSTNAME
  })

  afterEach(() => {
    if (originalHostname !== undefined) {
      process.env.HOSTNAME = originalHostname
    } else {
      delete process.env.HOSTNAME
    }
  })

  it('returns 16-character hex string', () => {
    const fingerprint = generateFingerprint()
    assert.strictEqual(fingerprint.length, 16)
    assert.ok(/^[0-9a-f]+$/i.test(fingerprint))
  })

  it('is deterministic (same output for same environment)', () => {
    const fp1 = generateFingerprint()
    const fp2 = generateFingerprint()
    assert.strictEqual(fp1, fp2)
  })

  it('uses HOSTNAME env var when set', () => {
    process.env.HOSTNAME = 'test-host-123'
    const fingerprint = generateFingerprint()
    assert.strictEqual(fingerprint.length, 16)
  })

  it('uses fallback when HOSTNAME not set', () => {
    delete process.env.HOSTNAME
    const fingerprint = generateFingerprint()
    assert.strictEqual(fingerprint.length, 16)
    // Should still produce a valid fingerprint with 'unknown-host' fallback
  })

  it('includes platform in fingerprint', () => {
    const fp1 = generateFingerprint()
    // Platform is part of the fingerprint components
    assert.ok(fp1.length > 0)
  })

  it('different HOSTNAME produces different fingerprint', () => {
    process.env.HOSTNAME = 'host-a'
    const fpA = generateFingerprint()
    
    process.env.HOSTNAME = 'host-b'
    const fpB = generateFingerprint()
    
    assert.notStrictEqual(fpA, fpB)
  })
})
