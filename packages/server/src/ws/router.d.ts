import { WebSocket } from 'ws';
import { IDatabaseProvider } from '../db/interface';
import { PkManager } from '../pk-manager';
export declare class WsRouter {
    private server;
    private db;
    private pk;
    private wss;
    private pendingRequests;
    private adminClients;
    private clientSessions;
    private autoAcceptApiKey;
    private lastUsedMap;
    private lastUsedFlushInterval;
    constructor(server: any, db: IDatabaseProvider, pk: PkManager);
    shutdown(): Promise<void>;
    private flushLastUsed;
    /** Register admin UI WS clients */
    registerAdminClient(ws: WebSocket): void;
    unregisterAdminClient(ws: WebSocket): void;
    setAutoAcceptApiKey(value: boolean): void;
    getAutoAcceptApiKey(): boolean;
    /** Broadcast event to all admin UI clients */
    broadcastAdmin(event: string, payload: any): void;
    /** Resolve a pending request from admin action */
    resolvePending(id: string, response: any): void;
    rejectPending(id: string, error: string): void;
    private onConnection;
    private setupClient;
    private handleAdminMessage;
}
//# sourceMappingURL=router.d.ts.map