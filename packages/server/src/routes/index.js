"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProjectsRouter = createProjectsRouter;
exports.createEnvsRouter = createEnvsRouter;
exports.createApiKeysRouter = createApiKeysRouter;
exports.createWhitelistRouter = createWhitelistRouter;
exports.createGlobalSettingsRouter = createGlobalSettingsRouter;
const express_1 = require("express");
const node_crypto_1 = __importDefault(require("node:crypto"));
function createProjectsRouter(db, pk) {
    const router = (0, express_1.Router)();
    router.get('/', async (_req, res) => {
        const projects = await db.listProjects();
        res.json(projects);
    });
    router.post('/', async (req, res) => {
        const { name } = req.body || {};
        if (!name || typeof name !== 'string')
            return res.status(400).json({ error: 'name required' });
        const existing = await db.getProject(name);
        if (existing)
            return res.status(409).json({ error: 'Project already exists' });
        const result = await db.createProject(name);
        res.status(201).json({ id: result.id });
    });
    router.put('/:id', async (req, res) => {
        const { name, fingerprintVerification, requireApiKey } = req.body || {};
        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ error: 'name must be a non-empty string' });
            }
            const existing = await db.getProject(name.trim());
            if (existing && existing.id !== req.params.id) {
                return res.status(409).json({ error: 'Project name already exists' });
            }
        }
        await db.updateProject(req.params.id, { name: name?.trim(), fingerprintVerification, requireApiKey });
        res.json({ ok: true });
    });
    router.delete('/:id', async (req, res) => {
        await db.deleteProject(req.params.id);
        res.json({ ok: true });
    });
    return router;
}
function createEnvsRouter(db, pk) {
    const router = (0, express_1.Router)();
    router.get('/project/:projectId', async (req, res) => {
        const envs = await db.listEnvs(req.params.projectId);
        res.json(envs);
    });
    // Bulk decrypt all envs for .env export - must be defined before /project/:projectId/:key
    router.get('/project/:projectId/all', async (req, res) => {
        const envs = await db.listEnvsWithValues(req.params.projectId);
        const result = {};
        for (const env of envs) {
            const decrypted = pk.decrypt(env.encryptedValue, `${req.params.projectId}:${env.key}`);
            result[env.key] = decrypted;
        }
        res.json(result);
    });
    router.get('/project/:projectId/:key', async (req, res) => {
        const key = decodeURIComponent(req.params.key);
        const env = await db.getEnv(req.params.projectId, key);
        if (!env)
            return res.status(404).json({ error: 'Env not found' });
        const decrypted = pk.decrypt(env.encryptedValue, `${req.params.projectId}:${key}`);
        res.json({ key, value: decrypted });
    });
    router.post('/project/:projectId', async (req, res) => {
        const { key, value } = req.body || {};
        if (!key || value === undefined)
            return res.status(400).json({ error: 'key and value required' });
        const encrypted = pk.encrypt(value, `${req.params.projectId}:${key}`);
        const result = await db.createEnv(req.params.projectId, key, encrypted);
        res.status(201).json({ id: result.id });
    });
    router.put('/project/:projectId', async (req, res) => {
        const { key, value } = req.body || {};
        if (!key || value === undefined)
            return res.status(400).json({ error: 'key and value required' });
        const encrypted = pk.encrypt(value, `${req.params.projectId}:${key}`);
        await db.updateEnv(req.params.projectId, key, encrypted);
        res.json({ ok: true });
    });
    router.delete('/project/:projectId/:key', async (req, res) => {
        await db.deleteEnv(req.params.projectId, decodeURIComponent(req.params.key));
        res.json({ ok: true });
    });
    return router;
}
function createApiKeysRouter(db, pk) {
    const router = (0, express_1.Router)();
    router.get('/project/:projectId', async (req, res) => {
        const keys = await db.listApiKeys(req.params.projectId);
        res.json(keys);
    });
    router.post('/project/:projectId', async (req, res) => {
        const { plainKey, ttl, name } = req.body || {};
        const keyToStore = plainKey || node_crypto_1.default.randomUUID();
        const encrypted = pk.encrypt(keyToStore, `${req.params.projectId}:apikey:${keyToStore.slice(0, 8)}`);
        const result = await db.createApiKey(req.params.projectId, encrypted, keyToStore, ttl, name);
        res.status(201).json({ id: result.id, plainKey: keyToStore });
    });
    router.delete('/project/:projectId/:id', async (req, res) => {
        await db.revokeApiKey(req.params.projectId, req.params.id);
        res.json({ ok: true });
    });
    return router;
}
function createWhitelistRouter(db) {
    const router = (0, express_1.Router)();
    router.get('/project/:projectId', async (req, res) => {
        const entries = await db.listWhitelistEntries(req.params.projectId);
        res.json(entries);
    });
    router.post('/project/:projectId', async (req, res) => {
        const { fingerprint, status } = req.body || {};
        if (!fingerprint)
            return res.status(400).json({ error: 'fingerprint required' });
        const result = await db.createWhitelistEntry(req.params.projectId, fingerprint, status || 'approved');
        res.status(201).json({ id: result.id });
    });
    router.put('/project/:projectId/:id', async (req, res) => {
        const { status } = req.body || {};
        if (!status || !['approved', 'rejected'].includes(status))
            return res.status(400).json({ error: 'status must be approved or rejected' });
        await db.updateWhitelistStatus(req.params.id, status);
        res.json({ ok: true });
    });
    return router;
}
function createGlobalSettingsRouter(db) {
    const router = (0, express_1.Router)();
    router.get('/:key', async (req, res) => {
        const value = await db.getGlobalSetting(req.params.key);
        res.json({ value });
    });
    router.put('/:key', async (req, res) => {
        const { value } = req.body || {};
        if (value === undefined)
            return res.status(400).json({ error: 'value required' });
        await db.storeGlobalSetting(req.params.key, String(value));
        res.json({ ok: true });
    });
    return router;
}
//# sourceMappingURL=index.js.map