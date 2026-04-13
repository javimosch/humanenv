"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const index_ts_1 = require("../src/index.ts");
(0, node_test_1.describe)('generateMnemonic', () => {
    (0, node_test_1.it)('returns 12 space-separated words', () => {
        const mnemonic = (0, index_ts_1.generateMnemonic)();
        const words = mnemonic.split(' ');
        node_assert_1.default.strictEqual(words.length, 12);
    });
    (0, node_test_1.it)('returns words from BIP39 wordlist', () => {
        const mnemonic = (0, index_ts_1.generateMnemonic)();
        const words = mnemonic.split(' ');
        // All words should be valid (validation checks wordlist)
        const isValid = (0, index_ts_1.validateMnemonic)(mnemonic);
        node_assert_1.default.strictEqual(isValid, true);
    });
    (0, node_test_1.it)('generates different mnemonics each call', () => {
        const mnemonic1 = (0, index_ts_1.generateMnemonic)();
        const mnemonic2 = (0, index_ts_1.generateMnemonic)();
        node_assert_1.default.notStrictEqual(mnemonic1, mnemonic2);
    });
});
(0, node_test_1.describe)('validateMnemonic', () => {
    (0, node_test_1.it)('accepts valid 12-word phrase', () => {
        const valid = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(valid), true);
    });
    (0, node_test_1.it)('rejects phrase with wrong word count', () => {
        const elevenWords = 'abandon ability able about above absent absorb abstract absurd abuse access';
        const thirteenWords = 'abandon ability able about above absent absorb abstract absurd abuse access accident acid';
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(elevenWords), false);
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(thirteenWords), false);
    });
    (0, node_test_1.it)('rejects phrase with invalid word', () => {
        const invalid = 'abandon ability able about above absent absorb abstract absurd abuse access invalidword';
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(invalid), false);
    });
    (0, node_test_1.it)('rejects empty string', () => {
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(''), false);
    });
    (0, node_test_1.it)('rejects non-string input', () => {
        // @ts-ignore - testing invalid input
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(123), false);
        // @ts-ignore
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(null), false);
    });
    (0, node_test_1.it)('trims whitespace before validation', () => {
        const valid = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const withWhitespace = `  ${valid}  `;
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(withWhitespace), true);
    });
    (0, node_test_1.it)('case insensitive validation', () => {
        const upperCase = 'ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT';
        node_assert_1.default.strictEqual((0, index_ts_1.validateMnemonic)(upperCase), true);
    });
});
(0, node_test_1.describe)('derivePkFromMnemonic', () => {
    (0, node_test_1.it)('produces 32-byte key', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
        node_assert_1.default.strictEqual(pk.length, 32);
    });
    (0, node_test_1.it)('produces consistent key for same mnemonic', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pk1 = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
        const pk2 = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
        node_assert_1.default.deepStrictEqual(pk1, pk2);
    });
    (0, node_test_1.it)('produces different keys for different mnemonics', () => {
        const mnemonic1 = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const mnemonic2 = 'acoustic acquire across act action actor actress actual adapt add addict address';
        const pk1 = (0, index_ts_1.derivePkFromMnemonic)(mnemonic1);
        const pk2 = (0, index_ts_1.derivePkFromMnemonic)(mnemonic2);
        node_assert_1.default.ok(!pk1.equals(pk2));
    });
    (0, node_test_1.it)('case insensitive (lowercase trim)', () => {
        const lower = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const upper = 'ABANDON ABILITY ABLE ABOUT ABOVE ABSENT ABSORB ABSTRACT ABSURD ABUSE ACCESS ACCIDENT';
        const pkLower = (0, index_ts_1.derivePkFromMnemonic)(lower);
        const pkUpper = (0, index_ts_1.derivePkFromMnemonic)(upper);
        node_assert_1.default.deepStrictEqual(pkLower, pkUpper);
    });
});
(0, node_test_1.describe)('hashPkForVerification', () => {
    (0, node_test_1.it)('produces 64-character hex string', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
        const hash = (0, index_ts_1.hashPkForVerification)(pk);
        node_assert_1.default.strictEqual(hash.length, 64);
        node_assert_1.default.ok(/^[0-9a-f]+$/i.test(hash));
    });
    (0, node_test_1.it)('produces consistent hash for same PK', () => {
        const mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const pk = (0, index_ts_1.derivePkFromMnemonic)(mnemonic);
        const hash1 = (0, index_ts_1.hashPkForVerification)(pk);
        const hash2 = (0, index_ts_1.hashPkForVerification)(pk);
        node_assert_1.default.strictEqual(hash1, hash2);
    });
    (0, node_test_1.it)('produces different hashes for different PKs', () => {
        const mnemonic1 = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        const mnemonic2 = 'acoustic acquire across act action actor actress actual adapt add addict address';
        const pk1 = (0, index_ts_1.derivePkFromMnemonic)(mnemonic1);
        const pk2 = (0, index_ts_1.derivePkFromMnemonic)(mnemonic2);
        const hash1 = (0, index_ts_1.hashPkForVerification)(pk1);
        const hash2 = (0, index_ts_1.hashPkForVerification)(pk2);
        node_assert_1.default.notStrictEqual(hash1, hash2);
    });
});
//# sourceMappingURL=crypto-mnemonic.test.js.map