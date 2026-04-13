"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const index_ts_1 = require("../src/index.ts");
(0, node_test_1.describe)('ErrorCode enum', () => {
    (0, node_test_1.it)('contains all expected error codes', () => {
        node_assert_1.default.ok(index_ts_1.ErrorCode.SERVER_PK_NOT_AVAILABLE);
        node_assert_1.default.ok(index_ts_1.ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME);
        node_assert_1.default.ok(index_ts_1.ErrorCode.CLIENT_AUTH_NOT_WHITELISTED);
        node_assert_1.default.ok(index_ts_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
        node_assert_1.default.ok(index_ts_1.ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED);
        node_assert_1.default.ok(index_ts_1.ErrorCode.ENV_API_MODE_ONLY);
        node_assert_1.default.ok(index_ts_1.ErrorCode.SERVER_INTERNAL_ERROR);
        node_assert_1.default.ok(index_ts_1.ErrorCode.WS_CONNECTION_FAILED);
        node_assert_1.default.ok(index_ts_1.ErrorCode.DB_OPERATION_FAILED);
    });
    (0, node_test_1.it)('error codes are unique string values', () => {
        const codes = Object.values(index_ts_1.ErrorCode);
        const uniqueCodes = new Set(codes);
        node_assert_1.default.strictEqual(codes.length, uniqueCodes.size);
    });
});
(0, node_test_1.describe)('ErrorMessages', () => {
    (0, node_test_1.it)('has message for every ErrorCode', () => {
        const codes = Object.values(index_ts_1.ErrorCode);
        for (const code of codes) {
            node_assert_1.default.ok(index_ts_1.ErrorMessages[code]);
            node_assert_1.default.ok(typeof index_ts_1.ErrorMessages[code] === 'string');
        }
    });
    (0, node_test_1.it)('messages are non-empty strings', () => {
        const messages = Object.values(index_ts_1.ErrorMessages);
        for (const message of messages) {
            node_assert_1.default.ok(message.length > 0);
            node_assert_1.default.ok(typeof message === 'string');
        }
    });
    (0, node_test_1.it)('SERVER_PK_NOT_AVAILABLE message is correct', () => {
        node_assert_1.default.strictEqual(index_ts_1.ErrorMessages[index_ts_1.ErrorCode.SERVER_PK_NOT_AVAILABLE], 'Server private key is not available. Restart pending.');
    });
    (0, node_test_1.it)('CLIENT_AUTH_INVALID_API_KEY message is correct', () => {
        node_assert_1.default.strictEqual(index_ts_1.ErrorMessages[index_ts_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY], 'Invalid or expired API key.');
    });
});
(0, node_test_1.describe)('HumanEnvError', () => {
    (0, node_test_1.it)('creates error with code and default message', () => {
        const err = new index_ts_1.HumanEnvError(index_ts_1.ErrorCode.SERVER_PK_NOT_AVAILABLE);
        node_assert_1.default.strictEqual(err.name, 'HumanEnvError');
        node_assert_1.default.strictEqual(err.code, index_ts_1.ErrorCode.SERVER_PK_NOT_AVAILABLE);
        node_assert_1.default.strictEqual(err.message, index_ts_1.ErrorMessages[index_ts_1.ErrorCode.SERVER_PK_NOT_AVAILABLE]);
    });
    (0, node_test_1.it)('creates error with custom message', () => {
        const customMsg = 'Custom error message';
        const err = new index_ts_1.HumanEnvError(index_ts_1.ErrorCode.SERVER_INTERNAL_ERROR, customMsg);
        node_assert_1.default.strictEqual(err.message, customMsg);
    });
    (0, node_test_1.it)('extends Error class', () => {
        const err = new index_ts_1.HumanEnvError(index_ts_1.ErrorCode.CLIENT_AUTH_NOT_WHITELISTED);
        node_assert_1.default.ok(err instanceof Error);
        node_assert_1.default.ok(err instanceof index_ts_1.HumanEnvError);
    });
    (0, node_test_1.it)('includes stack trace', () => {
        const err = new index_ts_1.HumanEnvError(index_ts_1.ErrorCode.DB_OPERATION_FAILED);
        node_assert_1.default.ok(err.stack);
        node_assert_1.default.ok(err.stack.includes('HumanEnvError'));
    });
});
//# sourceMappingURL=errors.test.js.map