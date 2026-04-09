export declare function generateMnemonic(): string;
export declare function validateMnemonic(mnemonic: string): boolean;
export declare function derivePkFromMnemonic(mnemonic: string): Buffer;
export declare function hashPkForVerification(pk: Buffer): string;
export declare function encryptWithPk(value: string, pk: Buffer, aad: string): string;
export declare function decryptWithPk(encryptedBase64: string, pk: Buffer, aad: string): string;
export declare function generateFingerprint(): string;
//# sourceMappingURL=crypto.d.ts.map