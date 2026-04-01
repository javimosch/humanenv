import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createBasicAuthMiddleware } from '../src/auth.ts'

// Mock Express request/response objects
function createMockRequest(authHeader?: string) {
  const req: any = {
    headers: {},
  }
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

describe('createBasicAuthMiddleware', () => {
  const testUsername = 'testuser'
  const testPassword = 'testpass123'

  it('calls next() with valid credentials', () => {
    const middleware = createBasicAuthMiddleware(testUsername, testPassword)
    const req = createMockRequest(
      'Basic ' + Buffer.from(`${testUsername}:${testPassword}`).toString('base64')
    )
    const res = createMockResponse()
    let nextCalled = false
    
    middleware(req, res, () => {
      nextCalled = true
    })
    
    assert.strictEqual(nextCalled, true)
    assert.strictEqual(res.statusCode, 200)
  })

  it('returns 401 with missing credentials', () => {
    const middleware = createBasicAuthMiddleware(testUsername, testPassword)
    const req = createMockRequest() // No auth header
    const res = createMockResponse()
    let nextCalled = false
    
    middleware(req, res, () => {
      nextCalled = true
    })
    
    assert.strictEqual(nextCalled, false)
    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.headers['WWW-Authenticate'], 'Basic realm="HumanEnv Admin"')
    assert.strictEqual(res.body, 'Authentication required')
  })

  it('returns 401 with invalid username', () => {
    const middleware = createBasicAuthMiddleware(testUsername, testPassword)
    const req = createMockRequest(
      'Basic ' + Buffer.from(`wronguser:${testPassword}`).toString('base64')
    )
    const res = createMockResponse()
    let nextCalled = false
    
    middleware(req, res, () => {
      nextCalled = true
    })
    
    assert.strictEqual(nextCalled, false)
    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.headers['WWW-Authenticate'], 'Basic realm="HumanEnv Admin"')
  })

  it('returns 401 with invalid password', () => {
    const middleware = createBasicAuthMiddleware(testUsername, testPassword)
    const req = createMockRequest(
      'Basic ' + Buffer.from(`${testUsername}:wrongpass`).toString('base64')
    )
    const res = createMockResponse()
    let nextCalled = false
    
    middleware(req, res, () => {
      nextCalled = true
    })
    
    assert.strictEqual(nextCalled, false)
    assert.strictEqual(res.statusCode, 401)
    assert.strictEqual(res.headers['WWW-Authenticate'], 'Basic realm="HumanEnv Admin"')
  })

  it('returns 401 with malformed auth header', () => {
    const middleware = createBasicAuthMiddleware(testUsername, testPassword)
    const req = createMockRequest('InvalidFormat')
    const res = createMockResponse()
    let nextCalled = false
    
    middleware(req, res, () => {
      nextCalled = true
    })
    
    assert.strictEqual(nextCalled, false)
    assert.strictEqual(res.statusCode, 401)
  })

  it('returns 401 with empty auth header', () => {
    const middleware = createBasicAuthMiddleware(testUsername, testPassword)
    const req = createMockRequest('Basic ')
    const res = createMockResponse()
    let nextCalled = false
    
    middleware(req, res, () => {
      nextCalled = true
    })
    
    assert.strictEqual(nextCalled, false)
    assert.strictEqual(res.statusCode, 401)
  })

  it('handles special characters in credentials', () => {
    const specialUser = 'user@domain.com'
    const specialPass = 'p@ss!w0rd#$%'
    const middleware = createBasicAuthMiddleware(specialUser, specialPass)
    const req = createMockRequest(
      'Basic ' + Buffer.from(`${specialUser}:${specialPass}`).toString('base64')
    )
    const res = createMockResponse()
    let nextCalled = false
    
    middleware(req, res, () => {
      nextCalled = true
    })
    
    assert.strictEqual(nextCalled, true)
  })

  it('handles unicode characters in credentials', () => {
    const unicodeUser = '用户'
    const unicodePass = '密码 123'
    const middleware = createBasicAuthMiddleware(unicodeUser, unicodePass)
    const req = createMockRequest(
      'Basic ' + Buffer.from(`${unicodeUser}:${unicodePass}`).toString('base64')
    )
    const res = createMockResponse()
    let nextCalled = false
    
    middleware(req, res, () => {
      nextCalled = true
    })
    
    assert.strictEqual(nextCalled, true)
  })
})
