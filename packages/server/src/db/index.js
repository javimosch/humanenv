"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabase = createDatabase;
const sqlite_1 = require("./sqlite");
const mongo_1 = require("./mongo");
async function createDatabase(dataDir, mongoUri) {
    if (mongoUri) {
        try {
            const mongo = new mongo_1.MongoProvider(mongoUri);
            await mongo.connect();
            return { provider: mongo, active: 'mongodb' };
        }
        catch (e) {
            console.warn('WARN:', e.message + '\nFalling back to SQLite.');
        }
    }
    const sqlite = new sqlite_1.SqliteProvider(dataDir);
    await sqlite.connect();
    return { provider: sqlite, active: 'sqlite' };
}
//# sourceMappingURL=index.js.map