import express from 'express'
import basicAuth from 'basic-auth'

export function createBasicAuthMiddleware(username: string, password: string): express.RequestHandler {
  return (req, res, next) => {
    const credentials = basicAuth(req)
    if (!credentials || credentials.name !== username || credentials.pass !== password) {
      res.set('WWW-Authenticate', 'Basic realm="HumanEnv Admin"')
      return res.status(401).send('Authentication required')
    }
    next()
  }
}
