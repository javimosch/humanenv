"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const pk_manager_ts_1 = require("../src/pk-manager.ts");
const humanenv_shared_1 = require("humanenv-shared");
(0, node_test_1.describe)('PkManager.bootstrap', () => {
    let originalMnemonic;
    (0, node_test_1.beforeEach)(() => {
        // Save original env var
        originalMnemonic = process.env.HUMANENV_MNEMONIC;
        // Clear env var before each test
        delete process.env.HUMANENV_MNEMONIC;
    });
    (0, node_test_1.afterEach)(() => {
        // Restore original env var
        if (originalMnemonic !== undefined) {
            process.env.HUMANENV_MNEMONIC = originalMnemonic;
        }
        else {
            delete process.env.HUMANENV_MNEMONIC;
        }
    });
    (0, node_test_1.it)('returns needs_input when no stored hash and no env var', async () => {
        const pkManager = new pk_manager_ts_1.PkManager();
        const result = await pkManager.bootstrap(null);
        node_assert_1.default.strictEqual(result.status, 'needs_input');
        node_assert_1.default.strictEqual(result.existing, 'first');
        node_assert_1.default.strictEqual(pkManager.isReady(), false);
    });
    (0, node_test_1.it)('returns needs_input when stored hash exists but no env var', async () => {
        const pkManager = new pk_manager_ts_1.PkManager();
        const storedHash = 'abc123def456';
        const result = await pkManager.bootstrap(storedHash);
        node_assert_1.default.strictEqual(result.status, 'needs_input');
        node_assert_1.default.strictEqual(result.existing, 'hash');
        node_assert_1.default.strictEqual(pkManager.isReady(), false);
    });
    (0, node_test_1.it)('returns ready when HUMANENV_MNEMONIC is set (first startup)', async () => {
        const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        process.env.HUMANENV_MNEMONIC = validMnemonic;
        const pkManager = new pk_manager_ts_1.PkManager();
        const result = await pkManager.bootstrap(null);
        node_assert_1.default.strictEqual(result.status, 'ready');
        node_assert_1.default.strictEqual(result.existing, 'first');
        node_assert_1.default.strictEqual(pkManager.isReady(), true);
    });
    (0, node_test_1.it)('returns ready when HUMANENV_MNEMONIC is set (existing hash)', async () => {
        const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        process.env.HUMANENV_MNEMONIC = validMnemonic;
        // Need to derive the hash that matches this mnemonic
        const { derivePkFromMnemonic, hashPkForVerification } = await Promise.resolve().then(() => __importStar(require('humanenv-shared')));
        const pk = derivePkFromMnemonic(validMnemonic);
        const storedHash = hashPkForVerification(pk);
        const pkManager = new pk_manager_ts_1.PkManager();
        const result = await pkManager.bootstrap(storedHash);
        node_assert_1.default.strictEqual(result.status, 'ready');
        node_assert_1.default.strictEqual(result.existing, 'hash');
        node_assert_1.default.strictEqual(pkManager.isReady(), true);
    });
    (0, node_test_1.it)('throws when HUMANENV_MNEMONIC contains invalid mnemonic', async () => {
        process.env.HUMANENV_MNEMONIC = 'invalid words not in wordlist xyz abc def ghi jkl mno pqr stu vwx';
        const pkManager = new pk_manager_ts_1.PkManager();
        await node_assert_1.default.rejects(async () => pkManager.bootstrap(null), (err) => {
            node_assert_1.default.ok(err instanceof humanenv_shared_1.HumanEnvError);
            node_assert_1.default.strictEqual(err.code, humanenv_shared_1.ErrorCode.SERVER_INTERNAL_ERROR);
            node_assert_1.default.ok(err.message.includes('invalid mnemonic'));
            return true;
        });
    });
    (0, node_test_1.it)('logs warning when derived hash does not match stored hash', async () => {
        const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        process.env.HUMANENV_MNEMONIC = validMnemonic;
        const wrongStoredHash = 'wronghash123';
        const pkManager = new pk_manager_ts_1.PkManager();
        const consoleWarnMock = node_test_1.mock.method(console, 'warn', () => { });
        const result = await pkManager.bootstrap(wrongStoredHash);
        node_assert_1.default.strictEqual(result.status, 'ready');
        node_assert_1.default.strictEqual(consoleWarnMock.mock.callCount(), 1);
        node_assert_1.default.ok(consoleWarnMock.mock.calls[0].arguments[0].includes('does not match'));
        consoleWarnMock.restore();
    });
    (0, node_test_1.it)('logs success message when PK restored from env', async () => {
        const validMnemonic = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        process.env.HUMANENV_MNEMONIC = validMnemonic;
        const pkManager = new pk_manager_ts_1.PkManager();
        const consoleLogMock = node_test_1.mock.method(console, 'log', () => { });
        await pkManager.bootstrap(null);
        node_assert_1.default.strictEqual(consoleLogMock.mock.callCount(), 1);
        node_assert_1.default.ok(consoleLogMock.mock.calls[0].arguments[0].includes('PK restored'));
        consoleLogMock.restore();
    });
});
//# sourceMappingURL=pk-manager-bootstrap.test.js.map