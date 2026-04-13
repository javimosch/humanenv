export declare enum ErrorCode {
    SERVER_PK_NOT_AVAILABLE = "SERVER_PK_NOT_AVAILABLE",
    CLIENT_AUTH_INVALID_PROJECT_NAME = "CLIENT_AUTH_INVALID_PROJECT_NAME",
    CLIENT_AUTH_NOT_WHITELISTED = "CLIENT_AUTH_NOT_WHITELISTED",
    CLIENT_AUTH_INVALID_API_KEY = "CLIENT_AUTH_INVALID_API_KEY",
    CLIENT_CONN_MAX_RETRIES_EXCEEDED = "CLIENT_CONN_MAX_RETRIES_EXCEEDED",
    SERVER_INTERNAL_ERROR = "SERVER_INTERNAL_ERROR",
    WS_CONNECTION_FAILED = "WS_CONNECTION_FAILED",
    DB_OPERATION_FAILED = "DB_OPERATION_FAILED"
}
export declare const ErrorMessages: Record<ErrorCode, string>;
export declare class HumanEnvError extends Error {
    readonly code: ErrorCode;
    constructor(code: ErrorCode, message?: string);
}
//# sourceMappingURL=errors.d.ts.map