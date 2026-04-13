"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const pk_manager_ts_1 = require("../src/pk-manager.ts");
const humanenv_shared_1 = require("humanenv-shared");
(0, node_test_1.describe)('PkManager.submitMnemonic', () => {
    (0, node_test_1.it)('accepts valid 12-word mnemonic (first setup)', () => {
        const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pkManager = new pk_manager_ts_1.PkManager();
        const result = pkManager.submitMnemonic(validMnemonic, null);
        node_assert_1.default.strictEqual(result.verified, true);
        node_assert_1.default.strictEqual(result.firstSetup, true);
        node_assert_1.default.ok(result.hash.length > 0);
        node_assert_1.default.strictEqual(pkManager.isReady(), true);
    });
    (0, node_test_1.it)('accepts valid mnemonic matching stored hash', () => {
        const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pkManager = new pk_manager_ts_1.PkManager();
        // First submit to get the hash
        const firstResult = pkManager.submitMnemonic(validMnemonic, null);
        // Clear and resubmit with stored hash
        pkManager.clear();
        const secondResult = pkManager.submitMnemonic(validMnemonic, firstResult.hash);
        node_assert_1.default.strictEqual(secondResult.verified, true);
        node_assert_1.default.strictEqual(secondResult.firstSetup, false);
    });
    (0, node_test_1.it)('rejects invalid mnemonic (wrong word count)', () => {
        const invalidMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access';
        const pkManager = new pk_manager_ts_1.PkManager();
        node_assert_1.default.throws(() => pkManager.submitMnemonic(invalidMnemonic, null), /Invalid mnemonic/);
    });
    (0, node_test_1.it)('rejects invalid mnemonic (invalid words)', () => {
        const invalidMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access invalidword';
        const pkManager = new pk_manager_ts_1.PkManager();
        node_assert_1.default.throws(() => pkManager.submitMnemonic(invalidMnemonic, null), /Invalid mnemonic/);
    });
    (0, node_test_1.it)('rejects mnemonic that does not match stored hash', () => {
        const mnemonic1 = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const mnemonic2 = 'acoustic acquire across act action actor actress actual adapt add addict address';
        const pkManager = new pk_manager_ts_1.PkManager();
        // Submit first mnemonic to establish hash
        const firstResult = pkManager.submitMnemonic(mnemonic1, null);
        // Clear and try to submit different mnemonic with stored hash
        pkManager.clear();
        node_assert_1.default.throws(() => pkManager.submitMnemonic(mnemonic2, firstResult.hash), /Mnemonic does not match the stored hash/);
    });
    (0, node_test_1.it)('trims whitespace from mnemonic', () => {
        const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const withWhitespace = `  ${validMnemonic}  `;
        const pkManager = new pk_manager_ts_1.PkManager();
        const result = pkManager.submitMnemonic(withWhitespace, null);
        node_assert_1.default.strictEqual(result.verified, true);
        node_assert_1.default.strictEqual(pkManager.isReady(), true);
    });
    (0, node_test_1.it)('case insensitive mnemonic handling', () => {
        const lower = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const upper = 'ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT';
        const pkManager = new pk_manager_ts_1.PkManager();
        const result1 = pkManager.submitMnemonic(lower, null);
        pkManager.clear();
        const result2 = pkManager.submitMnemonic(upper, result1.hash);
        node_assert_1.default.strictEqual(result2.verified, true);
    });
});
(0, node_test_1.describe)('PkManager.encrypt / decrypt', () => {
    (0, node_test_1.it)('encrypt and decrypt roundtrip', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pkManager = new pk_manager_ts_1.PkManager();
        pkManager.submitMnemonic(mnemonic, null);
        const value = 'my-secret-api-key';
        const aad = 'test-project:API_KEY';
        const encrypted = pkManager.encrypt(value, aad);
        const decrypted = pkManager.decrypt(encrypted, aad);
        node_assert_1.default.strictEqual(decrypted, value);
    });
    (0, node_test_1.it)('decrypt with wrong AAD fails', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pkManager = new pk_manager_ts_1.PkManager();
        pkManager.submitMnemonic(mnemonic, null);
        const value = 'my-secret-api-key';
        const aad = 'test-project:API_KEY';
        const wrongAad = 'wrong-project:WRONG_KEY';
        const encrypted = pkManager.encrypt(value, aad);
        node_assert_1.default.throws(() => pkManager.decrypt(encrypted, wrongAad), /Unsupported state or unable to authenticate data|digital envelope/);
    });
    (0, node_test_1.it)('encrypt produces different output each time', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pkManager = new pk_manager_ts_1.PkManager();
        pkManager.submitMnemonic(mnemonic, null);
        const value = 'my-secret-api-key';
        const aad = 'test-project:API_KEY';
        const encrypted1 = pkManager.encrypt(value, aad);
        const encrypted2 = pkManager.encrypt(value, aad);
        node_assert_1.default.notStrictEqual(encrypted1, encrypted2);
        // Both decrypt to same value
        const decrypted1 = pkManager.decrypt(encrypted1, aad);
        const decrypted2 = pkManager.decrypt(encrypted2, aad);
        node_assert_1.default.strictEqual(decrypted1, value);
        node_assert_1.default.strictEqual(decrypted2, value);
    });
});
(0, node_test_1.describe)('PkManager.getPk', () => {
    (0, node_test_1.it)('throws when PK not loaded', () => {
        const pkManager = new pk_manager_ts_1.PkManager();
        node_assert_1.default.throws(() => pkManager.getPk(), (err) => {
            node_assert_1.default.ok(err instanceof humanenv_shared_1.HumanEnvError);
            node_assert_1.default.strictEqual(err.code, humanenv_shared_1.ErrorCode.SERVER_PK_NOT_AVAILABLE);
            return true;
        });
    });
    (0, node_test_1.it)('returns PK after mnemonic submitted', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pkManager = new pk_manager_ts_1.PkManager();
        pkManager.submitMnemonic(mnemonic, null);
        const pk = pkManager.getPk();
        node_assert_1.default.strictEqual(pk.length, 32);
    });
});
(0, node_test_1.describe)('PkManager.clear', () => {
    (0, node_test_1.it)('removes PK from memory', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pkManager = new pk_manager_ts_1.PkManager();
        pkManager.submitMnemonic(mnemonic, null);
        node_assert_1.default.strictEqual(pkManager.isReady(), true);
        pkManager.clear();
        node_assert_1.default.strictEqual(pkManager.isReady(), false);
        // getPk should throw after clear
        node_assert_1.default.throws(() => pkManager.getPk(), (err) => {
            node_assert_1.default.ok(err instanceof humanenv_shared_1.HumanEnvError);
            node_assert_1.default.strictEqual(err.code, humanenv_shared_1.ErrorCode.SERVER_PK_NOT_AVAILABLE);
            return true;
        });
    });
});
(0, node_test_1.describe)('PkManager.getMnemonic', () => {
    (0, node_test_1.it)('generates new mnemonic if not set', () => {
        const pkManager = new pk_manager_ts_1.PkManager();
        const mnemonic = pkManager.getMnemonic();
        const words = mnemonic.split(' ');
        node_assert_1.default.strictEqual(words.length, 12);
    });
    (0, node_test_1.it)('returns same mnemonic on subsequent calls', () => {
        const pkManager = new pk_manager_ts_1.PkManager();
        const mnemonic1 = pkManager.getMnemonic();
        const mnemonic2 = pkManager.getMnemonic();
        node_assert_1.default.strictEqual(mnemonic1, mnemonic2);
    });
    (0, node_test_1.it)('returns submitted mnemonic', () => {
        const submittedMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pkManager = new pk_manager_ts_1.PkManager();
        pkManager.submitMnemonic(submittedMnemonic, null);
        const retrievedMnemonic = pkManager.getMnemonic();
        node_assert_1.default.strictEqual(retrievedMnemonic, submittedMnemonic);
    });
});
//# sourceMappingURL=pk-manager-submit.test.js.map