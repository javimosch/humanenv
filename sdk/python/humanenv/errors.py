from enum import Enum


class ErrorCode(Enum):
    SERVER_PK_NOT_AVAILABLE = "SERVER_PK_NOT_AVAILABLE"
    CLIENT_AUTH_INVALID_PROJECT_NAME = "CLIENT_AUTH_INVALID_PROJECT_NAME"
    CLIENT_AUTH_NOT_WHITELISTED = "CLIENT_AUTH_NOT_WHITELISTED"
    CLIENT_AUTH_INVALID_API_KEY = "CLIENT_AUTH_INVALID_API_KEY"
    CLIENT_CONN_MAX_RETRIES_EXCEEDED = "CLIENT_CONN_MAX_RETRIES_EXCEEDED"
    ENV_API_MODE_ONLY = "ENV_API_MODE_ONLY"
    SERVER_INTERNAL_ERROR = "SERVER_INTERNAL_ERROR"
    WS_CONNECTION_FAILED = "WS_CONNECTION_FAILED"
    DB_OPERATION_FAILED = "DB_OPERATION_FAILED"


ERROR_MESSAGES: dict[ErrorCode, str] = {
    ErrorCode.SERVER_PK_NOT_AVAILABLE: "Server private key is not available. Restart pending.",
    ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME: "Invalid or unknown project name.",
    ErrorCode.CLIENT_AUTH_NOT_WHITELISTED: "Client fingerprint is not whitelisted for this project.",
    ErrorCode.CLIENT_AUTH_INVALID_API_KEY: "Invalid or expired API key.",
    ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED: "Maximum WS connection retries exceeded.",
    ErrorCode.ENV_API_MODE_ONLY: "This env is API-mode only and cannot be accessed via CLI.",
    ErrorCode.SERVER_INTERNAL_ERROR: "An internal server error occurred.",
    ErrorCode.WS_CONNECTION_FAILED: "Failed to establish WebSocket connection.",
    ErrorCode.DB_OPERATION_FAILED: "Database operation failed.",
}


class HumanEnvError(Exception):
    def __init__(self, code: ErrorCode, message: str | None = None) -> None:
        self.code = code
        super().__init__(message or ERROR_MESSAGES[code])

    def __repr__(self) -> str:
        return f"HumanEnvError({self.code.value}, {super().__repr__()})"
