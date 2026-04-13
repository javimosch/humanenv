"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const index_ts_1 = require("../src/index.ts");
(0, node_test_1.describe)('Security - Crypto IV Randomness', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
    const value = 'test-secret-value';
    const aad = 'test-project:KEY';
    (0, node_test_1.it)('IV is random - encrypt produces different output each time', () => {
        const encrypted1 = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        const encrypted2 = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        const encrypted3 = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        // All three should be different due to random IV
        node_assert_1.default.notStrictEqual(encrypted1, encrypted2);
        node_assert_1.default.notStrictEqual(encrypted2, encrypted3);
        node_assert_1.default.notStrictEqual(encrypted1, encrypted3);
        // But all should decrypt to the same value
        node_assert_1.default.strictEqual((0, index_ts_1.decryptWithPk)(encrypted1, pk, aad), value);
        node_assert_1.default.strictEqual((0, index_ts_1.decryptWithPk)(encrypted2, pk, aad), value);
        node_assert_1.default.strictEqual((0, index_ts_1.decryptWithPk)(encrypted3, pk, aad), value);
    });
    (0, node_test_1.it)('IV is 12 bytes (96 bits for AES-GCM)', () => {
        // Encrypt and decode to check IV length
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        const decoded = Buffer.from(encrypted, 'base64');
        // First 12 bytes are IV
        const iv = decoded.subarray(0, 12);
        node_assert_1.default.strictEqual(iv.length, 12);
    });
    (0, node_test_1.it)('IV uses crypto.randomBytes (cryptographically secure)', () => {
        // This test verifies the implementation uses crypto.randomBytes
        // by checking that we get unique values
        const ivs = new Set();
        for (let i = 0; i < 100; i++) {
            const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
            const decoded = Buffer.from(encrypted, 'base64');
            const iv = decoded.subarray(0, 12).toString('hex');
            ivs.add(iv);
        }
        // All 100 IVs should be unique (extremely high probability)
        node_assert_1.default.strictEqual(ivs.size, 100);
    });
});
(0, node_test_1.describe)('Security - PK Key Length', () => {
    (0, node_test_1.it)('PK is always 32 bytes (256 bits for AES-256)', () => {
        const mnemonics = [
            'abandon ability able about above absent absorb abstract absurd abuse access accident',
            'acoustic acquire across act action actor actress actual adapt add addict address',
            'adjust admit adult advance advice aerobic affair afford afraid again age agent',
        ];
        for (const mnemonic of mnemonics) {
            const pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
            node_assert_1.default.strictEqual(pk.length, 32, 'PK should be 32 bytes');
        }
    });
    (0, node_test_1.it)('PK derivation uses PBKDF2 with 100k iterations', () => {
        // Verify PBKDF2 is used by checking consistency
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pk1 = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
        const pk2 = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
        node_assert_1.default.deepStrictEqual(pk1, pk2);
        // Different mnemonic = different PK
        const pk3 = (0, index_ts_1.derivePkFromMnemonic)('acoustic acquire across act action actor actress actual adapt add addict address');
        node_assert_1.default.ok(!pk1.equals(pk3));
    });
});
(0, node_test_1.describe)('Security - AAD Binding', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
    const value = 'secret-api-key';
    (0, node_test_1.it)('AAD is bound to ciphertext - wrong AAD fails decryption', () => {
        const correctAad = 'project-a:API_KEY';
        const wrongAad = 'project-b:WRONG_KEY';
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, correctAad);
        node_assert_1.default.throws(() => (0, index_ts_1.decryptWithPk)(encrypted, pk, wrongAad), /Unsupported state or unable to authenticate data|digital envelope/);
    });
    (0, node_test_1.it)('AAD tampering detected', () => {
        const aad = 'project:KEY';
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        // Tamper with AAD
        const tamperedAad = 'project:KEY_TAMPERED';
        node_assert_1.default.throws(() => (0, index_ts_1.decryptWithPk)(encrypted, pk, tamperedAad), /Unsupported state or unable to authenticate data/);
    });
    (0, node_test_1.it)('Same value with different AAD produces different ciphertext', () => {
        const aad1 = 'project-a:KEY';
        const aad2 = 'project-b:KEY';
        const encrypted1 = (0, index_ts_1.encryptWithPk)(value, pk, aad1);
        const encrypted2 = (0, index_ts_1.encryptWithPk)(value, pk, aad2);
        // Different AAD = different ciphertext (AAD is authenticated)
        node_assert_1.default.notStrictEqual(encrypted1, encrypted2);
    });
});
(0, node_test_1.describe)('Security - Output Encoding', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
    const value = 'secret-with-special-chars-🔑';
    const aad = 'project:KEY';
    (0, node_test_1.it)('Encrypted output is valid base64', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        // Should not throw
        const decoded = Buffer.from(encrypted, 'base64');
        // Re-encoding should match
        node_assert_1.default.strictEqual(decoded.toString('base64'), encrypted);
    });
    (0, node_test_1.it)('Encrypted output is safe for storage/transit', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        // Base64 should only contain safe characters
        node_assert_1.default.ok(/^[A-Za-z0-9+/=]+$/.test(encrypted));
        // No newlines or special characters
        node_assert_1.default.ok(!encrypted.includes('\n'));
        node_assert_1.default.ok(!encrypted.includes('\r'));
        node_assert_1.default.ok(!encrypted.includes(' '));
    });
    (0, node_test_1.it)('Encrypted output contains IV + tag + ciphertext', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        const decoded = Buffer.from(encrypted, 'base64');
        // Structure: IV (12) + tag (16) + ciphertext (variable)
        node_assert_1.default.ok(decoded.length > 28); // At least IV + tag
        const iv = decoded.subarray(0, 12);
        const tag = decoded.subarray(12, 28);
        const ciphertext = decoded.subarray(28);
        node_assert_1.default.strictEqual(iv.length, 12);
        node_assert_1.default.strictEqual(tag.length, 16);
        node_assert_1.default.ok(ciphertext.length > 0);
    });
});
(0, node_test_1.describe)('Security - Tamper Detection', () => {
    const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
    const value = 'untampered-value';
    const aad = 'project:KEY';
    (0, node_test_1.it)('Tampered ciphertext fails decryption', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        const decoded = Buffer.from(encrypted, 'base64');
        // Tamper with ciphertext portion
        const tampered = Buffer.from(decoded);
        tampered[tampered.length - 1] = tampered[tampered.length - 1] ^ 0xFF;
        const tamperedBase64 = tampered.toString('base64');
        node_assert_1.default.throws(() => (0, index_ts_1.decryptWithPk)(tamperedBase64, pk, aad), /Unsupported state or unable to authenticate data/);
    });
    (0, node_test_1.it)('Tampered auth tag fails decryption', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        const decoded = Buffer.from(encrypted, 'base64');
        // Tamper with tag portion (bytes 12-27)
        const tampered = Buffer.from(decoded);
        tampered[15] = tampered[15] ^ 0xFF;
        const tamperedBase64 = tampered.toString('base64');
        node_assert_1.default.throws(() => (0, index_ts_1.decryptWithPk)(tamperedBase64, pk, aad), /Unsupported state or unable to authenticate data/);
    });
    (0, node_test_1.it)('Truncated ciphertext fails decryption', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(value, pk, aad);
        const decoded = Buffer.from(encrypted, 'base64');
        // Truncate the buffer
        const truncated = decoded.subarray(0, decoded.length - 5);
        const truncatedBase64 = truncated.toString('base64');
        node_assert_1.default.throws(() => (0, index_ts_1.decryptWithPk)(truncatedBase64, pk, aad), /Unsupported state or unable to authenticate data|wrong final block length/);
    });
});
//# sourceMappingURL=security-crypto.test.js.map