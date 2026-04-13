"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockDb = createMockDb;
exports.createMockPk = createMockPk;
exports.startApp = startApp;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
function createMockDb() {
    return {
        connect: async () => { },
        disconnect: async () => { },
        createProject: async () => ({ id: 'proj-1' }),
        getProject: async () => null,
        listProjects: async () => [],
        deleteProject: async () => { },
        updateProject: async () => { },
        createEnv: async () => ({ id: 'env-1' }),
        getEnv: async () => null,
        listEnvs: async () => [],
        listEnvsWithValues: async () => [],
        updateEnv: async () => { },
        deleteEnv: async () => { },
        createApiKey: async () => ({ id: 'key-1' }),
        getApiKey: async () => null,
        listApiKeys: async () => [],
        revokeApiKey: async () => { },
        updateApiKeyLastUsed: async () => { },
        createWhitelistEntry: async () => ({ id: 'wl-1' }),
        getWhitelistEntry: async () => null,
        listWhitelistEntries: async () => [],
        updateWhitelistStatus: async () => { },
        storePkHash: async () => { },
        getPkHash: async () => null,
        storeGlobalSetting: async () => { },
        getGlobalSetting: async () => null,
    };
}
function createMockPk() {
    return {
        encrypt: (value, _aad) => `enc:${value}`,
        decrypt: (encrypted, _aad) => encrypted.replace('enc:', ''),
    };
}
function startApp(setupRoutes) {
    return new Promise((resolve) => {
        const app = (0, express_1.default)();
        app.use(express_1.default.json());
        setupRoutes(app);
        const server = http_1.default.createServer(app);
        server.listen(0, () => {
            const addr = server.address();
            resolve({ server, base: `http://127.0.0.1:${addr.port}` });
        });
    });
}
//# sourceMappingURL=route-test-helpers.js.map