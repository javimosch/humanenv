"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFingerprint = exports.PkManager = void 0;
const humanenv_shared_1 = require("humanenv-shared");
Object.defineProperty(exports, "generateFingerprint", { enumerable: true, get: function () { return humanenv_shared_1.generateFingerprint; } });
const humanenv_shared_2 = require("humanenv-shared");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const TEMPORAL_PK_FILE = path_1.default.join(process.env.DATA_DIR || path_1.default.join(os_1.default.homedir(), '.humanenv'), 'temporal-pk.dat');
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}
function sanitizeProjectName(name) {
    return name.replace(/[^a-z0-9]/gi, '').toLowerCase();
}
async function buildTemporalSalt(db) {
    const date = getTodayDate().replace(/-/g, '');
    try {
        const projects = await db.listProjects();
        if (projects.length === 0)
            return date;
        const names = projects.map(p => sanitizeProjectName(p.name)).sort().join('_');
        return names ? `${date}_${names}` : date;
    }
    catch {
        return date;
    }
}
class PkManager {
    constructor() {
        this.pk = null;
        this.mnemonic = null;
        this.temporalPkEnabled = false;
        this.dbForTemporal = null;
    }
    async bootstrap(storedHash, db) {
        this.temporalPkEnabled = await this.isTemporalPkEnabled(db);
        this.dbForTemporal = db;
        if (this.temporalPkEnabled) {
            const loadedFromFile = await this.loadTemporalPk(storedHash);
            if (loadedFromFile) {
                return { status: 'ready', existing: storedHash ? 'hash' : 'first' };
            }
        }
        const envMnemonic = process.env.HUMANENV_MNEMONIC;
        if (envMnemonic) {
            const trimmed = envMnemonic.trim();
            if (!(0, humanenv_shared_1.validateMnemonic)(trimmed)) {
                throw new humanenv_shared_2.HumanEnvError(humanenv_shared_2.ErrorCode.SERVER_INTERNAL_ERROR, 'HUMANENV_MNEMONIC env contains invalid mnemonic');
            }
            this.mnemonic = trimmed;
            this.pk = (0, humanenv_shared_1.derivePkFromMnemonic)(trimmed);
            const derivedHash = (0, humanenv_shared_1.hashPkForVerification)(this.pk);
            if (storedHash && derivedHash !== storedHash) {
                console.warn('WARN: Derived PK hash does not match stored hash. Data may be unrecoverable.');
            }
            console.log('PK restored from HUMANENV_MNEMONIC env var.');
            return { status: 'ready', existing: storedHash ? 'hash' : 'first' };
        }
        if (!storedHash) {
            return { status: 'needs_input', existing: 'first' };
        }
        return { status: 'needs_input', existing: 'hash' };
    }
    async isTemporalPkEnabled(db) {
        if (process.env.HUMANENV_TEMPORAL_PK === 'true')
            return true;
        const stored = await db.getGlobalSetting('temporal-pk');
        return stored === 'true';
    }
    async loadTemporalPk(storedHash) {
        if (!fs_1.default.existsSync(TEMPORAL_PK_FILE))
            return false;
        try {
            const encrypted = fs_1.default.readFileSync(TEMPORAL_PK_FILE, 'utf8');
            const salt = await buildTemporalSalt(this.dbForTemporal);
            const tempPk = (0, humanenv_shared_1.derivePkFromMnemonic)(salt);
            const decrypted = (0, humanenv_shared_1.decryptWithPk)(encrypted, tempPk, 'temporal-pk');
            if (!(0, humanenv_shared_1.validateMnemonic)(decrypted)) {
                throw new Error('Invalid mnemonic in temporal file');
            }
            this.mnemonic = decrypted;
            this.pk = (0, humanenv_shared_1.derivePkFromMnemonic)(decrypted);
            const derivedHash = (0, humanenv_shared_1.hashPkForVerification)(this.pk);
            if (storedHash && derivedHash !== storedHash) {
                console.warn('WARN: Derived PK hash does not match stored hash. Data may be unrecoverable.');
            }
            fs_1.default.unlinkSync(TEMPORAL_PK_FILE);
            console.log('PK restored from temporal file.');
            return true;
        }
        catch (e) {
            try {
                fs_1.default.unlinkSync(TEMPORAL_PK_FILE);
            }
            catch { }
            console.warn('Failed to load temporal PK, removing corrupted file:', e instanceof Error ? e.message : 'unknown');
            return false;
        }
    }
    async saveTemporalPk() {
        if (!this.pk || !this.mnemonic)
            return;
        if (!this.temporalPkEnabled || !this.dbForTemporal)
            return;
        try {
            const salt = await buildTemporalSalt(this.dbForTemporal);
            const tempPk = (0, humanenv_shared_1.derivePkFromMnemonic)(salt);
            const encrypted = (0, humanenv_shared_1.encryptWithPk)(this.mnemonic, tempPk, 'temporal-pk');
            fs_1.default.writeFileSync(TEMPORAL_PK_FILE, encrypted, { mode: 0o600 });
            console.log('PK saved to temporal file for restart survival.');
        }
        catch (e) {
            console.warn('Failed to save temporal PK:', e instanceof Error ? e.message : 'unknown');
        }
    }
    isReady() {
        return this.pk !== null;
    }
    getPk() {
        if (!this.pk)
            throw new humanenv_shared_2.HumanEnvError(humanenv_shared_2.ErrorCode.SERVER_PK_NOT_AVAILABLE);
        return this.pk;
    }
    getMnemonic() {
        if (!this.mnemonic) {
            this.mnemonic = (0, humanenv_shared_1.generateMnemonic)();
        }
        return this.mnemonic;
    }
    submitMnemonic(mnemonic, storedHash) {
        const trimmed = mnemonic.trim();
        if (!(0, humanenv_shared_1.validateMnemonic)(trimmed)) {
            throw new Error('Invalid mnemonic: must be a 12-word BIP39-compatible phrase');
        }
        const derived = (0, humanenv_shared_1.derivePkFromMnemonic)(trimmed);
        const hash = (0, humanenv_shared_1.hashPkForVerification)(derived);
        if (storedHash && hash !== storedHash) {
            throw new Error('Mnemonic does not match the stored hash. Data was encrypted with a different key.');
        }
        this.pk = derived;
        this.mnemonic = trimmed;
        return { hash, verified: true, firstSetup: !storedHash };
    }
    encrypt(value, aad) {
        return (0, humanenv_shared_1.encryptWithPk)(value, this.getPk(), aad);
    }
    decrypt(encryptedValue, aad) {
        return (0, humanenv_shared_1.decryptWithPk)(encryptedValue, this.getPk(), aad);
    }
    clear() {
        this.pk = null;
        this.mnemonic = null;
    }
}
exports.PkManager = PkManager;
//# sourceMappingURL=pk-manager.js.map