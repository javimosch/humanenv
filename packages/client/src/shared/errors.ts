export enum ErrorCode {
  SERVER_PK_NOT_AVAILABLE = 'SERVER_PK_NOT_AVAILABLE',
  CLIENT_AUTH_INVALID_PROJECT_NAME = 'CLIENT_AUTH_INVALID_PROJECT_NAME',
  CLIENT_AUTH_NOT_WHITELISTED = 'CLIENT_AUTH_NOT_WHITELISTED',
  CLIENT_AUTH_INVALID_API_KEY = 'CLIENT_AUTH_INVALID_API_KEY',
  CLIENT_CONN_MAX_RETRIES_EXCEEDED = 'CLIENT_CONN_MAX_RETRIES_EXCEEDED',
  ENV_API_MODE_ONLY = 'ENV_API_MODE_ONLY',
  SERVER_INTERNAL_ERROR = 'SERVER_INTERNAL_ERROR',
  WS_CONNECTION_FAILED = 'WS_CONNECTION_FAILED',
  DB_OPERATION_FAILED = 'DB_OPERATION_FAILED',
}

export const ErrorMessages: Record<ErrorCode, string> = {
  SERVER_PK_NOT_AVAILABLE: 'Server private key is not available. Restart pending.',
  CLIENT_AUTH_INVALID_PROJECT_NAME: 'Invalid or unknown project name.',
  CLIENT_AUTH_NOT_WHITELISTED: 'Client fingerprint is not whitelisted for this project.',
  CLIENT_AUTH_INVALID_API_KEY: 'Invalid or expired API key.',
  CLIENT_CONN_MAX_RETRIES_EXCEEDED: 'Maximum WS connection retries exceeded.',
  ENV_API_MODE_ONLY: 'This env is API-mode only and cannot be accessed via CLI.',
  SERVER_INTERNAL_ERROR: 'An internal server error occurred.',
  WS_CONNECTION_FAILED: 'Failed to establish WebSocket connection.',
  DB_OPERATION_FAILED: 'Database operation failed.',
}

export class HumanEnvError extends Error {
  public readonly code: ErrorCode
  constructor(code: ErrorCode, message?: string) {
    super(message ?? ErrorMessages[code])
    this.name = 'HumanEnvError'
    this.code = code
  }
}
