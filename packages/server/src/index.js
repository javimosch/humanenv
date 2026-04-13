"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const pk_manager_1 = require("./pk-manager");
const db_1 = require("./db");
const auth_1 = require("./auth");
const routes_1 = require("./routes");
const router_1 = require("./ws/router");
// ============================================================
// Config resolution
// ============================================================
function parseIntOr(val, fallback) {
    if (!val)
        return fallback;
    const n = parseInt(val, 10);
    return isNaN(n) ? fallback : n;
}
const PORT = parseIntOr(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] ||
    process.argv[process.argv.indexOf('--port') + 1] ||
    process.env.PORT, 3056);
const BASIC_AUTH_ARG = process.argv.find(a => a.startsWith('--basicAuth'));
const dataDir = process.env.DATA_DIR || path_1.default.join(os_1.default.homedir(), '.humanenv');
const dbPath = path_1.default.join(dataDir, 'humanenv.db');
if (!fs_1.default.existsSync(dataDir))
    fs_1.default.mkdirSync(dataDir, { recursive: true });
// ============================================================
// App bootstrap
// ============================================================
async function main() {
    console.log('Starting HumanEnv server...');
    console.log('Data directory:', dataDir);
    // Database
    const mongoUri = process.env.MONGODB_URI;
    const { provider: db, active: activeDb } = await (0, db_1.createDatabase)(dbPath, mongoUri);
    console.log('Database:', activeDb);
    // PK Manager
    const pk = new pk_manager_1.PkManager();
    const storedHash = await db.getPkHash();
    const bootstrapResult = await pk.bootstrap(storedHash, db);
    // App
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    app.use(express_1.default.json());
    // Basic auth for admin UI
    if (BASIC_AUTH_ARG) {
        const username = process.env.BASIC_AUTH_USERNAME || 'admin';
        const password = process.env.BASIC_AUTH_PASSWORD || 'admin';
        app.use((0, auth_1.createBasicAuthMiddleware)(username, password));
    }
    // WS Router
    const wsRouter = new router_1.WsRouter(server, db, pk);
    // REST routes
    app.use('/api/projects', (0, routes_1.createProjectsRouter)(db, pk));
    app.use('/api/envs', (0, routes_1.createEnvsRouter)(db, pk));
    app.use('/api/apikeys', (0, routes_1.createApiKeysRouter)(db, pk));
    app.use('/api/whitelist', (0, routes_1.createWhitelistRouter)(db));
    app.use('/api/global', (0, routes_1.createGlobalSettingsRouter)(db));
    // PK setup endpoints
    app.post('/api/pk/setup', async (req, res) => {
        const { mnemonic } = req.body || {};
        if (!mnemonic)
            return res.status(400).json({ error: 'mnemonic required' });
        try {
            const result = pk.submitMnemonic(mnemonic, storedHash);
            await db.storePkHash(result.hash);
            res.json({ ok: true, firstSetup: result.firstSetup });
        }
        catch (e) {
            res.status(400).json({ error: e.message });
        }
    });
    app.get('/api/pk/generate', (_req, res) => {
        const mnemonic = pk.getMnemonic();
        res.json({ mnemonic });
    });
    app.get('/api/pk/status', (_req, res) => {
        res.json({ ready: pk.isReady(), existing: bootstrapResult.existing });
    });
    // Serve admin UI
    app.get('/', (_req, res) => {
        const status = pk.isReady() ? 'ready' : bootstrapResult.status === 'needs_input' ? 'needs-pk' : 'ready';
        const existing = bootstrapResult.existing || 'hash';
        console.log('pk status for ejs:', status, existing);
        res.render('index', {
            pkStatus: status,
            existing: existing,
            activeDb: activeDb,
            pkVerified: pk.isReady(),
        });
    });
    app.set('view engine', 'ejs');
    app.set('views', path_1.default.join(__dirname, 'views'));
    const shutdown = async (signal) => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        await pk.saveTemporalPk();
        server.close(() => {
            process.exit(0);
        });
        setTimeout(() => {
            console.error('Forced exit after timeout');
            process.exit(1);
        }, 5000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    // Start
    server.listen(PORT, () => {
        console.log('HumanEnv server listening on port', PORT);
        console.log('Admin UI:', `http://localhost:${PORT}`);
        if (!pk.isReady())
            console.log('WARNING: PK not loaded. Admin must enter mnemonic to activate server.');
    });
}
main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
//# sourceMappingURL=index.js.map