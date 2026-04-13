import { IDatabaseProvider } from './interface';
export declare class SqliteProvider implements IDatabaseProvider {
    private dbPath;
    private db;
    constructor(dbPath: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    private initTables;
    createProject(name: string): Promise<{
        id: string;
    }>;
    getProject(name: string): Promise<{
        id: string;
        name: string;
        createdAt: number;
        fingerprintVerification: boolean;
        requireApiKey: boolean;
    } | null>;
    listProjects(): Promise<Array<{
        id: string;
        name: string;
        createdAt: number;
    }>>;
    deleteProject(id: string): Promise<void>;
    updateProject(id: string, data: {
        name?: string;
        fingerprintVerification?: boolean;
        requireApiKey?: boolean;
    }): Promise<void>;
    createEnv(projectId: string, key: string, encryptedValue: string): Promise<{
        id: string;
    }>;
    getEnv(projectId: string, key: string): Promise<{
        encryptedValue: string;
    } | null>;
    listEnvs(projectId: string): Promise<Array<{
        id: string;
        key: string;
        createdAt: number;
    }>>;
    listEnvsWithValues(projectId: string): Promise<Array<{
        id: string;
        key: string;
        encryptedValue: string;
        createdAt: number;
    }>>;
    updateEnv(projectId: string, key: string, encryptedValue: string): Promise<void>;
    deleteEnv(projectId: string, key: string): Promise<void>;
    createApiKey(projectId: string, encryptedValue: string, plainValue: string, ttl?: number, name?: string): Promise<{
        id: string;
    }>;
    getApiKey(projectId: string, plainValue: string): Promise<{
        id: string;
        expiresAt?: number;
    } | null>;
    listApiKeys(projectId: string): Promise<Array<{
        id: string;
        maskedPreview: string;
        ttl?: number;
        expiresAt?: number;
        createdAt: number;
        name?: string;
        lastUsed?: number;
    }>>;
    revokeApiKey(projectId: string, id: string): Promise<void>;
    updateApiKeyLastUsed(id: string, timestamp: number): Promise<void>;
    createWhitelistEntry(projectId: string, fingerprint: string, status: 'pending' | 'approved' | 'rejected'): Promise<{
        id: string;
    }>;
    getWhitelistEntry(projectId: string, fingerprint: string): Promise<{
        id: string;
        status: 'pending' | 'approved' | 'rejected';
    } | null>;
    listWhitelistEntries(projectId: string): Promise<Array<{
        id: string;
        fingerprint: string;
        status: 'pending' | 'approved' | 'rejected';
        createdAt: number;
    }>>;
    updateWhitelistStatus(id: string, status: 'approved' | 'rejected'): Promise<void>;
    storePkHash(hash: string): Promise<void>;
    getPkHash(): Promise<string | null>;
    storeGlobalSetting(key: string, value: string): Promise<void>;
    getGlobalSetting(key: string): Promise<string | null>;
}
//# sourceMappingURL=sqlite.d.ts.map