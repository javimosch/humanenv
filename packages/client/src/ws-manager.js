"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HumanEnvClient = void 0;
const shared_1 = require("./shared");
const ws_1 = __importDefault(require("ws"));
class HumanEnvClient {
    get whitelistStatus() {
        return this._whitelistStatus;
    }
    constructor(config) {
        this.ws = null;
        this.connected = false;
        this.authenticated = false;
        this._whitelistStatus = null;
        this.attempts = 0;
        this.pending = new Map();
        this.retryTimer = null;
        this.pingTimer = null;
        this.reconnecting = false;
        this.disconnecting = false;
        this._authResolve = null;
        this._authReject = null;
        this.config = {
            serverUrl: config.serverUrl,
            projectName: config.projectName,
            projectApiKey: config.projectApiKey || '',
            maxRetries: config.maxRetries ?? 10,
        };
    }
    getFingerprint() {
        return (0, shared_1.generateFingerprint)();
    }
    async connect() {
        return new Promise((resolve, reject) => {
            this.doConnect(resolve, reject);
        });
    }
    doConnect(resolve, reject) {
        const proto = this.config.serverUrl.startsWith('https') ? 'wss' : 'ws';
        const host = this.config.serverUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        const url = `${proto}://${host}/ws`;
        this.ws = new ws_1.default(url);
        this.ws.on('open', () => {
            this.connected = true;
            this.attempts = 0;
            this.reconnecting = false;
            this.startPing();
            this.sendAuth(resolve, reject);
        });
        this.ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                this.handleMessage(msg);
            }
            catch { /* ignore */ }
        });
        this.ws.on('close', () => {
            this.connected = false;
            this.authenticated = false;
            this.stopPing();
            if (!this.disconnecting && !this.reconnecting)
                this.scheduleReconnect(reject);
        });
        this.ws.on('error', () => { });
    }
    sendAuth(resolve, reject) {
        this._authResolve = resolve;
        this._authReject = reject;
        this.ws?.send(JSON.stringify({
            type: 'auth',
            payload: {
                projectName: this.config.projectName,
                apiKey: this.config.projectApiKey,
                fingerprint: this.getFingerprint(),
            }
        }));
    }
    handleMessage(msg) {
        if (msg.type === 'auth_response') {
            if (msg.payload.success) {
                this.authenticated = true;
                this._whitelistStatus = msg.payload.status || (msg.payload.whitelisted ? 'approved' : 'pending');
                this._authResolve?.();
            }
            else {
                this._authReject?.(new shared_1.HumanEnvError(msg.payload.code, msg.payload.error));
            }
            this._authResolve = null;
            this._authReject = null;
            return;
        }
        if (msg.type === 'get_response') {
            this._resolvePending('get', msg.payload);
            return;
        }
        if (msg.type === 'set_response') {
            this._resolvePending('set', msg.payload);
            return;
        }
        if (msg.type === 'pong') { /* keep-alive */ }
    }
    _resolvePending(kind, payload) {
        for (const [id, op] of this.pending) {
            clearTimeout(op.timeout);
            this.pending.delete(id);
            if (payload.error) {
                op.reject(new shared_1.HumanEnvError(payload.code, payload.error));
            }
            else {
                op.resolve(payload);
            }
            return;
        }
    }
    async get(keyOrKeys) {
        if (!this.connected || !this.authenticated)
            throw new shared_1.HumanEnvError(shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
        if (Array.isArray(keyOrKeys)) {
            const result = {};
            await Promise.all(keyOrKeys.map(async (key) => {
                result[key] = await this._getSingle(key);
            }));
            return result;
        }
        return this._getSingle(keyOrKeys);
    }
    _getSingle(key) {
        return new Promise((resolve, reject) => {
            const msgId = `${key}-${Date.now()}`;
            const timeout = setTimeout(() => {
                this.pending.delete(msgId);
                reject(new Error(`Timeout getting env: ${key}`));
            }, 8000);
            this.pending.set(msgId, { resolve: (v) => resolve(v.value), reject, timeout });
            this.ws?.send(JSON.stringify({ type: 'get', payload: { key } }));
        });
    }
    async set(key, value) {
        if (!this.connected || !this.authenticated)
            throw new shared_1.HumanEnvError(shared_1.ErrorCode.CLIENT_AUTH_INVALID_API_KEY);
        const msgId = `set-${Date.now()}`;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(msgId);
                reject(new Error(`Timeout setting env: ${key}`));
            }, 8000);
            this.pending.set(msgId, { resolve, reject, timeout });
            this.ws?.send(JSON.stringify({ type: 'set', payload: { key, value } }));
        });
    }
    scheduleReconnect(reject) {
        if (this.attempts >= this.config.maxRetries) {
            reject(new shared_1.HumanEnvError(shared_1.ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED));
            return;
        }
        this.reconnecting = true;
        this.attempts++;
        const delay = Math.min(1000 * Math.pow(2, this.attempts - 1), 30000);
        if (process.stdout.isTTY) {
            console.error(`[humanenv] Reconnecting in ${delay}ms (attempt ${this.attempts}/${this.config.maxRetries})...`);
        }
        this.retryTimer = setTimeout(() => {
            this.doConnect(() => { }, reject);
        }, delay);
    }
    startPing() {
        this.stopPing();
        this.pingTimer = setInterval(() => {
            if (this.ws?.readyState === ws_1.default.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }
    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
    /** Connect (creates fresh WS) and waits for auth response up to `timeoutMs`. Resolves silently on timeout. */
    async connectAndWaitForAuth(timeoutMs) {
        return new Promise((resolve) => {
            // If already connected and authenticated, resolve immediately
            if (this.connected && this.authenticated) {
                resolve();
                return;
            }
            const deadline = Date.now() + timeoutMs;
            const checkInterval = setInterval(() => {
                if (this.connected && this.authenticated) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                if (Date.now() >= deadline) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
            }, 200);
            // If not connected, establish connection
            if (!this.connected) {
                this.attempts = 0;
                this.doConnect(() => {
                    // connected, now waiting for auth
                }, () => {
                    clearInterval(checkInterval);
                    resolve();
                });
            }
        });
    }
    disconnect() {
        this.stopPing();
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this.disconnecting = true;
        this.reconnecting = false;
        this.ws?.close();
    }
}
exports.HumanEnvClient = HumanEnvClient;
//# sourceMappingURL=ws-manager.js.map