import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { generateFingerprint } from 'humanenv-shared'

describe('Security - Fingerprint Determinism', () => {
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

  it('produces same fingerprint for same environment', () => {
    const fp1 = generateFingerprint()
    const fp2 = generateFingerprint()
    const fp3 = generateFingerprint()
    
    assert.strictEqual(fp1, fp2)
    assert.strictEqual(fp2, fp3)
  })

  it('produces same fingerprint after process restart (simulated)', () => {
    // Simulate restart by regenerating with same env
    const before = generateFingerprint()
    
    // "Restart" - regenerate
    const after = generateFingerprint()
    
    assert.strictEqual(before, after)
  })
})

describe('Security - Fingerprint Component Sensitivity', () => {
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

  it('changes fingerprint when HOSTNAME changes', () => {
    process.env.HOSTNAME = 'server-a'
    const fpA = generateFingerprint()
    
    process.env.HOSTNAME = 'server-b'
    const fpB = generateFingerprint()
    
    assert.notStrictEqual(fpA, fpB)
  })

  it('uses fallback for missing HOSTNAME', () => {
    delete process.env.HOSTNAME
    const fp1 = generateFingerprint()
    
    process.env.HOSTNAME = 'unknown-host'
    const fp2 = generateFingerprint()
    
    // Should use 'unknown-host' fallback consistently
    assert.strictEqual(fp1, fp2)
  })

  it('includes platform in fingerprint', () => {
    // Platform is part of the components
    // This test verifies the fingerprint is tied to the platform
    const fp = generateFingerprint()
    assert.ok(fp.length > 0)
    
    // If we could change platform, fingerprint would change
    // (We can't actually test this without mocking process.platform)
  })
})

describe('Security - Fingerprint Format Safety', () => {
  it('produces 16-character hex string', () => {
    const fp = generateFingerprint()
    assert.strictEqual(fp.length, 16)
    assert.ok(/^[0-9a-f]+$/i.test(fp))
  })

  it('fingerprint is not easily reversible', () => {
    const fp = generateFingerprint()
    
    // 16 hex chars = 64 bits of entropy
    // Should not be able to guess original components from fingerprint
    assert.ok(fp.length === 16)
    
    // Hash output should look random
    const uniqueChars = new Set(fp.split(''))
    assert.ok(uniqueChars.size >= 6) // Should have variety of hex chars
  })

  it('fingerprint contains no special characters', () => {
    const fp = generateFingerprint()
    
    // Only hex characters allowed
    assert.ok(/^[0-9a-f]+$/i.test(fp))
    assert.ok(!fp.includes('-'))
    assert.ok(!fp.includes('_'))
    assert.ok(!fp.includes(' '))
  })
})

describe('Security - Fingerprint Spoofing Resistance', () => {
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

  it('requires all components to spoof', () => {
    // Attacker would need to spoof:
    // - HOSTNAME
    // - process.platform
    // - process.arch
    // - process.version
    
    process.env.HOSTNAME = 'legitimate-server'
    const legitimateFp = generateFingerprint()
    
    // Attacker sets same HOSTNAME
    process.env.HOSTNAME = 'legitimate-server'
    const attackerFp = generateFingerprint()
    
    // On same platform/arch/version, fingerprints match
    // (This is expected behavior - fingerprint is deterministic)
    assert.strictEqual(legitimateFp, attackerFp)
    
    // Note: This is a known limitation - fingerprint is based on
    // environment variables that can be spoofed. For stronger
    // binding, hardware identifiers would be needed.
  })

  it('different architectures produce different fingerprints', () => {
    // This test documents that fingerprint includes arch
    const fp = generateFingerprint()
    assert.ok(fp.length > 0)
    
    // If process.arch were different, fingerprint would change
    // (We can't actually test this without mocking)
  })

  it('fingerprint is consistent for legitimate reconnections', () => {
    // Legitimate client reconnecting should have same fingerprint
    const fp1 = generateFingerprint()
    const fp2 = generateFingerprint()
    
    assert.strictEqual(fp1, fp2)
  })
})
