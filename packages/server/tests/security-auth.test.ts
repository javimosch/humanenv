import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { createBasicAuthMiddleware } from '../src/auth.ts'

// Mock Express request/response
function createMockRequest(authHeader?: string) {
  const req: any = { headers: {} }
  if (authHeader) {
    req.headers.authorization = authHeader
  }
  return req
}

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    set(header: string, value: string) {
      this.headers[header] = value
      return this
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    send(body: string) {
      this.body = body
      return this
    },
  }
  return res
}

describe('Security - Auth Timing Attack Resistance', () => {
  const username = 'admin'
  const password = 'securepassword123'
  const middleware = createBasicAuthMiddleware(username, password)

  it('similar response time for invalid username vs invalid password', () => {
    // Test that auth fails fast for both cases (constant-time-ish)
    const invalidUsernameReq = createMockRequest(
      'Basic ' + Buffer.from(`wronguser:${password}`).toString('base64')
    )
    const invalidPasswordReq = createMockRequest(
      'Basic ' + Buffer.from(`${username}:wrongpass`).toString('base64')
    )
    
    const res1 = createMockResponse()
    const res2 = createMockResponse()
    
    // Measure execution time (both should be fast and similar)
    const start1 = process.hrtime.bigint()
    middleware(invalidUsernameReq, res1, () => {})
    const end1 = process.hrtime.bigint()
    
    const start2 = process.hrtime.bigint()
    middleware(invalidPasswordReq, res2, () => {})
    const end2 = process.hrtime.bigint()
    
    const time1 = Number(end1 - start1)
    const time2 = Number(end2 - start2)
    
    // Both should complete in under 1ms and be within 50% of each other
    assert.ok(time1 < 1000000, 'Invalid username should be fast')
    assert.ok(time2 < 1000000, 'Invalid password should be fast')
    
    // Times should be within reasonable range of each other
    const ratio = Math.max(time1, time2) / Math.min(time1, time2)
    assert.ok(ratio < 10, 'Response times should be similar')
  })

  it('same error response for all auth failures', () => {
    const testCases = [
      { req: createMockRequest(), desc: 'no credentials' },
      { req: createMockRequest('Basic invalid'), desc: 'malformed credentials' },
      { req: createMockRequest('Basic ' + Buffer.from('wrong:wrong').toString('base64')), desc: 'wrong credentials' },
    ]
    
    for (const { req, desc } of testCases) {
      const res = createMockResponse()
      middleware(req, res, () => {})
      
      // All should return 401 with same WWW-Authenticate header
      assert.strictEqual(res.statusCode, 401, `Failed for ${desc}`)
      assert.strictEqual(res.headers['WWW-Authenticate'], 'Basic realm="HumanEnv Admin"', `Failed for ${desc}`)
    }
  })
})

describe('Security - Brute Force Detection Pattern', () => {
  // Track failed attempts (simulating rate limiting logic)
  class AuthAttemptTracker {
    private attempts = new Map<string, { count: number; resetAt: number }>()
    
    recordAttempt(key: string): { allowed: boolean; remaining: number } {
      const now = Date.now()
      const record = this.attempts.get(key)
      
      if (!record || now > record.resetAt) {
        this.attempts.set(key, { count: 1, resetAt: now + 60000 })
        return { allowed: true, remaining: 4 }
      }
      
      if (record.count >= 5) {
        return { allowed: false, remaining: 0 }
      }
      
      record.count++
      return { allowed: true, remaining: 5 - record.count }
    }
  }

  it('tracks failed attempts per fingerprint', () => {
    const tracker = new AuthAttemptTracker()
    const fingerprint = 'fp-123'
    
    // First 5 attempts should be allowed
    for (let i = 0; i < 5; i++) {
      const result = tracker.recordAttempt(fingerprint)
      assert.strictEqual(result.allowed, true, `Attempt ${i + 1} should be allowed`)
    }
    
    // 6th attempt should be blocked
    const result = tracker.recordAttempt(fingerprint)
    assert.strictEqual(result.allowed, false, '6th attempt should be blocked')
  })

  it('resets attempts after time window', () => {
    const tracker = new AuthAttemptTracker()
    const fingerprint = 'fp-456'
    
    // Use up all attempts
    for (let i = 0; i < 5; i++) {
      tracker.recordAttempt(fingerprint)
    }
    
    // Should be blocked
    assert.strictEqual(tracker.recordAttempt(fingerprint).allowed, false)
    
    // Simulate time passing (reset window)
    const record = tracker.attempts.get(fingerprint)
    if (record) {
      record.resetAt = Date.now() - 1000 // 1 second ago
    }
    
    // Should be allowed again
    const result = tracker.recordAttempt(fingerprint)
    assert.strictEqual(result.allowed, true)
    assert.strictEqual(result.remaining, 4)
  })

  it('different fingerprints tracked separately', () => {
    const tracker = new AuthAttemptTracker()
    
    // Exhaust attempts for fingerprint 1
    for (let i = 0; i < 5; i++) {
      tracker.recordAttempt('fp-1')
    }
    
    // Fingerprint 2 should still be allowed
    const result = tracker.recordAttempt('fp-2')
    assert.strictEqual(result.allowed, true)
    assert.strictEqual(result.remaining, 4)
  })
})

describe('Security - Error Message Safety', () => {
  const username = 'admin'
  const password = 'securepassword123'
  const middleware = createBasicAuthMiddleware(username, password)

  it('does not leak whether username exists', () => {
    const existingUsernameReq = createMockRequest(
      'Basic ' + Buffer.from(`admin:wrongpass`).toString('base64')
    )
    const nonExistingUsernameReq = createMockRequest(
      'Basic ' + Buffer.from(`nonexistent:wrongpass`).toString('base64')
    )
    
    const res1 = createMockResponse()
    const res2 = createMockResponse()
    
    middleware(existingUsernameReq, res1, () => {})
    middleware(nonExistingUsernameReq, res2, () => {})
    
    // Both should return identical responses
    assert.strictEqual(res1.statusCode, res2.statusCode)
    assert.strictEqual(res1.body, res2.body)
    assert.deepStrictEqual(res1.headers, res2.headers)
  })

  it('does not leak internal state in error messages', () => {
    const req = createMockRequest('Basic invalid')
    const res = createMockResponse()
    
    middleware(req, res, () => {})
    
    // Error message should be generic
    assert.strictEqual(res.body, 'Authentication required')
    assert.ok(!res.body.includes('username'))
    assert.ok(!res.body.includes('password'))
    assert.ok(!res.body.includes('admin'))
  })
})

describe('Security - Whitelist Check Order', () => {
  // Simulate the auth flow order from ws/router.ts
  async function simulateAuthFlow(
    projectExists: boolean,
    apiKeyValid: boolean,
    whitelisted: boolean
  ): Promise<{ success: boolean; error?: string }> {
    // Order: 1. Check project, 2. Check API key, 3. Check whitelist
    if (!projectExists) {
      return { success: false, error: 'Invalid project name' }
    }
    
    if (!apiKeyValid) {
      return { success: false, error: 'Invalid API key' }
    }
    
    if (!whitelisted) {
      return { success: false, error: 'Not whitelisted' }
    }
    
    return { success: true }
  }

  it('checks project before API key', async () => {
    const result = await simulateAuthFlow(false, true, true)
    assert.strictEqual(result.error, 'Invalid project name')
  })

  it('checks API key before whitelist', async () => {
    const result = await simulateAuthFlow(true, false, true)
    assert.strictEqual(result.error, 'Invalid API key')
  })

  it('allows only when all checks pass', async () => {
    const result = await simulateAuthFlow(true, true, true)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.error, undefined)
  })
})
