"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockWebSocket = void 0;
exports.makeClient = makeClient;
exports.injectMockWs = injectMockWs;
const ws_manager_ts_1 = require("../src/ws-manager.ts");
class MockWebSocket {
    constructor() {
        this.readyState = 1;
        this.handlers = {};
        this.sentMessages = [];
        this.closed = false;
    }
    on(event, handler) {
        if (!this.handlers[event])
            this.handlers[event] = [];
        this.handlers[event].push(handler);
    }
    send(data) {
        this.sentMessages.push(data);
    }
    close() {
        this.closed = true;
    }
    trigger(event, data) {
        (this.handlers[event] || []).forEach(h => h(data));
    }
    lastSent() {
        return JSON.parse(this.sentMessages[this.sentMessages.length - 1]);
    }
}
exports.MockWebSocket = MockWebSocket;
MockWebSocket.OPEN = 1;
function makeClient(overrides = {}) {
    return new ws_manager_ts_1.HumanEnvClient({
        serverUrl: 'http://localhost:3056',
        projectName: 'test-project',
        projectApiKey: 'test-key',
        ...overrides,
    });
}
function injectMockWs(client, ws, opts = {}) {
    ;
    client.ws = ws;
    client.connected = opts.connected ?? true;
    client.authenticated = opts.authenticated ?? true;
}
//# sourceMappingURL=ws-test-helpers.js.map