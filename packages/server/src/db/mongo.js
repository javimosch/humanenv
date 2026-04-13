"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoProvider = void 0;
const mongodb_1 = require("mongodb");
const humanenv_shared_1 = require("humanenv-shared");
const node_crypto_1 = __importDefault(require("node:crypto"));
const COLLECTIONS = {
    projects: 'projects',
    envs: 'envs',
    apiKeys: 'apiKeys',
    whitelist: 'whitelist',
    serverConfig: 'serverConfig',
};
class MongoProvider {
    constructor(uri) {
        this.uri = uri;
        this.client = null;
        this.db = null;
        this.reconnectInterval = null;
    }
    async connect() {
        this.client = new mongodb_1.MongoClient(this.uri);
        await this.client.connect();
        this.db = this.client.db('humanenv');
        this.initIndexes();
    }
    async disconnect() {
        if (this.reconnectInterval)
            clearInterval(this.reconnectInterval);
        if (this.client)
            await this.client.close();
    }
    initIndexes() {
        const d = this.db;
        d.collection(COLLECTIONS.projects).createIndex({ name: 1 }, { unique: true });
        d.collection(COLLECTIONS.envs).createIndex({ projectId: 1, key: 1 }, { unique: true });
        d.collection(COLLECTIONS.apiKeys).createIndex({ projectId: 1, lookupHash: 1 }, { unique: true });
        d.collection(COLLECTIONS.whitelist).createIndex({ projectId: 1, fingerprint: 1 }, { unique: true });
        d.collection(COLLECTIONS.serverConfig).createIndex({ key: 1 }, { unique: true });
    }
    async createProject(name) {
        const doc = { id: node_crypto_1.default.randomUUID(), name, createdAt: Date.now() };
        await this.col('projects').insertOne(doc);
        return { id: doc.id };
    }
    async getProject(name) {
        const doc = await this.col('projects').findOne({ name });
        return doc ? { id: doc.id, name: doc.name, createdAt: doc.createdAt, fingerprintVerification: doc.fingerprintVerification !== false, requireApiKey: !!doc.requireApiKey } : null;
    }
    async listProjects() {
        return await this.col('projects').find({}).sort({ createdAt: -1 }).toArray();
    }
    async deleteProject(id) {
        await this.col('projects').deleteOne({ id });
        await this.col('envs').deleteMany({ projectId: id });
        await this.col('apiKeys').deleteMany({ projectId: id });
        await this.col('whitelist').deleteMany({ projectId: id });
    }
    async updateProject(id, data) {
        const $set = {};
        if (data.name !== undefined)
            $set.name = data.name;
        if (data.fingerprintVerification !== undefined)
            $set.fingerprintVerification = data.fingerprintVerification;
        if (data.requireApiKey !== undefined)
            $set.requireApiKey = data.requireApiKey;
        if (Object.keys($set).length)
            await this.col('projects').updateOne({ id }, { $set });
    }
    async createEnv(projectId, key, encryptedValue) {
        const id = node_crypto_1.default.randomUUID();
        const doc = { id, projectId, key, encryptedValue, createdAt: Date.now() };
        await this.col('envs').updateOne({ projectId, key }, { $set: doc }, { upsert: true });
        return { id };
    }
    async getEnv(projectId, key) {
        const doc = await this.col('envs').findOne({ projectId, key });
        return doc ? { encryptedValue: doc.encryptedValue } : null;
    }
    async listEnvs(projectId) {
        const docs = await this.col('envs').find({ projectId }).sort({ key: 1 }).toArray();
        return docs.map(d => ({ id: d.id, key: d.key, createdAt: d.createdAt }));
    }
    async listEnvsWithValues(projectId) {
        const docs = await this.col('envs').find({ projectId }).sort({ key: 1 }).toArray();
        return docs.map(d => ({ id: d.id, key: d.key, encryptedValue: d.encryptedValue, createdAt: d.createdAt }));
    }
    async updateEnv(projectId, key, encryptedValue) {
        await this.col('envs').updateOne({ projectId, key }, { $set: { encryptedValue } });
    }
    async deleteEnv(projectId, key) {
        await this.col('envs').deleteOne({ projectId, key });
    }
    async createApiKey(projectId, encryptedValue, plainValue, ttl, name) {
        const id = node_crypto_1.default.randomUUID();
        const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
        const lookupHash = node_crypto_1.default.createHash('sha256').update(plainValue).digest('hex');
        const doc = { id, projectId, name: name ?? null, encryptedValue, lookupHash, ttl: ttl ?? null, expiresAt: expiresAt ?? null, createdAt: Date.now() };
        await this.col('apiKeys').insertOne(doc);
        return { id };
    }
    async getApiKey(projectId, plainValue) {
        const lookupHash = node_crypto_1.default.createHash('sha256').update(plainValue).digest('hex');
        const doc = await this.col('apiKeys').findOne({ projectId, lookupHash });
        if (!doc)
            return null;
        if (doc.expiresAt && doc.expiresAt < Date.now())
            return null;
        return { id: doc.id, expiresAt: doc.expiresAt };
    }
    async listApiKeys(projectId) {
        const docs = await this.col('apiKeys').find({ projectId }).sort({ createdAt: -1 }).toArray();
        return docs.map(d => ({
            id: d.id,
            name: d.name || undefined,
            maskedPreview: d.lookupHash.slice(0, 8) + '...',
            ttl: d.ttl,
            expiresAt: d.expiresAt,
            lastUsed: d.lastUsed ?? undefined,
            createdAt: d.createdAt,
        }));
    }
    async revokeApiKey(projectId, id) {
        await this.col('apiKeys').deleteOne({ id, projectId });
    }
    async updateApiKeyLastUsed(id, timestamp) {
        await this.col('apiKeys').updateOne({ id }, { $set: { lastUsed: timestamp } });
    }
    async createWhitelistEntry(projectId, fingerprint, status) {
        const doc = { id: node_crypto_1.default.randomUUID(), projectId, fingerprint, status, createdAt: Date.now() };
        await this.col('whitelist').updateOne({ projectId, fingerprint }, { $set: doc }, { upsert: true });
        return { id: doc.id };
    }
    async getWhitelistEntry(projectId, fingerprint) {
        const doc = await this.col('whitelist').findOne({ projectId, fingerprint });
        return doc ? { id: doc.id, status: doc.status } : null;
    }
    async listWhitelistEntries(projectId) {
        return await this.col('whitelist').find({ projectId }).sort({ createdAt: -1 }).toArray();
    }
    async updateWhitelistStatus(id, status) {
        await this.col('whitelist').updateOne({ id }, { $set: { status } });
    }
    async storePkHash(hash) {
        await this.col('serverConfig').updateOne({ key: 'pk_hash' }, { $set: { key: 'pk_hash', value: hash } }, { upsert: true });
    }
    async getPkHash() {
        const doc = await this.col('serverConfig').findOne({ key: 'pk_hash' });
        return doc?.value ?? null;
    }
    async storeGlobalSetting(key, value) {
        await this.col('serverConfig').updateOne({ key }, { $set: { key, value } }, { upsert: true });
    }
    async getGlobalSetting(key) {
        const doc = await this.col('serverConfig').findOne({ key });
        return doc?.value ?? null;
    }
    col(name) {
        if (!this.db)
            throw new humanenv_shared_1.HumanEnvError(humanenv_shared_1.ErrorCode.DB_OPERATION_FAILED, 'MongoDB not connected');
        return this.db.collection(name);
    }
}
exports.MongoProvider = MongoProvider;
//# sourceMappingURL=mongo.js.map