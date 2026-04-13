"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const index_ts_1 = require("../src/index.ts");
(0, node_test_1.describe)('encryptWithPk / decryptWithPk', () => {
    let pk;
    const testValue = 'super-secret-api-key-12345';
    const aad = 'test-project:API_KEY';
    (0, node_test_1.before)(() => {
        // Derive a consistent PK for testing
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
    });
    (0, node_test_1.it)('decrypt(encrypt(value)) returns original value', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(testValue, pk, aad);
        const decrypted = (0, index_ts_1.decryptWithPk)(encrypted, pk, aad);
        node_assert_1.default.strictEqual(decrypted, testValue);
    });
    (0, node_test_1.it)('encrypt produces different ciphertext each time (random IV)', () => {
        const encrypted1 = (0, index_ts_1.encryptWithPk)(testValue, pk, aad);
        const encrypted2 = (0, index_ts_1.encryptWithPk)(testValue, pk, aad);
        node_assert_1.default.notStrictEqual(encrypted1, encrypted2);
        // Both should decrypt to the same value
        const decrypted1 = (0, index_ts_1.decryptWithPk)(encrypted1, pk, aad);
        const decrypted2 = (0, index_ts_1.decryptWithPk)(encrypted2, pk, aad);
        node_assert_1.default.strictEqual(decrypted1, testValue);
        node_assert_1.default.strictEqual(decrypted2, testValue);
    });
    (0, node_test_1.it)('decrypt with wrong AAD throws error', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(testValue, pk, aad);
        const wrongAad = 'wrong-project:WRONG_KEY';
        node_assert_1.default.throws(() => (0, index_ts_1.decryptWithPk)(encrypted, pk, wrongAad), /error:0407106B:rsa routines:RSA_padding_check_PKCS1_type_2:block type is not 02|digital envelope routines|Unsupported state or unable to authenticate data/);
    });
    (0, node_test_1.it)('decrypt with wrong PK throws error', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(testValue, pk, aad);
        const wrongPk = node_crypto_1.default.randomBytes(32);
        node_assert_1.default.throws(() => (0, index_ts_1.decryptWithPk)(encrypted, wrongPk, aad), /error:0407106B:rsa routines:RSA_padding_check_PKCS1_type_2:block type is not 02|digital envelope routines|Unsupported state or unable to authenticate data/);
    });
    (0, node_test_1.it)('encrypt empty string works', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)('', pk, aad);
        const decrypted = (0, index_ts_1.decryptWithPk)(encrypted, pk, aad);
        node_assert_1.default.strictEqual(decrypted, '');
    });
    (0, node_test_1.it)('encrypt unicode characters works', () => {
        const unicodeValue = 'secret-🔑-キー-ключ';
        const encrypted = (0, index_ts_1.encryptWithPk)(unicodeValue, pk, aad);
        const decrypted = (0, index_ts_1.decryptWithPk)(encrypted, pk, aad);
        node_assert_1.default.strictEqual(decrypted, unicodeValue);
    });
    (0, node_test_1.it)('encrypted output is base64 encoded', () => {
        const encrypted = (0, index_ts_1.encryptWithPk)(testValue, pk, aad);
        // Should be valid base64
        node_assert_1.default.doesNotThrow(() => Buffer.from(encrypted, 'base64'));
        // Should contain IV (12) + tag (16) + ciphertext
        const decoded = Buffer.from(encrypted, 'base64');
        node_assert_1.default.ok(decoded.length > 28); // At least IV + tag
    });
});
//# sourceMappingURL=crypto-encrypt-decrypt.test.js.map