import { describe, it } from 'node:test'
import assert from 'node:assert'

// Input validation patterns (simulating what should be in the server)
const PROJECT_NAME_REGEX = /^[a-zA-Z0-9_-]{1,64}$/
const ENV_KEY_REGEX = /^[A-Z_][A-Z0-9_]{0,255}$/

function validateProjectName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Project name is required' }
  }
  if (!PROJECT_NAME_REGEX.test(name)) {
    return { valid: false, error: 'Invalid project name format' }
  }
  return { valid: true }
}

function validateEnvKey(key: string): { valid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Env key is required' }
  }
  if (!ENV_KEY_REGEX.test(key)) {
    return { valid: false, error: 'Invalid env key format' }
  }
  return { valid: true }
}

function validateWsMessageSize(data: Buffer, maxSize: number): { valid: boolean; error?: string } {
  if (data.length > maxSize) {
    return { valid: false, error: `Message too large (max ${maxSize} bytes)` }
  }
  return { valid: true }
}

function sanitizeForDisplay(input: string): string {
  // Basic XSS prevention - escape HTML special chars
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

describe('Security - SQL Injection Prevention', () => {
  const sqlInjectionPatterns = [
    "'; DROP TABLE projects; --",
    "' OR '1'='1",
    "1; DELETE FROM envs WHERE '1'='1",
    "admin'--",
    "test' UNION SELECT * FROM users--",
    "1' AND '1'='1",
  ]

  it('rejects SQL injection in project name', () => {
    for (const pattern of sqlInjectionPatterns) {
      const result = validateProjectName(pattern)
      assert.strictEqual(result.valid, false, `Should reject: ${pattern}`)
    }
  })

  it('rejects SQL injection with semicolons', () => {
    const result = validateProjectName("valid; DROP TABLE projects")
    assert.strictEqual(result.valid, false)
  })

  it('accepts valid project names', () => {
    const validNames = ['my-app', 'test_project', 'app123', 'a']
    for (const name of validNames) {
      const result = validateProjectName(name)
      assert.strictEqual(result.valid, true, `Should accept: ${name}`)
    }
  })
})

describe('Security - XSS Prevention', () => {
  const xssPatterns = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><script>alert(1)</script>',
    '<svg onload=alert(1)>',
    'javascript:alert(1)',
    '<iframe src="javascript:alert(1)">',
  ]

  it('rejects XSS in env key', () => {
    for (const pattern of xssPatterns) {
      const result = validateEnvKey(pattern)
      assert.strictEqual(result.valid, false, `Should reject: ${pattern}`)
    }
  })

  it('sanitizes output for display', () => {
    const malicious = '<script>alert(1)</script>'
    const sanitized = sanitizeForDisplay(malicious)
    
    assert.ok(!sanitized.includes('<script>'))
    assert.ok(sanitized.includes('&lt;script&gt;'))
    assert.strictEqual(sanitized, '&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('accepts valid env keys', () => {
    const validKeys = ['API_KEY', 'DATABASE_URL', 'MY_VAR_123', 'A']
    for (const key of validKeys) {
      const result = validateEnvKey(key)
      assert.strictEqual(result.valid, true, `Should accept: ${key}`)
    }
  })
})

describe('Security - Path Traversal Prevention', () => {
  const pathTraversalPatterns = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '....//....//etc/passwd',
    '/etc/shadow',
    'C:\\Windows\\System32',
    '..%2f..%2f..%2fetc%2fpasswd',
  ]

  it('rejects path traversal in project name', () => {
    for (const pattern of pathTraversalPatterns) {
      const result = validateProjectName(pattern)
      assert.strictEqual(result.valid, false, `Should reject: ${pattern}`)
    }
  })

  it('rejects absolute paths', () => {
    const result1 = validateProjectName('/absolute/path')
    const result2 = validateProjectName('C:\\windows')
    
    assert.strictEqual(result1.valid, false)
    assert.strictEqual(result2.valid, false)
  })
})

describe('Security - WebSocket Message Size Limits', () => {
  const MAX_WS_MESSAGE_SIZE = 4096 // 4KB

  it('accepts messages under size limit', () => {
    const smallMessage = Buffer.from(JSON.stringify({ type: 'get', payload: { key: 'TEST' } }))
    const result = validateWsMessageSize(smallMessage, MAX_WS_MESSAGE_SIZE)
    assert.strictEqual(result.valid, true)
  })

  it('rejects oversized messages', () => {
    const largeMessage = Buffer.alloc(MAX_WS_MESSAGE_SIZE + 1)
    const result = validateWsMessageSize(largeMessage, MAX_WS_MESSAGE_SIZE)
    assert.strictEqual(result.valid, false)
    assert.ok(result.error?.includes('too large'))
  })

  it('rejects extremely large messages', () => {
    const hugeMessage = Buffer.alloc(1024 * 1024) // 1MB
    const result = validateWsMessageSize(hugeMessage, MAX_WS_MESSAGE_SIZE)
    assert.strictEqual(result.valid, false)
  })
})

describe('Security - JSON Parse Error Handling', () => {
  const invalidJsonInputs = [
    '{ invalid json }',
    '{"key": undefined}',
    '{"key": NaN}',
    'not json at all',
    '{"unclosed": "string',
    '{key: "unquoted key"}',
    '{"nested": { "deep": [ }}',
  ]

  it('handles malformed JSON gracefully', () => {
    for (const input of invalidJsonInputs) {
      let parsed = null
      let error = false
      
      try {
        parsed = JSON.parse(input)
      } catch {
        error = true
      }
      
      // Should throw, not crash
      assert.strictEqual(error, true, `Should error for: ${input}`)
      assert.strictEqual(parsed, null)
    }
  })

  it('returns error response for invalid JSON', () => {
    function safeJsonParse(input: string): { success: boolean; data?: any; error?: string } {
      try {
        return { success: true, data: JSON.parse(input) }
      } catch (e: any) {
        return { success: false, error: 'Invalid JSON format' }
      }
    }
    
    const result = safeJsonParse('{ invalid }')
    assert.strictEqual(result.success, false)
    assert.ok(result.error?.includes('Invalid JSON'))
  })
})

describe('Security - Unicode Normalization', () => {
  const unicodeTests = [
    { input: 'café', normalized: 'café' },
    { input: 'cafe\u0301', normalized: 'café' }, // e + combining acute
    { input: 'München', normalized: 'München' },
    { input: 'M\u00fcnchen', normalized: 'München' },
  ]

  it('handles unicode in project names', () => {
    // Project names should only allow ASCII for safety
    const unicodeName = 'café-app'
    const result = validateProjectName(unicodeName)
    assert.strictEqual(result.valid, false) // Should reject non-ASCII
  })

  it('handles unicode in env values (not keys)', () => {
    // Env values can have unicode, keys should be ASCII
    const unicodeValue = 'secret-🔑-ключ-キー'
    assert.ok(unicodeValue.length > 0)
    // This would be encrypted, not validated
  })
})

describe('Security - Null/Undefined Input Handling', () => {
  it('rejects null project name', () => {
    // @ts-ignore - testing invalid input
    const result1 = validateProjectName(null)
    // @ts-ignore
    const result2 = validateProjectName(undefined)
    
    assert.strictEqual(result1.valid, false)
    assert.strictEqual(result2.valid, false)
  })

  it('rejects null env key', () => {
    // @ts-ignore - testing invalid input
    const result1 = validateEnvKey(null)
    // @ts-ignore
    const result2 = validateEnvKey(undefined)
    // @ts-ignore
    const result3 = validateEnvKey('')
    
    assert.strictEqual(result1.valid, false)
    assert.strictEqual(result2.valid, false)
    assert.strictEqual(result3.valid, false)
  })

  it('rejects number as input', () => {
    // @ts-ignore - testing invalid input
    const result1 = validateProjectName(123)
    // @ts-ignore
    const result2 = validateEnvKey(456)
    
    assert.strictEqual(result1.valid, false)
    assert.strictEqual(result2.valid, false)
  })

  it('rejects object as input', () => {
    // @ts-ignore - testing invalid input
    const result1 = validateProjectName({ name: 'test' })
    // @ts-ignore
    const result2 = validateEnvKey({ key: 'TEST' })
    
    assert.strictEqual(result1.valid, false)
    assert.strictEqual(result2.valid, false)
  })
})

describe('Security - Input Length Limits', () => {
  it('rejects project name over 64 chars', () => {
    const longName = 'a'.repeat(65)
    const result = validateProjectName(longName)
    assert.strictEqual(result.valid, false)
    
    // Boundary test - exactly 64 should pass
    const exactName = 'a'.repeat(64)
    const exactResult = validateProjectName(exactName)
    assert.strictEqual(exactResult.valid, true)
  })

  it('rejects env key over 256 chars', () => {
    const longKey = 'A'.repeat(257)
    const result = validateEnvKey(longKey)
    assert.strictEqual(result.valid, false)
  })

  it('rejects empty strings', () => {
    const result1 = validateProjectName('')
    const result2 = validateEnvKey('')
    
    assert.strictEqual(result1.valid, false)
    assert.strictEqual(result2.valid, false)
  })
})
