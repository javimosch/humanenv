"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HumanEnvError = exports.ErrorMessages = exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["SERVER_PK_NOT_AVAILABLE"] = "SERVER_PK_NOT_AVAILABLE";
    ErrorCode["CLIENT_AUTH_INVALID_PROJECT_NAME"] = "CLIENT_AUTH_INVALID_PROJECT_NAME";
    ErrorCode["CLIENT_AUTH_NOT_WHITELISTED"] = "CLIENT_AUTH_NOT_WHITELISTED";
    ErrorCode["CLIENT_AUTH_INVALID_API_KEY"] = "CLIENT_AUTH_INVALID_API_KEY";
    ErrorCode["CLIENT_CONN_MAX_RETRIES_EXCEEDED"] = "CLIENT_CONN_MAX_RETRIES_EXCEEDED";
    ErrorCode["SERVER_INTERNAL_ERROR"] = "SERVER_INTERNAL_ERROR";
    ErrorCode["WS_CONNECTION_FAILED"] = "WS_CONNECTION_FAILED";
    ErrorCode["DB_OPERATION_FAILED"] = "DB_OPERATION_FAILED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
exports.ErrorMessages = {
    SERVER_PK_NOT_AVAILABLE: 'Server private key is not available. Restart pending.',
    CLIENT_AUTH_INVALID_PROJECT_NAME: 'Invalid or unknown project name.',
    CLIENT_AUTH_NOT_WHITELISTED: 'Client fingerprint is not whitelisted for this project.',
    CLIENT_AUTH_INVALID_API_KEY: 'Invalid or expired API key.',
    CLIENT_CONN_MAX_RETRIES_EXCEEDED: 'Maximum WS connection retries exceeded.',
    SERVER_INTERNAL_ERROR: 'An internal server error occurred.',
    WS_CONNECTION_FAILED: 'Failed to establish WebSocket connection.',
    DB_OPERATION_FAILED: 'Database operation failed.',
};
class HumanEnvError extends Error {
    constructor(code, message) {
        super(message ?? exports.ErrorMessages[code]);
        this.name = 'HumanEnvError';
        this.code = code;
    }
}
exports.HumanEnvError = HumanEnvError;
//# sourceMappingURL=errors.js.map