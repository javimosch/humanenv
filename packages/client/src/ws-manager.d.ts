export type ClientConfig = {
    serverUrl: string;
    projectName: string;
    projectApiKey?: string;
    maxRetries?: number;
};
export declare class HumanEnvClient {
    private ws;
    private connected;
    private authenticated;
    private _whitelistStatus;
    private attempts;
    private pending;
    private config;
    private retryTimer;
    private pingTimer;
    private reconnecting;
    private disconnecting;
    private _authResolve;
    private _authReject;
    get whitelistStatus(): 'approved' | 'pending' | 'rejected' | null;
    constructor(config: ClientConfig);
    private getFingerprint;
    connect(): Promise<void>;
    private doConnect;
    private sendAuth;
    private handleMessage;
    private _resolvePending;
    get(key: string): Promise<string>;
    get(keys: string[]): Promise<Record<string, string>>;
    private _getSingle;
    set(key: string, value: string): Promise<void>;
    private scheduleReconnect;
    private startPing;
    private stopPing;
    /** Connect (creates fresh WS) and waits for auth response up to `timeoutMs`. Resolves silently on timeout. */
    connectAndWaitForAuth(timeoutMs: number): Promise<void>;
    disconnect(): void;
}
//# sourceMappingURL=ws-manager.d.ts.map