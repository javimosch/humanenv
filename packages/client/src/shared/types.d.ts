export interface Project {
    id: string;
    name: string;
    createdAt: number;
}
export interface Env {
    id: string;
    projectId: string;
    key: string;
    encryptedValue: string;
    createdAt: number;
}
export interface ApiKey {
    id: string;
    projectId: string;
    encryptedValue: string;
    ttl?: number;
    expiresAt?: number;
    createdAt: number;
}
export interface WhitelistEntry {
    id: string;
    projectId: string;
    fingerprint: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: number;
}
export type WsMessage = {
    type: 'auth';
    payload: AuthPayload;
} | {
    type: 'auth_response';
    payload: AuthResponse;
} | {
    type: 'get';
    payload: {
        key: string;
    };
} | {
    type: 'get_response';
    payload: {
        key: string;
        value: string;
    } | {
        error: string;
        code: string;
    };
} | {
    type: 'set';
    payload: {
        key: string;
        value: string;
    };
} | {
    type: 'set_response';
    payload: {
        success: boolean;
    } | {
        error: string;
        code: string;
    };
} | {
    type: 'apikey_request';
    payload: {
        clientFingerprint: string;
        projectName: string;
    };
} | {
    type: 'apikey_response';
    payload: {
        success: boolean;
        apiKey?: string;
    } | {
        error: string;
        code: string;
    };
} | {
    type: 'whitelist_request';
    payload: {
        fingerprint: string;
        projectName: string;
    };
} | {
    type: 'whitelist_response';
    payload: {
        fingerprint: string;
        approved: boolean;
    };
} | {
    type: 'disconnect';
    payload?: never;
} | {
    type: 'ping';
    payload?: never;
} | {
    type: 'pong';
    payload?: never;
};
export interface AuthPayload {
    projectName: string;
    apiKey: string;
    fingerprint: string;
}
export interface AuthResponse {
    success: boolean;
    whitelisted: boolean;
    status?: 'approved' | 'pending' | 'rejected';
    error?: string;
    code?: string;
}
export interface ClientConfig {
    serverUrl: string;
    projectName: string;
    projectApiKey?: string;
    maxRetries?: number;
}
export interface ServerConfig {
    port: number;
    basicAuth?: {
        username: string;
        password: string;
    };
    dataDir: string;
    dbUri?: string;
}
export type CredentialStore = {
    projectName: string;
    serverUrl: string;
    apiKey?: string;
};
export interface SkillMetadata {
    name: string;
    description: string;
    category?: string;
}
export declare const SKILL_CONTENT = "---\nname: humanenv-usage\ndescription: Use humanenv to retrieve sensitives/envs. Never log/read sensitives from humanenv. They are envs for humans only.\n---\n\n## How to retrieve sensitives\n\n### JavaScript API\nUse `humanenv.get('key')` inside your application. The returned value must be used immediately and then set to `null` to prevent memory leaks.\n\n### CLI\nUse humanenv CLI to retrieve envs. Do not attempt to log or dump all envs.\n\n## Rules\n1. NEVER log env values retrieved from humanenv\n2. NEVER dump or export multiple values at once\n3. ALWAYS null variables after use\n4. NEVER write sensitives to files\n5. Do not generate scripts that use humanenv in loops or to exfiltrate data";
//# sourceMappingURL=types.d.ts.map