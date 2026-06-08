import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { RateLimiter, BASIC_AUTH_RATE_LIMIT, WS_AUTH_RATE_LIMIT } from '../src/rate-limit.ts'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ maxAttempts: 3, windowMs: 1000 })
  })

  afterEach(() => {
    limiter.destroy()
  })

  it('allows first attempt', () => {
    const result = limiter.check('ip-1')
    assert.strictEqual(result.allowed, true)
    assert.strictEqual(result.remaining, 2)
  })

  it('tracks attempts within window', () => {
    limiter.check('ip-1')
    limiter.check('ip-1')
    const result = limiter.check('ip-1')
    assert.strictEqual(result.allowed, true)
    assert.strictEqual(result.remaining, 0)
  })

  it('blocks after max attempts', () => {
    limiter.check('ip-1')
    limiter.check('ip-1')
    limiter.check('ip-1')
    const result = limiter.check('ip-1')
    assert.strictEqual(result.allowed, false)
    assert.strictEqual(result.remaining, 0)
    assert.ok(result.retryAfterMs > 0)
  })

  it('tracks different keys separately', () => {
    limiter.check('ip-1')
    limiter.check('ip-1')
    limiter.check('ip-1')
    limiter.check('ip-1')

    const result1 = limiter.check('ip-1')
    assert.strictEqual(result1.allowed, false)

    const result2 = limiter.check('ip-2')
    assert.strictEqual(result2.allowed, true)
    assert.strictEqual(result2.remaining, 2)
  })

  it('resets after window expires', () => {
    const shortLimiter = new RateLimiter({ maxAttempts: 2, windowMs: 50 })
    try {
      shortLimiter.check('ip-1')
      shortLimiter.check('ip-1')
      assert.strictEqual(shortLimiter.check('ip-1').allowed, false)

      // Wait for window to expire
      const start = Date.now()
      while (Date.now() - start < 60) {}

      const result = shortLimiter.check('ip-1')
      assert.strictEqual(result.allowed, true)
      assert.strictEqual(result.remaining, 1)
    } finally {
      shortLimiter.destroy()
    }
  })

  it('resets key on explicit reset', () => {
    limiter.check('ip-1')
    limiter.check('ip-1')
    limiter.check('ip-1')
    assert.strictEqual(limiter.check('ip-1').allowed, false)

    limiter.reset('ip-1')
    const result = limiter.check('ip-1')
    assert.strictEqual(result.allowed, true)
    assert.strictEqual(result.remaining, 2)
  })

  it('cleanup removes expired entries', () => {
    const cleanupLimiter = new RateLimiter({ maxAttempts: 2, windowMs: 50 })
    try {
      cleanupLimiter.check('ip-1')
      cleanupLimiter.check('ip-1')
      assert.strictEqual(cleanupLimiter.check('ip-1').allowed, false)

      // Wait for cleanup interval (windowMs * 2 = 100ms)
      const start = Date.now()
      while (Date.now() - start < 120) {}

      // After cleanup, should be allowed again
      const result = cleanupLimiter.check('ip-1')
      assert.strictEqual(result.allowed, true)
    } finally {
      cleanupLimiter.destroy()
    }
  })

  it('destroy stops cleanup interval', () => {
    const destroyLimiter = new RateLimiter({ maxAttempts: 2, windowMs: 50 })
    destroyLimiter.destroy()
    // Should not throw
    assert.ok(true)
  })
})

describe('BASIC_AUTH_RATE_LIMIT config', () => {
  it('has reasonable defaults', () => {
    assert.strictEqual(BASIC_AUTH_RATE_LIMIT.maxAttempts, 5)
    assert.strictEqual(BASIC_AUTH_RATE_LIMIT.windowMs, 60_000)
  })
})

describe('WS_AUTH_RATE_LIMIT config', () => {
  it('has reasonable defaults', () => {
    assert.strictEqual(WS_AUTH_RATE_LIMIT.maxAttempts, 10)
    assert.strictEqual(WS_AUTH_RATE_LIMIT.windowMs, 60_000)
  })
})

describe('RateLimiter integration with basic auth middleware', () => {
  it('blocks after max failed attempts from same IP', async () => {
    const { createBasicAuthMiddleware } = await import('../src/auth.ts')
    const rateLimiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 })

    const middleware = createBasicAuthMiddleware('admin', 'password', rateLimiter)

    const createReq = (authHeader?: string) => ({
      headers: authHeader ? { authorization: authHeader } : {},
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' }
    })

    const createRes = () => {
      const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: '',
        set(header: string, value: string) { this.headers[header] = value; return this },
        status(code: number) { this.statusCode = code; return this },
        send(body: string) { this.body = body; return this },
      }
      return res
    }

    // First two attempts fail (wrong password)
    for (let i = 0; i < 2; i++) {
      const req = createReq('Basic ' + Buffer.from('admin:wrong').toString('base64'))
      const res = createRes()
      middleware(req, res, () => { throw new Error('should not call next') })
      assert.strictEqual(res.statusCode, 401)
    }

    // Third attempt is rate-limited (even with correct password)
    const req = createReq('Basic ' + Buffer.from('admin:password').toString('base64'))
    const res = createRes()
    middleware(req, res, () => { throw new Error('should not call next') })
    assert.strictEqual(res.statusCode, 429)
    assert.strictEqual(res.body, 'Too many authentication attempts')

    rateLimiter.destroy()
  })

  it('allows after rate limit expires', async () => {
    const { createBasicAuthMiddleware } = await import('../src/auth.ts')
    const rateLimiter = new RateLimiter({ maxAttempts: 2, windowMs: 50 })

    const middleware = createBasicAuthMiddleware('admin', 'password', rateLimiter)

    const createReq = (authHeader?: string) => ({
      headers: authHeader ? { authorization: authHeader } : {},
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' }
    })

    const createRes = () => {
      const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: '',
        set(header: string, value: string) { this.headers[header] = value; return this },
        status(code: number) { this.statusCode = code; return this },
        send(body: string) { this.body = body; return this },
      }
      return res
    }

    // Exhaust attempts
    for (let i = 0; i < 2; i++) {
      const req = createReq('Basic ' + Buffer.from('admin:wrong').toString('base64'))
      const res = createRes()
      middleware(req, res, () => { throw new Error('should not call next') })
    }

    // Wait for window to expire
    const start = Date.now()
    while (Date.now() - start < 60) {}

    // Should be allowed now
    let nextCalled = false
    const req = createReq('Basic ' + Buffer.from('admin:password').toString('base64'))
    const res = createRes()
    middleware(req, res, () => { nextCalled = true })
    assert.strictEqual(nextCalled, true)

    rateLimiter.destroy()
  })

  it('tracks different IPs separately', async () => {
    const { createBasicAuthMiddleware } = await import('../src/auth.ts')
    const rateLimiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 })

    const middleware = createBasicAuthMiddleware('admin', 'password', rateLimiter)

    const createReq = (authHeader: string, ip: string) => ({
      headers: { authorization: authHeader },
      ip,
      socket: { remoteAddress: ip }
    })

    const createRes = () => {
      const res: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: '',
        set(header: string, value: string) { this.headers[header] = value; return this },
        status(code: number) { this.statusCode = code; return this },
        send(body: string) { this.body = body; return this },
      }
      return res
    }

    const wrongAuth = 'Basic ' + Buffer.from('admin:wrong').toString('base64')
    const correctAuth = 'Basic ' + Buffer.from('admin:password').toString('base64')

    // IP1 fails once -> blocked
    const req1 = createReq(wrongAuth, '192.168.1.1')
    const res1 = createRes()
    middleware(req1, res1, () => { throw new Error('should not call next') })
    assert.strictEqual(res1.statusCode, 401)

    // IP1 again -> rate limited
    const req1b = createReq(correctAuth, '192.168.1.1')
    const res1b = createRes()
    middleware(req1b, res1b, () => { throw new Error('should not call next') })
    assert.strictEqual(res1b.statusCode, 429)

    // IP2 succeeds (different IP)
    let nextCalled = false
    const req2 = createReq(correctAuth, '192.168.1.2')
    const res2 = createRes()
    middleware(req2, res2, () => { nextCalled = true })
    assert.strictEqual(nextCalled, true)

    rateLimiter.destroy()
  })
})
