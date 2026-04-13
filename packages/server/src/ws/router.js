"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsRouter = void 0;
const ws_1 = require("ws");
const humanenv_shared_1 = require("humanenv-shared");
class WsRouter {
    constructor(server, db, pk) {
        this.server = server;
        this.db = db;
        this.pk = pk;
        this.pendingRequests = new Map();
        this.adminClients = new Set();
        this.clientSessions = new Map();
        this.autoAcceptApiKey = false;
        this.lastUsedMap = new Map();
        this.wss = new ws_1.WebSocketServer({ server, path: '/ws' });
        this.wss.on('connection', this.onConnection.bind(this));
        this.lastUsedFlushInterval = setInterval(() => this.flushLastUsed(), 60000);
    }
    async shutdown() {
        clearInterval(this.lastUsedFlushInterval);
        await this.flushLastUsed();
    }
    async flushLastUsed() {
        if (this.lastUsedMap.size === 0)
            return;
        const batch = new Map(this.lastUsedMap);
        this.lastUsedMap.clear();
        for (const [id, ts] of batch) {
            try {
                await this.db.updateApiKeyLastUsed(id, ts);
            }
            catch { }
        }
    }
    /** Register admin UI WS clients */
    registerAdminClient(ws) {
        this.adminClients.add(ws);
        ws.on('close', () => this.adminClients.delete(ws));
        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                this.handleAdminMessage(ws, msg);
            }
            catch (e) {
                // ignore malformed admin messages
            }
        });
    }
    unregisterAdminClient(ws) {
        this.adminClients.delete(ws);
    }
    setAutoAcceptApiKey(value) {
        this.autoAcceptApiKey = value;
    }
    getAutoAcceptApiKey() {
        return this.autoAcceptApiKey;
    }
    /** Broadcast event to all admin UI clients */
    broadcastAdmin(event, payload) {
        const data = JSON.stringify({ event, payload });
        for (const ws of this.adminClients) {
            if (ws.readyState === ws_1.WebSocket.OPEN)
                ws.send(data);
        }
    }
    /** Resolve a pending request from admin action */
    resolvePending(id, response) {
        const pending = this.pendingRequests.get(id);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(response);
            this.pendingRequests.delete(id);
        }
    }
    rejectPending(id, error) {
        const pending = this.pendingRequests.get(id);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.reject(error);
            this.pendingRequests.delete(id);
        }
    }
    onConnection(ws, req) {
        // Admin UI connects to /ws/admin
        if (req.url?.startsWith('/ws/admin')) {
            this.registerAdminClient(ws);
            ws.send(JSON.stringify({ event: 'admin_connected', payload: { ok: true } }));
            return;
        }
        // Client SDK connects to /ws
        this.setupClient(ws);
    }
    setupClient(ws) {
        let authState = null;
        let authenticated = false;
        const send = (msg) => {
            if (ws.readyState === ws_1.WebSocket.OPEN)
                ws.send(JSON.stringify(msg));
        };
        ws.on('message', async (raw) => {
            let msg = null;
            try {
                msg = JSON.parse(raw.toString());
            }
            catch {
                send({ type: 'get_response', payload: { error: 'Malformed request', code: humanenv_shared_1.ErrorCode.SERVER_INTERNAL_ERROR } });
                return;
            }
            if (!this.pk.isReady() && msg.type !== 'auth') {
                send({ type: (msg.type === 'get' ? 'get_response' : 'set_response'), payload: { error: humanenv_shared_1.ErrorMessages.SERVER_PK_NOT_AVAILABLE, code: humanenv_shared_1.ErrorCode.SERVER_PK_NOT_AVAILABLE } });
                return;
            }
            switch (msg.type) {
                case 'auth': {
                    const { projectName, apiKey, fingerprint } = msg.payload;
                    const project = await this.db.getProject(projectName);
                    if (!project) {
                        send({ type: 'auth_response', payload: { success: false, whitelisted: false, error: humanenv_shared_1.ErrorMessages.CLIENT_AUTH_INVALID_PROJECT_NAME, code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME } });
                        return;
                    }
                    // API key is optional - if provided and requireApiKey is true, validate it
                    // If server doesn't require API key, ignore provided key even if invalid
                    if (apiKey && apiKey.trim() !== '') {
                        const apiKeyDoc = await this.db.getApiKey(project.id, apiKey);
                        if (!apiKeyDoc) {
                            if (project.requireApiKey) {
                                send({ type: 'auth_response', payload: { success: false, whitelisted: false, error: humanenv_shared_1.ErrorMessages.CLIENT_AUTH_INVALID_API_KEY, code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY } });
                                return;
                            }
                        }
                        else {
                            this.lastUsedMap.set(apiKeyDoc.id, Date.now());
                        }
                    }
                    else if (project.requireApiKey) {
                        send({ type: 'auth_response', payload: { success: false, whitelisted: false, error: humanenv_shared_1.ErrorMessages.CLIENT_AUTH_INVALID_API_KEY, code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY } });
                        return;
                    }
                    let wl = await this.db.getWhitelistEntry(project.id, fingerprint);
                    const wlStatus = wl?.status || null;
                    if (!wl) {
                        // Create a pending whitelist entry and notify admin
                        await this.db.createWhitelistEntry(project.id, fingerprint, 'pending');
                        this.broadcastAdmin('whitelist_pending', { fingerprint, projectName: project.name, projectId: project.id });
                    }
                    authState = { projectName, fingerprint };
                    authenticated = true;
                    send({ type: 'auth_response', payload: { success: true, whitelisted: wlStatus === 'approved', status: wlStatus || 'pending' } });
                    break;
                }
                case 'get': {
                    if (!authenticated) {
                        send({ type: 'get_response', payload: { error: 'Not authenticated', code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY } });
                        return;
                    }
                    const { key } = msg.payload;
                    const project = await this.db.getProject(authState.projectName);
                    if (!project)
                        return send({ type: 'get_response', payload: { error: humanenv_shared_1.ErrorMessages.CLIENT_AUTH_INVALID_PROJECT_NAME, code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME } });
                    if (project.fingerprintVerification) {
                        const wl = await this.db.getWhitelistEntry(project.id, authState.fingerprint);
                        if (wl?.status !== 'approved') {
                            return send({ type: 'get_response', payload: { error: humanenv_shared_1.ErrorMessages.CLIENT_AUTH_NOT_WHITELISTED, code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_NOT_WHITELISTED } });
                        }
                    }
                    const env = await this.db.getEnv(project.id, key);
                    if (!env)
                        return send({ type: 'get_response', payload: { error: `Key not found: ${key}`, code: humanenv_shared_1.ErrorCode.SERVER_INTERNAL_ERROR } });
                    // NOTE: apiModeOnly flag is reserved for future CLI/SDK channel distinction
                    // Currently all authenticated clients (SDK and CLI) can access all envs
                    // if (env.apiModeOnly) {
                    //   return send({ type: 'get_response', payload: { error: ErrorMessages.ENV_API_MODE_ONLY, code: ErrorCode.ENV_API_MODE_ONLY } })
                    // }
                    const decrypted = this.pk.decrypt(env.encryptedValue, `${project.id}:${key}`);
                    send({ type: 'get_response', payload: { key, value: decrypted } });
                    break;
                }
                case 'set': {
                    if (!authenticated) {
                        send({ type: 'set_response', payload: { error: 'Not authenticated', code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY } });
                        return;
                    }
                    const { key, value } = msg.payload;
                    const project = await this.db.getProject(authState.projectName);
                    if (!project)
                        return send({ type: 'set_response', payload: { error: humanenv_shared_1.ErrorMessages.CLIENT_AUTH_INVALID_PROJECT_NAME, code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME } });
                    if (project.fingerprintVerification) {
                        const wl = await this.db.getWhitelistEntry(project.id, authState.fingerprint);
                        if (wl?.status !== 'approved') {
                            return send({ type: 'set_response', payload: { error: humanenv_shared_1.ErrorMessages.CLIENT_AUTH_NOT_WHITELISTED, code: humanenv_shared_1.ErrorCode.CLIENT_AUTH_NOT_WHITELISTED } });
                        }
                    }
                    const existing = await this.db.getEnv(project.id, key);
                    const encrypted = this.pk.encrypt(value, `${project.id}:${key}`);
                    if (existing) {
                        await this.db.updateEnv(project.id, key, encrypted);
                    }
                    else {
                        await this.db.createEnv(project.id, key, encrypted);
                    }
                    send({ type: 'set_response', payload: { success: true } });
                    break;
                }
                case 'ping':
                    send({ type: 'pong' });
                    break;
                default:
                    send({ type: 'get_response', payload: { error: 'Unknown message type', code: humanenv_shared_1.ErrorCode.SERVER_INTERNAL_ERROR } });
            }
        });
        ws.on('close', () => {
            // cleanup
        });
    }
    handleAdminMessage(ws, msg) {
        switch (msg.type) {
            case 'whitelist_response': {
                const { fingerprint, approved } = msg.payload;
                // We need projectId and fingerprint to update - admin sends this via REST actually
                // For simplicity, this WS channel just notifies the admin; the actual approve/reject
                // is done via REST API which calls db.updateWhitelistStatus()
                // We can broadcast the decision if needed
                break;
            }
            case 'apikey_response': {
                const { reqId, approved, projectName } = msg.payload;
                this.resolvePending(reqId, { approved, projectName });
                break;
            }
        }
    }
}
exports.WsRouter = WsRouter;
//# sourceMappingURL=router.js.map