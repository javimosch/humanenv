import * as crypto from 'node:crypto';
const PBKDF2_ITERATIONS = 100_000;
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
export function generateMnemonic() {
    const entropy = crypto.randomBytes(16);
    const words = [];
    for (let i = 0; i < 32; i++) {
        words.push(BIP39_WORDLIST[entropy[i] % BIP39_WORDLIST.length]);
    }
    return words.slice(0, 12).join(' ');
}
export function validateMnemonic(mnemonic) {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 12)
        return false;
    return words.every(w => BIP39_WORDLIST.includes(w));
}
export function derivePkFromMnemonic(mnemonic) {
    return crypto.pbkdf2Sync(mnemonic.toLowerCase().trim(), 'humanenv-server-v1', PBKDF2_ITERATIONS, PK_KEY_LENGTH, 'sha256');
}
export function hashPkForVerification(pk) {
    return crypto.createHash('sha256').update(pk).digest('hex');
}
export function encryptWithPk(value, pk, aad) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', pk, iv);
    cipher.setAAD(crypto.createHash('sha256').update(aad).digest());
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}
export function decryptWithPk(encryptedBase64, pk, aad) {
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
export function generateFingerprint() {
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