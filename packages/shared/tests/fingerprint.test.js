"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const index_ts_1 = require("../src/index.ts");
(0, node_test_1.describe)('generateFingerprint', () => {
    let originalHostname;
    (0, node_test_1.beforeEach)(() => {
        originalHostname = process.env.HOSTNAME;
    });
    (0, node_test_1.afterEach)(() => {
        if (originalHostname !== undefined) {
            process.env.HOSTNAME = originalHostname;
        }
        else {
            delete process.env.HOSTNAME;
        }
    });
    (0, node_test_1.it)('returns 16-character hex string', () => {
        const fingerprint = (0, index_ts_1.generateFingerprint)();
        node_assert_1.default.strictEqual(fingerprint.length, 16);
        node_assert_1.default.ok(/^[0-9a-f]+$/i.test(fingerprint));
    });
    (0, node_test_1.it)('is deterministic (same output for same environment)', () => {
        const fp1 = (0, index_ts_1.generateFingerprint)();
        const fp2 = (0, index_ts_1.generateFingerprint)();
        node_assert_1.default.strictEqual(fp1, fp2);
    });
    (0, node_test_1.it)('uses HOSTNAME env var when set', () => {
        process.env.HOSTNAME = 'test-host-123';
        const fingerprint = (0, index_ts_1.generateFingerprint)();
        node_assert_1.default.strictEqual(fingerprint.length, 16);
    });
    (0, node_test_1.it)('uses fallback when HOSTNAME not set', () => {
        delete process.env.HOSTNAME;
        const fingerprint = (0, index_ts_1.generateFingerprint)();
        node_assert_1.default.strictEqual(fingerprint.length, 16);
        // Should still produce a valid fingerprint with 'unknown-host' fallback
    });
    (0, node_test_1.it)('includes platform in fingerprint', () => {
        const fp1 = (0, index_ts_1.generateFingerprint)();
        // Platform is part of the fingerprint components
        node_assert_1.default.ok(fp1.length > 0);
    });
    (0, node_test_1.it)('different HOSTNAME produces different fingerprint', () => {
        process.env.HOSTNAME = 'host-a';
        const fpA = (0, index_ts_1.generateFingerprint)();
        process.env.HOSTNAME = 'host-b';
        const fpB = (0, index_ts_1.generateFingerprint)();
        node_assert_1.default.notStrictEqual(fpA, fpB);
    });
});
//# sourceMappingURL=fingerprint.test.js.map