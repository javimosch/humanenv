import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ErrorCode, ErrorMessages, HumanEnvError } from '../src/index.ts'

describe('ErrorCode enum', () => {
  it('contains all expected error codes', () => {
    assert.ok(ErrorCode.SERVER_PK_NOT_AVAILABLE)
    assert.ok(ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME)
    assert.ok(ErrorCode.CLIENT_AUTH_NOT_WHITELISTED)
    assert.ok(ErrorCode.CLIENT_AUTH_INVALID_API_KEY)
    assert.ok(ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED)
    assert.ok(ErrorCode.ENV_API_MODE_ONLY)
    assert.ok(ErrorCode.SERVER_INTERNAL_ERROR)
    assert.ok(ErrorCode.WS_CONNECTION_FAILED)
    assert.ok(ErrorCode.DB_OPERATION_FAILED)
  })

  it('error codes are unique string values', () => {
    const codes = Object.values(ErrorCode)
    const uniqueCodes = new Set(codes)
    assert.strictEqual(codes.length, uniqueCodes.size)
  })
})

describe('ErrorMessages', () => {
  it('has message for every ErrorCode', () => {
    const codes = Object.values(ErrorCode)
    for (const code of codes) {
      assert.ok(ErrorMessages[code as ErrorCode])
      assert.ok(typeof ErrorMessages[code as ErrorCode] === 'string')
    }
  })

  it('messages are non-empty strings', () => {
    const messages = Object.values(ErrorMessages)
    for (const message of messages) {
      assert.ok(message.length > 0)
      assert.ok(typeof message === 'string')
    }
  })

  it('SERVER_PK_NOT_AVAILABLE message is correct', () => {
    assert.strictEqual(
      ErrorMessages[ErrorCode.SERVER_PK_NOT_AVAILABLE],
      'Server private key is not available. Restart pending.'
    )
  })

  it('CLIENT_AUTH_INVALID_API_KEY message is correct', () => {
    assert.strictEqual(
      ErrorMessages[ErrorCode.CLIENT_AUTH_INVALID_API_KEY],
      'Invalid or expired API key.'
    )
  })
})

describe('HumanEnvError', () => {
  it('creates error with code and default message', () => {
    const err = new HumanEnvError(ErrorCode.SERVER_PK_NOT_AVAILABLE)
    assert.strictEqual(err.name, 'HumanEnvError')
    assert.strictEqual(err.code, ErrorCode.SERVER_PK_NOT_AVAILABLE)
    assert.strictEqual(err.message, ErrorMessages[ErrorCode.SERVER_PK_NOT_AVAILABLE])
  })

  it('creates error with custom message', () => {
    const customMsg = 'Custom error message'
    const err = new HumanEnvError(ErrorCode.SERVER_INTERNAL_ERROR, customMsg)
    assert.strictEqual(err.message, customMsg)
  })

  it('extends Error class', () => {
    const err = new HumanEnvError(ErrorCode.CLIENT_AUTH_NOT_WHITELISTED)
    assert.ok(err instanceof Error)
    assert.ok(err instanceof HumanEnvError)
  })

  it('includes stack trace', () => {
    const err = new HumanEnvError(ErrorCode.DB_OPERATION_FAILED)
    assert.ok(err.stack)
    assert.ok(err.stack!.includes('HumanEnvError'))
  })
})
