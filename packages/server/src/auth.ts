import express from 'express'
import basicAuth from 'basic-auth'
import { RateLimiter, BASIC_AUTH_RATE_LIMIT } from './rate-limit'

const defaultLimiter = new RateLimiter(BASIC_AUTH_RATE_LIMIT)

export function createBasicAuthMiddleware(
  username: string,
  password: string,
  limiter: RateLimiter = defaultLimiter
): express.RequestHandler {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const result = limiter.check(ip)

    if (!result.allowed) {
      res.set('WWW-Authenticate', 'Basic realm="HumanEnv Admin"')
      res.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)))
      return res.status(429).send('Too many authentication attempts')
    }

    const credentials = basicAuth(req)
    if (!credentials || credentials.name !== username || credentials.pass !== password) {
      res.set('WWW-Authenticate', 'Basic realm="HumanEnv Admin"')
      return res.status(401).send('Authentication required')
    }
    next()
  }
}
