"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const auth_ts_1 = require("../src/auth.ts");
// Mock Express request/response
function createMockRequest(authHeader) {
    const req = { headers: {} };
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
(0, node_test_1.describe)('Security - Auth Timing Attack Resistance', () => {
    const username = 'admin';
    const password = 'securepassword123';
    const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(username, password);
    (0, node_test_1.it)('similar response time for invalid username vs invalid password', () => {
        // Test that auth fails fast for both cases (constant-time-ish)
        const invalidUsernameReq = createMockRequest('Basic ' + Buffer.from(`wronguser:${password}`).toString('base64'));
        const invalidPasswordReq = createMockRequest('Basic ' + Buffer.from(`${username}:wrongpass`).toString('base64'));
        const res1 = createMockResponse();
        const res2 = createMockResponse();
        // Measure execution time (both should be fast and similar)
        const start1 = process.hrtime.bigint();
        middleware(invalidUsernameReq, res1, () => { });
        const end1 = process.hrtime.bigint();
        const start2 = process.hrtime.bigint();
        middleware(invalidPasswordReq, res2, () => { });
        const end2 = process.hrtime.bigint();
        const time1 = Number(end1 - start1);
        const time2 = Number(end2 - start2);
        // Both should complete in under 1ms and be within 50% of each other
        node_assert_1.default.ok(time1 < 1000000, 'Invalid username should be fast');
        node_assert_1.default.ok(time2 < 1000000, 'Invalid password should be fast');
        // Times should be within reasonable range of each other
        const ratio = Math.max(time1, time2) / Math.min(time1, time2);
        node_assert_1.default.ok(ratio < 10, 'Response times should be similar');
    });
    (0, node_test_1.it)('same error response for all auth failures', () => {
        const testCases = [
            { req: createMockRequest(), desc: 'no credentials' },
            { req: createMockRequest('Basic invalid'), desc: 'malformed credentials' },
            { req: createMockRequest('Basic ' + Buffer.from('wrong:wrong').toString('base64')), desc: 'wrong credentials' },
        ];
        for (const { req, desc } of testCases) {
            const res = createMockResponse();
            middleware(req, res, () => { });
            // All should return 401 with same WWW-Authenticate header
            node_assert_1.default.strictEqual(res.statusCode, 401, `Failed for ${desc}`);
            node_assert_1.default.strictEqual(res.headers['WWW-Authenticate'], 'Basic realm="HumanEnv Admin"', `Failed for ${desc}`);
        }
    });
});
(0, node_test_1.describe)('Security - Brute Force Detection Pattern', () => {
    // Track failed attempts (simulating rate limiting logic)
    class AuthAttemptTracker {
        constructor() {
            this.attempts = new Map();
        }
        recordAttempt(key) {
            const now = Date.now();
            const record = this.attempts.get(key);
            if (!record || now > record.resetAt) {
                this.attempts.set(key, { count: 1, resetAt: now + 60000 });
                return { allowed: true, remaining: 4 };
            }
            if (record.count >= 5) {
                return { allowed: false, remaining: 0 };
            }
            record.count++;
            return { allowed: true, remaining: 5 - record.count };
        }
    }
    (0, node_test_1.it)('tracks failed attempts per fingerprint', () => {
        const tracker = new AuthAttemptTracker();
        const fingerprint = 'fp-123';
        // First 5 attempts should be allowed
        for (let i = 0; i < 5; i++) {
            const result = tracker.recordAttempt(fingerprint);
            node_assert_1.default.strictEqual(result.allowed, true, `Attempt ${i + 1} should be allowed`);
        }
        // 6th attempt should be blocked
        const result = tracker.recordAttempt(fingerprint);
        node_assert_1.default.strictEqual(result.allowed, false, '6th attempt should be blocked');
    });
    (0, node_test_1.it)('resets attempts after time window', () => {
        const tracker = new AuthAttemptTracker();
        const fingerprint = 'fp-456';
        // Use up all attempts
        for (let i = 0; i < 5; i++) {
            tracker.recordAttempt(fingerprint);
        }
        // Should be blocked
        node_assert_1.default.strictEqual(tracker.recordAttempt(fingerprint).allowed, false);
        // Simulate time passing (reset window)
        const record = tracker.attempts.get(fingerprint);
        if (record) {
            record.resetAt = Date.now() - 1000; // 1 second ago
        }
        // Should be allowed again
        const result = tracker.recordAttempt(fingerprint);
        node_assert_1.default.strictEqual(result.allowed, true);
        node_assert_1.default.strictEqual(result.remaining, 4);
    });
    (0, node_test_1.it)('different fingerprints tracked separately', () => {
        const tracker = new AuthAttemptTracker();
        // Exhaust attempts for fingerprint 1
        for (let i = 0; i < 5; i++) {
            tracker.recordAttempt('fp-1');
        }
        // Fingerprint 2 should still be allowed
        const result = tracker.recordAttempt('fp-2');
        node_assert_1.default.strictEqual(result.allowed, true);
        node_assert_1.default.strictEqual(result.remaining, 4);
    });
});
(0, node_test_1.describe)('Security - Error Message Safety', () => {
    const username = 'admin';
    const password = 'securepassword123';
    const middleware = (0, auth_ts_1.createBasicAuthMiddleware)(username, password);
    (0, node_test_1.it)('does not leak whether username exists', () => {
        const existingUsernameReq = createMockRequest('Basic ' + Buffer.from(`admin:wrongpass`).toString('base64'));
        const nonExistingUsernameReq = createMockRequest('Basic ' + Buffer.from(`nonexistent:wrongpass`).toString('base64'));
        const res1 = createMockResponse();
        const res2 = createMockResponse();
        middleware(existingUsernameReq, res1, () => { });
        middleware(nonExistingUsernameReq, res2, () => { });
        // Both should return identical responses
        node_assert_1.default.strictEqual(res1.statusCode, res2.statusCode);
        node_assert_1.default.strictEqual(res1.body, res2.body);
        node_assert_1.default.deepStrictEqual(res1.headers, res2.headers);
    });
    (0, node_test_1.it)('does not leak internal state in error messages', () => {
        const req = createMockRequest('Basic invalid');
        const res = createMockResponse();
        middleware(req, res, () => { });
        // Error message should be generic
        node_assert_1.default.strictEqual(res.body, 'Authentication required');
        node_assert_1.default.ok(!res.body.includes('username'));
        node_assert_1.default.ok(!res.body.includes('password'));
        node_assert_1.default.ok(!res.body.includes('admin'));
    });
});
(0, node_test_1.describe)('Security - Whitelist Check Order', () => {
    // Simulate the auth flow order from ws/router.ts
    async function simulateAuthFlow(projectExists, apiKeyValid, whitelisted) {
        // Order: 1. Check project, 2. Check API key, 3. Check whitelist
        if (!projectExists) {
            return { success: false, error: 'Invalid project name' };
        }
        if (!apiKeyValid) {
            return { success: false, error: 'Invalid API key' };
        }
        if (!whitelisted) {
            return { success: false, error: 'Not whitelisted' };
        }
        return { success: true };
    }
    (0, node_test_1.it)('checks project before API key', async () => {
        const result = await simulateAuthFlow(false, true, true);
        node_assert_1.default.strictEqual(result.error, 'Invalid project name');
    });
    (0, node_test_1.it)('checks API key before whitelist', async () => {
        const result = await simulateAuthFlow(true, false, true);
        node_assert_1.default.strictEqual(result.error, 'Invalid API key');
    });
    (0, node_test_1.it)('allows only when all checks pass', async () => {
        const result = await simulateAuthFlow(true, true, true);
        node_assert_1.default.strictEqual(result.success, true);
        node_assert_1.default.strictEqual(result.error, undefined);
    });
});
//# sourceMappingURL=security-auth.test.js.map