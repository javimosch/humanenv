"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const auth_ts_1 = require("../src/auth.ts");
// Mock Express request/response objects
function createMockRequest(authHeader) {
    const req = {
        headers: {},
    };
    if (authHeader) {
        req.headers.authorization = authHeader;
    }
    return req;
}
function createMockResponse() {
    const res = {
        statusCode: 200,
        headers: {},
        body: '',
        set(header, value) {
            this.headers[header] = value;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        },
    };
    return res;
}
(0, node_test_1.describe)('createBasicAuthMiddleware', () => {
    const testUsername = 'testuser';
    const testPassword = 'testpass123';
    (0, node_test_1.it)('calls next() with valid credentials', () => {
        const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(testUsername, testPassword);
        const req = createMockRequest('Basic ' + Buffer.from(`${testUsername}:${testPassword}`).toString('base64'));
        const res = createMockResponse();
        let nextCalled = false;
        middleware(req, res, () => {
            nextCalled = true;
        });
        node_assert_1.default.strictEqual(nextCalled, true);
        node_assert_1.default.strictEqual(res.statusCode, 200);
    });
    (0, node_test_1.it)('returns 401 with missing credentials', () => {
        const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(testUsername, testPassword);
        const req = createMockRequest(); // No auth header
        const res = createMockResponse();
        let nextCalled = false;
        middleware(req, res, () => {
            nextCalled = true;
        });
        node_assert_1.default.strictEqual(nextCalled, false);
        node_assert_1.default.strictEqual(res.statusCode, 401);
        node_assert_1.default.strictEqual(res.headers['WWW-Authenticate'], 'Basic realm="HumanEnv Admin"');
        node_assert_1.default.strictEqual(res.body, 'Authentication required');
    });
    (0, node_test_1.it)('returns 401 with invalid username', () => {
        const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(testUsername, testPassword);
        const req = createMockRequest('Basic ' + Buffer.from(`wronguser:${testPassword}`).toString('base64'));
        const res = createMockResponse();
        let nextCalled = false;
        middleware(req, res, () => {
            nextCalled = true;
        });
        node_assert_1.default.strictEqual(nextCalled, false);
        node_assert_1.default.strictEqual(res.statusCode, 401);
        node_assert_1.default.strictEqual(res.headers['WWW-Authenticate'], 'Basic realm="HumanEnv Admin"');
    });
    (0, node_test_1.it)('returns 401 with invalid password', () => {
        const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(testUsername, testPassword);
        const req = createMockRequest('Basic ' + Buffer.from(`${testUsername}:wrongpass`).toString('base64'));
        const res = createMockResponse();
        let nextCalled = false;
        middleware(req, res, () => {
            nextCalled = true;
        });
        node_assert_1.default.strictEqual(nextCalled, false);
        node_assert_1.default.strictEqual(res.statusCode, 401);
        node_assert_1.default.strictEqual(res.headers['WWW-Authenticate'], 'Basic realm="HumanEnv Admin"');
    });
    (0, node_test_1.it)('returns 401 with malformed auth header', () => {
        const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(testUsername, testPassword);
        const req = createMockRequest('InvalidFormat');
        const res = createMockResponse();
        let nextCalled = false;
        middleware(req, res, () => {
            nextCalled = true;
        });
        node_assert_1.default.strictEqual(nextCalled, false);
        node_assert_1.default.strictEqual(res.statusCode, 401);
    });
    (0, node_test_1.it)('returns 401 with empty auth header', () => {
        const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(testUsername, testPassword);
        const req = createMockRequest('Basic ');
        const res = createMockResponse();
        let nextCalled = false;
        middleware(req, res, () => {
            nextCalled = true;
        });
        node_assert_1.default.strictEqual(nextCalled, false);
        node_assert_1.default.strictEqual(res.statusCode, 401);
    });
    (0, node_test_1.it)('handles special characters in credentials', () => {
        const specialUser = 'user@domain.com';
        const specialPass = 'p@ss!w0rd#$%';
        const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(specialUser, specialPass);
        const req = createMockRequest('Basic ' + Buffer.from(`${specialUser}:${specialPass}`).toString('base64'));
        const res = createMockResponse();
        let nextCalled = false;
        middleware(req, res, () => {
            nextCalled = true;
        });
        node_assert_1.default.strictEqual(nextCalled, true);
    });
    (0, node_test_1.it)('handles unicode characters in credentials', () => {
        const unicodeUser = '用户';
        const unicodePass = '密码 123';
        const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(unicodeUser, unicodePass);
        const req = createMockRequest('Basic ' + Buffer.from(`${unicodeUser}:${unicodePass}`).toString('base64'));
        const res = createMockResponse();
        let nextCalled = false;
        middleware(req, res, () => {
            nextCalled = true;
        });
        node_assert_1.default.strictEqual(nextCalled, true);
    });
});
//# sourceMappingURL=auth-middleware.test.js.map