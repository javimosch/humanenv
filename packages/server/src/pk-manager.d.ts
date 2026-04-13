import { generateFingerprint } from 'humanenv-shared';
export declare class PkManager {
    private pk;
    private mnemonic;
    private temporalPkEnabled;
    private dbForTemporal;
    bootstrap(storedHash: string | null, db: {
        getGlobalSetting(key: string): Promise<string | null>;
        listProjects(): Promise<Array<{
            name: string;
        }>>;
    }): Promise<{
        status: 'ready' | 'needs_input';
        existing?: 'hash' | 'first';
    }>;
    isTemporalPkEnabled(db: {
        getGlobalSetting(key: string): Promise<string | null>;
    }): Promise<boolean>;
    private loadTemporalPk;
    saveTemporalPk(): Promise<void>;
    isReady(): boolean;
    getPk(): Uint8Array;
    getMnemonic(): string;
    submitMnemonic(mnemonic: string, storedHash: string | null): {
        hash: string;
        verified: boolean;
        firstSetup: boolean;
    };
    encrypt(value: string, aad: string): string;
    decrypt(encryptedValue: string, aad: string): string;
    clear(): void;
}
export { generateFingerprint };
//# sourceMappingURL=pk-manager.d.ts.map