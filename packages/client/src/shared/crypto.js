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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMnemonic = generateMnemonic;
exports.validateMnemonic = validateMnemonic;
exports.derivePkFromMnemonic = derivePkFromMnemonic;
exports.hashPkForVerification = hashPkForVerification;
exports.encryptWithPk = encryptWithPk;
exports.decryptWithPk = decryptWithPk;
exports.generateFingerprint = generateFingerprint;
const crypto = __importStar(require("node:crypto"));
const PBKDF2_ITERATIONS = 100000;
const PK_KEY_LENGTH = 32;
// ============================================================
// Mnemonic helpers (BIP39-compatible wordlist handling)
// ============================================================
const BIP39_WORDLIST = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
    'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
    'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
    'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
    'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
    'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
    'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
    'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
    'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
    'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna',
    'antique', 'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve',
    'april', 'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
    'army', 'around', 'arrest', 'arrive', 'arrow', 'art', 'artist', 'artwork',
    'ask', 'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma', 'athlete',
    'atom', 'attack', 'attend', 'attitude', 'attract', 'auction', 'audit', 'august',
    'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake',
    'aware', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon',
    'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner',
    'bar', 'barely', 'bargain', 'barrel', 'base', 'basic', 'basket', 'battle',
    'beach', 'bean', 'beauty', 'because', 'become', 'beef', 'before', 'begin',
    'behave', 'behind', 'believe', 'below', 'bench', 'benefit', 'best', 'betray',
    'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind', 'biology',
    'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast'
];
function generateMnemonic() {
    const entropy = crypto.randomBytes(16);
    const words = [];
    for (let i = 0; i < 32; i++) {
        words.push(BIP39_WORDLIST[entropy[i] % BIP39_WORDLIST.length]);
    }
    return words.slice(0, 12).join(' ');
}
function validateMnemonic(mnemonic) {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12)
        return false;
    return words.every(w => BIP39_WORDLIST.includes(w));
}
function derivePkFromMnemonic(mnemonic) {
    return crypto.pbkdf2Sync(mnemonic.toLowerCase().trim(), 'humanenv-server-v1', PBKDF2_ITERATIONS, PK_KEY_LENGTH, 'sha256');
}
function hashPkForVerification(pk) {
    return crypto.createHash('sha256').update(pk).digest('hex');
}
function encryptWithPk(value, pk, aad) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', pk, iv);
    cipher.setAAD(crypto.createHash('sha256').update(aad).digest());
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}
function decryptWithPk(encryptedBase64, pk, aad) {
    const buf = Buffer.from(encryptedBase64, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', pk, iv);
    decipher.setAAD(crypto.createHash('sha256').update(aad).digest());
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
}
function generateFingerprint() {
    const components = [
        process.env.HOSTNAME || 'unknown-host',
        process.platform,
        process.arch,
        process.version,
    ];
    return crypto
        .createHash('sha256')
        .update(components.join('|'))
        .digest('hex')
        .slice(0, 16);
}
//# sourceMappingURL=crypto.js.map