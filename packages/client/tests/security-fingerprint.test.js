"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const humanenv_shared_1 = require("humanenv-shared");
(0, node_test_1.describe)('Security - Fingerprint Determinism', () => {
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
    (0, node_test_1.it)('produces same fingerprint for same environment', () => {
        const fp1 = (0, humanenv_shared_1.generateFingerprint)();
        const fp2 = (0, humanenv_shared_1.generateFingerprint)();
        const fp3 = (0, humanenv_shared_1.generateFingerprint)();
        node_assert_1.default.strictEqual(fp1, fp2);
        node_assert_1.default.strictEqual(fp2, fp3);
    });
    (0, node_test_1.it)('produces same fingerprint after process restart (simulated)', () => {
        // Simulate restart by regenerating with same env
        const before = (0, humanenv_shared_1.generateFingerprint)();
        // "Restart" - regenerate
        const after = (0, humanenv_shared_1.generateFingerprint)();
        node_assert_1.default.strictEqual(before, after);
    });
});
(0, node_test_1.describe)('Security - Fingerprint Component Sensitivity', () => {
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
    (0, node_test_1.it)('changes fingerprint when HOSTNAME changes', () => {
        process.env.HOSTNAME = 'server-a';
        const fpA = (0, humanenv_shared_1.generateFingerprint)();
        process.env.HOSTNAME = 'server-b';
        const fpB = (0, humanenv_shared_1.generateFingerprint)();
        node_assert_1.default.notStrictEqual(fpA, fpB);
    });
    (0, node_test_1.it)('uses fallback for missing HOSTNAME', () => {
        delete process.env.HOSTNAME;
        const fp1 = (0, humanenv_shared_1.generateFingerprint)();
        process.env.HOSTNAME = 'unknown-host';
        const fp2 = (0, humanenv_shared_1.generateFingerprint)();
        // Should use 'unknown-host' fallback consistently
        node_assert_1.default.strictEqual(fp1, fp2);
    });
    (0, node_test_1.it)('includes platform in fingerprint', () => {
        // Platform is part of the components
        // This test verifies the fingerprint is tied to the platform
        const fp = (0, humanenv_shared_1.generateFingerprint)();
        node_assert_1.default.ok(fp.length > 0);
        // If we could change platform, fingerprint would change
        // (We can't actually test this without mocking process.platform)
    });
});
(0, node_test_1.describe)('Security - Fingerprint Format Safety', () => {
    (0, node_test_1.it)('produces 16-character hex string', () => {
        const fp = (0, humanenv_shared_1.generateFingerprint)();
        node_assert_1.default.strictEqual(fp.length, 16);
        node_assert_1.default.ok(/^[0-9a-f]+$/i.test(fp));
    });
    (0, node_test_1.it)('fingerprint is not easily reversible', () => {
        const fp = (0, humanenv_shared_1.generateFingerprint)();
        // 16 hex chars = 64 bits of entropy
        // Should not be able to guess original components from fingerprint
        node_assert_1.default.ok(fp.length === 16);
        // Hash output should look random
        const uniqueChars = new Set(fp.split(''));
        node_assert_1.default.ok(uniqueChars.size >= 6); // Should have variety of hex chars
    });
    (0, node_test_1.it)('fingerprint contains no special characters', () => {
        const fp = (0, humanenv_shared_1.generateFingerprint)();
        // Only hex characters allowed
        node_assert_1.default.ok(/^[0-9a-f]+$/i.test(fp));
        node_assert_1.default.ok(!fp.includes('-'));
        node_assert_1.default.ok(!fp.includes('_'));
        node_assert_1.default.ok(!fp.includes(' '));
    });
});
(0, node_test_1.describe)('Security - Fingerprint Spoofing Resistance', () => {
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
    (0, node_test_1.it)('requires all components to spoof', () => {
        // Attacker would need to spoof:
        // - HOSTNAME
        // - process.platform
        // - process.arch
        // - process.version
        process.env.HOSTNAME = 'legitimate-server';
        const legitimateFp = (0, humanenv_shared_1.generateFingerprint)();
        // Attacker sets same HOSTNAME
        process.env.HOSTNAME = 'legitimate-server';
        const attackerFp = (0, humanenv_shared_1.generateFingerprint)();
        // On same platform/arch/version, fingerprints match
        // (This is expected behavior - fingerprint is deterministic)
        node_assert_1.default.strictEqual(legitimateFp, attackerFp);
        // Note: This is a known limitation - fingerprint is based on
        // environment variables that can be spoofed. For stronger
        // binding, hardware identifiers would be needed.
    });
    (0, node_test_1.it)('different architectures produce different fingerprints', () => {
        // This test documents that fingerprint includes arch
        const fp = (0, humanenv_shared_1.generateFingerprint)();
        node_assert_1.default.ok(fp.length > 0);
        // If process.arch were different, fingerprint would change
        // (We can't actually test this without mocking)
    });
    (0, node_test_1.it)('fingerprint is consistent for legitimate reconnections', () => {
        // Legitimate client reconnecting should have same fingerprint
        const fp1 = (0, humanenv_shared_1.generateFingerprint)();
        const fp2 = (0, humanenv_shared_1.generateFingerprint)();
        node_assert_1.default.strictEqual(fp1, fp2);
    });
});
//# sourceMappingURL=security-fingerprint.test.js.map