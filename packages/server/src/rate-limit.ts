export interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

interface AttemptRecord {
  count: number
  windowStart: number
}

export class RateLimiter {
  private attempts = new Map<string, AttemptRecord>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor(private config: RateLimitConfig) {
    this.cleanupInterval = setInterval(() => this.cleanup(), config.windowMs * 2)
  }

  check(key: string): RateLimitResult {
    const now = Date.now()
    const record = this.attempts.get(key)

    if (!record || now - record.windowStart > this.config.windowMs) {
      this.attempts.set(key, { count: 1, windowStart: now })
      return { allowed: true, remaining: this.config.maxAttempts - 1, retryAfterMs: 0 }
    }

    if (record.count >= this.config.maxAttempts) {
      const retryAfterMs = this.config.windowMs - (now - record.windowStart)
      return { allowed: false, remaining: 0, retryAfterMs }
    }

    record.count++
    return { allowed: true, remaining: this.config.maxAttempts - record.count, retryAfterMs: 0 }
  }

  reset(key: string): void {
    this.attempts.delete(key)
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.attempts.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.attempts) {
      if (now - record.windowStart > this.config.windowMs) {
        this.attempts.delete(key)
      }
    }
  }
}

export const BASIC_AUTH_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 60_000,
}

export const WS_AUTH_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 60_000,
}
