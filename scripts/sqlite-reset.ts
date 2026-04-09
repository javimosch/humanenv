const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')

const dbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'humanenv.db')
  : path.join(os.homedir(), '.humanenv', 'humanenv.db')

const db = new Database(dbPath)

console.log('Resetting SQLite database:', dbPath)

db.exec(`
  DELETE FROM server_config;
  DELETE FROM projects;
  DELETE FROM envs;
  DELETE FROM api_keys;
  DELETE FROM whitelist;
`)

console.log('All data reset - database is clean')

db.close()
process.exit(0)
