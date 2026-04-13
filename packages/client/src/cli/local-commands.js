"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureLocalDb = ensureLocalDb;
exports.authenticateMnemonic = authenticateMnemonic;
exports.authenticateFromEnv = authenticateFromEnv;
exports.promptMnemonic = promptMnemonic;
exports.getOrCreateSession = getOrCreateSession;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.runLocalInit = runLocalInit;
exports.runLocalGet = runLocalGet;
exports.runLocalSet = runLocalSet;
exports.runLocalProjects = runLocalProjects;
exports.runLocalEnvs = runLocalEnvs;
exports.runLocalApiKeys = runLocalApiKeys;
exports.runLocalWhitelist = runLocalWhitelist;
exports.runLocalExport = runLocalExport;
exports.runLocalImport = runLocalImport;
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const humanenv_shared_1 = require("humanenv-shared");
const humanenv_shared_2 = require("humanenv-shared");
const inquirer_1 = __importDefault(require("inquirer"));
const LOCAL_DB_DIR = node_path_1.default.join(node_os_1.default.homedir(), '.humanenv');
const LOCAL_DB_PATH = node_path_1.default.join(LOCAL_DB_DIR, 'data.db');
const LOCK_FILE_PATH = node_path_1.default.join(LOCAL_DB_DIR, '.lock');
const MAX_AUTH_ATTEMPTS = 3;
const LOCK_DURATION_MS = 60 * 1000;
function getLockInfo() {
    if (!node_fs_1.default.existsSync(LOCK_FILE_PATH))
        return { attempts: 0 };
    try {
        const content = node_fs_1.default.readFileSync(LOCK_FILE_PATH, 'utf8');
        const data = JSON.parse(content);
        if (data.lockedUntil && Date.now() < data.lockedUntil) {
            return { attempts: data.attempts, lockedUntil: data.lockedUntil };
        }
        node_fs_1.default.unlinkSync(LOCK_FILE_PATH);
        return { attempts: 0 };
    }
    catch {
        return { attempts: 0 };
    }
}
function incrementLockAttempts() {
    const lock = getLockInfo();
    const attempts = (lock.attempts || 0) + 1;
    if (attempts >= MAX_AUTH_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCK_DURATION_MS;
        node_fs_1.default.writeFileSync(LOCK_FILE_PATH, JSON.stringify({ attempts, lockedUntil }), { mode: 0o600 });
        return { attempts, lockedUntil };
    }
    node_fs_1.default.writeFileSync(LOCK_FILE_PATH, JSON.stringify({ attempts }), { mode: 0o600 });
    return { attempts };
}
function clearLock() {
    if (node_fs_1.default.existsSync(LOCK_FILE_PATH)) {
        node_fs_1.default.unlinkSync(LOCK_FILE_PATH);
    }
}
function isLocked() {
    const lock = getLockInfo();
    if (lock.lockedUntil) {
        const remainingMs = lock.lockedUntil - Date.now();
        return { locked: remainingMs > 0, remainingMs };
    }
    return { locked: false };
}
async function ensureLocalDb() {
    if (!node_fs_1.default.existsSync(LOCAL_DB_DIR)) {
        node_fs_1.default.mkdirSync(LOCAL_DB_DIR, { recursive: true });
    }
    const db = new humanenv_shared_1.LocalDatabase(LOCAL_DB_PATH);
    await db.connect();
    return db;
}
async function authenticateMnemonic(mnemonic, db) {
    const lockStatus = isLocked();
    if (lockStatus.locked) {
        const secs = Math.ceil((lockStatus.remainingMs || 0) / 1000);
        return {
            success: false,
            error: `Too many failed attempts. Try again in ${secs} seconds.`,
            hint: `Remove ${LOCK_FILE_PATH} if you're the admin and need to reset urgently.`
        };
    }
    if (!mnemonic || !(0, humanenv_shared_2.validateMnemonic)(mnemonic)) {
        const lock = incrementLockAttempts();
        if (lock.lockedUntil) {
            const secs = Math.ceil((lock.lockedUntil - Date.now()) / 1000);
            return {
                success: false,
                error: `Invalid mnemonic. Locked for ${secs} seconds.`,
                hint: `Remove ${LOCK_FILE_PATH} if you're the admin and need to reset urgently.`
            };
        }
        return {
            success: false,
            error: 'Invalid mnemonic. Must be a 12-word BIP39 phrase.',
            hint: `Attempts: ${lock.attempts}/${MAX_AUTH_ATTEMPTS}`
        };
    }
    const storedHash = await db.getPkHash();
    const pk = (0, humanenv_shared_2.derivePkFromMnemonic)(mnemonic);
    const derivedHash = (0, humanenv_shared_2.hashPkForVerification)(pk);
    if (storedHash && derivedHash !== storedHash) {
        const lock = incrementLockAttempts();
        return {
            success: false,
            error: 'Mnemonic does not match the stored key.',
            hint: lock.lockedUntil
                ? `Locked for ${Math.ceil((lock.lockedUntil - Date.now()) / 1000)} seconds.`
                : `Attempts: ${lock.attempts}/${MAX_AUTH_ATTEMPTS}`
        };
    }
    clearLock();
    return { success: true };
}
async function authenticateFromEnv(db) {
    const mnemonicEnv = process.env.HUMANENV_LOCAL_MNEMONIC;
    if (!mnemonicEnv) {
        return { success: false, error: 'HUMANENV_LOCAL_MNEMONIC not set', hint: 'Run: export HUMANENV_LOCAL_MNEMONIC="your 12-word mnemonic"' };
    }
    const result = await authenticateMnemonic(mnemonicEnv, db);
    if (!result.success)
        return result;
    const pk = (0, humanenv_shared_2.derivePkFromMnemonic)(mnemonicEnv);
    return { success: true, pk, mnemonic: mnemonicEnv };
}
async function promptMnemonic(db, isInteractive) {
    const lockStatus = isLocked();
    if (lockStatus.locked) {
        const secs = Math.ceil((lockStatus.remainingMs || 0) / 1000);
        return {
            success: false,
            error: `Locked. Try again in ${secs} seconds.`,
            hint: `Remove ${LOCK_FILE_PATH} if you're the admin and need to reset urgently.`
        };
    }
    if (!isInteractive) {
        return { success: false, error: 'HUMANENV_LOCAL_MNEMONIC not set', hint: 'Run: export HUMANENV_LOCAL_MNEMONIC="your 12-word mnemonic"' };
    }
    const { mnemonic } = await inquirer_1.default.prompt([
        {
            type: 'password',
            name: 'mnemonic',
            message: 'Enter your 12-word mnemonic:',
            mask: '*',
            validate: (input) => {
                const words = input.trim().toLowerCase().split(/\s+/);
                if (words.length !== 12)
                    return 'Must be exactly 12 words';
                const valid = words.every(w => /^[a-z]+$/.test(w));
                if (!valid)
                    return 'All words must be lowercase letters only';
                return true;
            }
        }
    ]);
    const result = await authenticateMnemonic(mnemonic, db);
    if (!result.success)
        return result;
    const pk = (0, humanenv_shared_2.derivePkFromMnemonic)(mnemonic);
    console.log('\n✓ Authenticated. Run this command to export your mnemonic:');
    console.log(`  export HUMANENV_LOCAL_MNEMONIC="${mnemonic}"`);
    console.log('');
    return { success: true, pk, mnemonic };
}
async function getOrCreateSession(isInteractive) {
    const db = await ensureLocalDb();
    let authResult = await authenticateFromEnv(db);
    if (!authResult.success) {
        if (isInteractive) {
            authResult = await promptMnemonic(db, isInteractive);
        }
        if (!authResult.success) {
            await db.disconnect();
            if (isInteractive) {
                console.error('Error:', authResult.error);
                if (authResult.hint)
                    console.error('Hint:', authResult.hint);
            }
            return null;
        }
    }
    const pk = authResult.pk;
    const mnemonic = authResult.mnemonic;
    const projects = await db.listProjects();
    return { db, pk, mnemonic, projectId: null, projectName: null };
}
function encrypt(value, pk, projectId, key) {
    return (0, humanenv_shared_2.encryptWithPk)(value, pk, `${projectId}:${key}`);
}
function decrypt(encryptedValue, pk, projectId, key) {
    return (0, humanenv_shared_2.decryptWithPk)(encryptedValue, pk, `${projectId}:${key}`);
}
async function runLocalInit(mnemonic, isInteractive = false, force = false) {
    const existingDb = node_fs_1.default.existsSync(LOCAL_DB_PATH);
    if (existingDb && !force) {
        console.error('Error: Database already exists at ~/.humanenv/data.db');
        console.error('Use --force to reset the database, or manually delete it first.');
        process.exit(1);
    }
    if (existingDb && force) {
        if (isInteractive) {
            const { confirmReset } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirmReset',
                    message: 'Database exists. Reset it? This will delete ALL data.',
                    default: false
                }
            ]);
            if (!confirmReset) {
                console.log('Cancelled.');
                return;
            }
        }
        node_fs_1.default.unlinkSync(LOCAL_DB_PATH);
        console.log('Existing database deleted.');
    }
    const db = await ensureLocalDb();
    if (mnemonic) {
        const result = await authenticateMnemonic(mnemonic, db);
        if (!result.success) {
            console.error('Error:', result.error);
            await db.disconnect();
            process.exit(1);
        }
    }
    else if (isInteractive) {
        const { useExisting } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'useExisting',
                message: 'Do you have an existing mnemonic?',
                default: false
            }
        ]);
        if (useExisting) {
            const { enteredMnemonic } = await inquirer_1.default.prompt([
                {
                    type: 'password',
                    name: 'enteredMnemonic',
                    message: 'Enter your 12-word mnemonic:',
                    mask: '*'
                }
            ]);
            const enteredMn = enteredMnemonic;
            const result = await authenticateMnemonic(enteredMn, db);
            if (!result.success) {
                console.error('Error:', result.error);
                await db.disconnect();
                process.exit(1);
            }
        }
    }
    mnemonic = mnemonic || generateMnemonicWords();
    const pk = (0, humanenv_shared_2.derivePkFromMnemonic)(mnemonic);
    const hash = (0, humanenv_shared_2.hashPkForVerification)(pk);
    await db.storePkHash(hash);
    if (isInteractive) {
        const { projectName } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'projectName',
                message: 'Enter a name for your first project:',
                default: 'default',
                validate: (input) => {
                    if (!input.trim())
                        return 'Project name cannot be empty';
                    if (input.length > 50)
                        return 'Project name too long';
                    return true;
                }
            }
        ]);
        await db.createProject(projectName);
        console.log(`\n✓ Created project "${projectName}"`);
    }
    else {
        const project = await db.createProject('default');
        console.log('\n✓ Created default project');
    }
    console.log('\n✓ Local database initialized at ~/.humanenv/data.db');
    console.log('\nYour mnemonic is:');
    console.log(`  ${mnemonic}`);
    console.log('\n⚠️  Save this mnemonic securely! It cannot be recovered.');
    console.log('\nRun this command to export your mnemonic:');
    console.log(`  export HUMANENV_LOCAL_MNEMONIC="${mnemonic}"`);
    console.log('');
    await db.disconnect();
}
function generateMnemonicWords() {
    return (0, humanenv_shared_2.generateMnemonic)();
}
async function runLocalGet(key, isInteractive) {
    const session = await getOrCreateSession(isInteractive);
    if (!session) {
        process.exit(1);
    }
    const projects = await session.db.listProjects();
    if (projects.length === 0) {
        console.error('Error: No projects found. Run "humanenv local init" first.');
        await session.db.disconnect();
        process.exit(1);
    }
    let projectId = projects[0].id;
    let projectName = projects[0].name;
    if (projects.length > 1) {
        if (!isInteractive) {
            console.error('Error: Multiple projects found. Use -i to select one.');
            await session.db.disconnect();
            process.exit(1);
        }
        const { selected } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'selected',
                message: 'Select a project:',
                choices: projects.map(p => ({ name: p.name, value: p.id }))
            }
        ]);
        projectId = selected;
        projectName = projects.find(p => p.id === projectId).name;
    }
    const env = await session.db.getEnv(projectId, key);
    if (!env) {
        console.error(`Error: Key "${key}" not found in project "${projectName}"`);
        await session.db.disconnect();
        process.exit(1);
    }
    const decrypted = decrypt(env.encryptedValue, session.pk, projectId, key);
    console.log(decrypted);
    await session.db.disconnect();
}
async function runLocalSet(key, value, isInteractive, force = false) {
    if (!isInteractive && !force) {
        console.error('Error: Setting env values in non-interactive mode requires --force flag.');
        console.error('Or run with -i to use interactive mode.');
        process.exit(1);
    }
    const session = await getOrCreateSession(isInteractive);
    if (!session) {
        process.exit(1);
    }
    if (!session) {
        process.exit(1);
    }
    const projects = await session.db.listProjects();
    if (projects.length === 0) {
        console.error('Error: No projects found. Run "humanenv local init" first.');
        await session.db.disconnect();
        process.exit(1);
    }
    let projectId = projects[0].id;
    let projectName = projects[0].name;
    if (projects.length > 1) {
        if (!isInteractive) {
            console.error('Error: Multiple projects found. Use -i to select one.');
            await session.db.disconnect();
            process.exit(1);
        }
        const { selected } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'selected',
                message: 'Select a project:',
                choices: projects.map(p => ({ name: p.name, value: p.id }))
            }
        ]);
        projectId = selected;
        projectName = projects.find(p => p.id === projectId).name;
    }
    const encrypted = encrypt(value, session.pk, projectId, key);
    const existing = await session.db.getEnv(projectId, key);
    if (existing) {
        if (isInteractive) {
            const { confirm } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Update existing key "${key}"?`,
                    default: true
                }
            ]);
            if (!confirm) {
                console.log('Cancelled.');
                await session.db.disconnect();
                return;
            }
        }
        await session.db.updateEnv(projectId, key, encrypted);
        console.log(`Updated ${key} in project "${projectName}"`);
    }
    else {
        await session.db.createEnv(projectId, key, encrypted);
        console.log(`Created ${key} in project "${projectName}"`);
    }
    await session.db.disconnect();
}
async function runLocalProjects(isInteractive) {
    const session = await getOrCreateSession(isInteractive);
    if (!session) {
        process.exit(1);
    }
    const projects = await session.db.listProjects();
    if (!isInteractive) {
        if (projects.length === 0) {
            console.log('[]');
            await session.db.disconnect();
            return;
        }
        console.log(JSON.stringify(projects, null, 2));
        await session.db.disconnect();
        return;
    }
    const choices = [
        { name: 'List projects', value: 'list' },
        { name: 'Add project', value: 'add' },
        { name: 'Delete project', value: 'delete' }
    ];
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices
        }
    ]);
    switch (action) {
        case 'list':
            if (projects.length === 0) {
                console.log('No projects found.');
            }
            else {
                console.log('\nProjects:');
                projects.forEach(p => {
                    console.log(`  - ${p.name} (${new Date(p.createdAt).toISOString()})`);
                });
            }
            break;
        case 'add':
            const { newName } = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'newName',
                    message: 'Enter project name:',
                    validate: (input) => {
                        if (!input.trim())
                            return 'Name cannot be empty';
                        if (projects.some(p => p.name === input))
                            return 'Project already exists';
                        return true;
                    }
                }
            ]);
            await session.db.createProject(newName);
            console.log(`\n✓ Created project "${newName}"`);
            break;
        case 'delete':
            if (projects.length === 0) {
                console.log('No projects to delete.');
                break;
            }
            const { selectedProject, confirmDelete } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedProject',
                    message: 'Select project to delete:',
                    choices: projects.map(p => ({ name: p.name, value: p.id }))
                },
                {
                    type: 'confirm',
                    name: 'confirmDelete',
                    message: 'Are you sure? This will delete all envs, api keys, and whitelist entries.',
                    default: false
                }
            ]);
            if (confirmDelete) {
                await session.db.deleteProject(selectedProject);
                console.log('\n✓ Deleted project');
            }
            else {
                console.log('Cancelled.');
            }
            break;
    }
    await session.db.disconnect();
}
async function runLocalEnvs(isInteractive) {
    const session = await getOrCreateSession(isInteractive);
    if (!session) {
        process.exit(1);
    }
    const projects = await session.db.listProjects();
    if (projects.length === 0) {
        console.error('Error: No projects found.');
        await session.db.disconnect();
        process.exit(1);
    }
    let projectId = projects[0].id;
    if (projects.length > 1) {
        const { selected } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'selected',
                message: 'Select a project:',
                choices: projects.map(p => ({ name: p.name, value: p.id }))
            }
        ]);
        projectId = selected;
    }
    const envs = await session.db.listEnvs(projectId);
    if (!isInteractive) {
        if (envs.length === 0) {
            console.log('[]');
        }
        else {
            console.log(JSON.stringify(envs, null, 2));
        }
        await session.db.disconnect();
        return;
    }
    const choices = [
        { name: 'List envs', value: 'list' },
        { name: 'Add/Update env', value: 'add' },
        { name: 'Delete env', value: 'delete' }
    ];
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices
        }
    ]);
    switch (action) {
        case 'list':
            if (envs.length === 0) {
                console.log('No envs found.');
            }
            else {
                console.log('\nEnvs:');
                envs.forEach(e => {
                    console.log(`  - ${e.key} (${new Date(e.createdAt).toISOString()})`);
                });
            }
            break;
        case 'add':
            const { envKey, envValue } = await inquirer_1.default.prompt([
                { type: 'input', name: 'envKey', message: 'Enter env key:' },
                { type: 'input', name: 'envValue', message: 'Enter env value:' }
            ]);
            const encrypted = encrypt(envValue, session.pk, projectId, envKey);
            const existing = await session.db.getEnv(projectId, envKey);
            if (existing) {
                await session.db.updateEnv(projectId, envKey, encrypted);
                console.log(`\n✓ Updated "${envKey}"`);
            }
            else {
                await session.db.createEnv(projectId, envKey, encrypted);
                console.log(`\n✓ Created "${envKey}"`);
            }
            break;
        case 'delete':
            if (envs.length === 0) {
                console.log('No envs to delete.');
                break;
            }
            const { selectedEnv, confirmDelete } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedEnv',
                    message: 'Select env to delete:',
                    choices: envs.map(e => ({ name: e.key, value: e.key }))
                },
                {
                    type: 'confirm',
                    name: 'confirmDelete',
                    message: 'Are you sure?',
                    default: false
                }
            ]);
            if (confirmDelete) {
                await session.db.deleteEnv(projectId, selectedEnv);
                console.log('\n✓ Deleted env');
            }
            else {
                console.log('Cancelled.');
            }
            break;
    }
    await session.db.disconnect();
}
async function runLocalApiKeys(isInteractive) {
    const session = await getOrCreateSession(isInteractive);
    if (!session) {
        process.exit(1);
    }
    const projects = await session.db.listProjects();
    if (projects.length === 0) {
        console.error('Error: No projects found.');
        await session.db.disconnect();
        process.exit(1);
    }
    let projectId = projects[0].id;
    if (projects.length > 1) {
        const { selected } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'selected',
                message: 'Select a project:',
                choices: projects.map(p => ({ name: p.name, value: p.id }))
            }
        ]);
        projectId = selected;
    }
    const apiKeys = await session.db.listApiKeys(projectId);
    if (!isInteractive) {
        if (apiKeys.length === 0) {
            console.log('[]');
        }
        else {
            console.log(JSON.stringify(apiKeys, null, 2));
        }
        await session.db.disconnect();
        return;
    }
    const choices = [
        { name: 'List API keys', value: 'list' },
        { name: 'Create API key', value: 'create' },
        { name: 'Revoke API key', value: 'revoke' }
    ];
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices
        }
    ]);
    switch (action) {
        case 'list':
            if (apiKeys.length === 0) {
                console.log('No API keys found.');
            }
            else {
                console.log('\nAPI Keys:');
                apiKeys.forEach(k => {
                    const expires = k.expiresAt ? new Date(k.expiresAt).toISOString() : 'never';
                    console.log(`  - ${k.maskedPreview} (${k.name || 'unnamed'}) - expires: ${expires}`);
                });
            }
            break;
        case 'create':
            const { name, ttl } = await inquirer_1.default.prompt([
                { type: 'input', name: 'name', message: 'Enter API key name (optional):' },
                {
                    type: 'input',
                    name: 'ttl',
                    message: 'Enter TTL in seconds (optional, leave empty for no expiration):',
                    validate: (input) => {
                        if (!input)
                            return true;
                        const num = parseInt(input, 10);
                        if (isNaN(num) || num <= 0)
                            return 'Must be a positive number';
                        return true;
                    }
                }
            ]);
            const plainKey = node_crypto_1.default.randomBytes(32).toString('hex');
            const encrypted = (0, humanenv_shared_2.encryptWithPk)(plainKey, session.pk, `${projectId}:apikey:${plainKey.slice(0, 8)}`);
            const ttlNum = ttl ? parseInt(ttl, 10) : undefined;
            await session.db.createApiKey(projectId, encrypted, plainKey, ttlNum, name || undefined);
            console.log(`\n✓ Created API key`);
            console.log(`  Name: ${name || 'unnamed'}`);
            console.log(`  Key: ${plainKey}`);
            console.log('⚠️  Save this key! It cannot be recovered.');
            break;
        case 'revoke':
            if (apiKeys.length === 0) {
                console.log('No API keys to revoke.');
                break;
            }
            const { selectedKey, confirmRevoke } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedKey',
                    message: 'Select API key to revoke:',
                    choices: apiKeys.map(k => ({ name: `${k.maskedPreview} (${k.name || 'unnamed'})`, value: k.id }))
                },
                {
                    type: 'confirm',
                    name: 'confirmRevoke',
                    message: 'Are you sure? This cannot be undone.',
                    default: false
                }
            ]);
            if (confirmRevoke) {
                await session.db.revokeApiKey(projectId, selectedKey);
                console.log('\n✓ Revoked API key');
            }
            else {
                console.log('Cancelled.');
            }
            break;
    }
    await session.db.disconnect();
}
async function runLocalWhitelist(isInteractive) {
    const session = await getOrCreateSession(isInteractive);
    if (!session) {
        process.exit(1);
    }
    const projects = await session.db.listProjects();
    if (projects.length === 0) {
        console.error('Error: No projects found.');
        await session.db.disconnect();
        process.exit(1);
    }
    let projectId = projects[0].id;
    if (projects.length > 1) {
        const { selected } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'selected',
                message: 'Select a project:',
                choices: projects.map(p => ({ name: p.name, value: p.id }))
            }
        ]);
        projectId = selected;
    }
    const entries = await session.db.listWhitelistEntries(projectId);
    if (!isInteractive) {
        if (entries.length === 0) {
            console.log('[]');
        }
        else {
            console.log(JSON.stringify(entries, null, 2));
        }
        await session.db.disconnect();
        return;
    }
    const choices = [
        { name: 'List whitelist entries', value: 'list' },
        { name: 'Approve fingerprint', value: 'approve' },
        { name: 'Reject fingerprint', value: 'reject' }
    ];
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices
        }
    ]);
    switch (action) {
        case 'list':
            if (entries.length === 0) {
                console.log('No whitelist entries.');
            }
            else {
                console.log('\nWhitelist entries:');
                entries.forEach(e => {
                    const statusIcon = e.status === 'approved' ? '✓' : e.status === 'rejected' ? '✗' : '○';
                    console.log(`  ${statusIcon} ${e.fingerprint} (${e.status}) - ${new Date(e.createdAt).toISOString()}`);
                });
            }
            break;
        case 'approve':
        case 'reject':
            const pendingEntries = entries.filter(e => e.status === 'pending');
            if (pendingEntries.length === 0) {
                console.log('No pending entries to process.');
                break;
            }
            const { selectedEntry, confirmUpdate } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'selectedEntry',
                    message: `Select fingerprint to ${action}:`,
                    choices: pendingEntries.map(e => ({ name: e.fingerprint, value: e.id }))
                },
                {
                    type: 'confirm',
                    name: 'confirmUpdate',
                    message: `${action === 'approve' ? 'Approve' : 'Reject'} this fingerprint?`,
                    default: true
                }
            ]);
            if (confirmUpdate) {
                await session.db.updateWhitelistStatus(selectedEntry, action === 'approve' ? 'approved' : 'rejected');
                console.log(`\n✓ ${action === 'approve' ? 'Approved' : 'Rejected'} fingerprint`);
            }
            else {
                console.log('Cancelled.');
            }
            break;
    }
    await session.db.disconnect();
}
async function runLocalExport(filePath, isInteractive) {
    const session = await getOrCreateSession(isInteractive);
    if (!session) {
        process.exit(1);
    }
    const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        projects: [],
        apiKeys: [],
        whitelist: [],
        globalSettings: []
    };
    const projects = await session.db.listProjects();
    for (const project of projects) {
        const projectData = await session.db.getProjectById(project.id);
        if (projectData) {
            exportData.projects.push(projectData);
        }
        const envs = await session.db.listEnvsWithValues(project.id);
        exportData.projects.push(...envs);
    }
    const allProjects = await session.db.listProjects();
    const apiKeys = await session.db.listApiKeys(allProjects[0]?.id || '');
    exportData.apiKeys.push(...apiKeys);
    const whitelist = await session.db.listWhitelistEntries(allProjects[0]?.id || '');
    exportData.whitelist.push(...whitelist);
    const globalKeys = ['pk_hash', 'temporal-pk'];
    for (const key of globalKeys) {
        const value = await session.db.getGlobalSetting(key);
        if (value) {
            exportData.globalSettings.push({ key, value });
        }
    }
    node_fs_1.default.writeFileSync(filePath, JSON.stringify(exportData, null, 2), { mode: 0o600 });
    console.log(`✓ Exported to ${filePath}`);
    await session.db.disconnect();
}
async function runLocalImport(filePath, isInteractive) {
    if (!node_fs_1.default.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }
    const session = await getOrCreateSession(isInteractive);
    if (!session) {
        process.exit(1);
    }
    let importData;
    try {
        importData = JSON.parse(node_fs_1.default.readFileSync(filePath, 'utf8'));
    }
    catch {
        console.error('Error: Invalid JSON file');
        await session.db.disconnect();
        process.exit(1);
    }
    if (!importData.version || !importData.projects) {
        console.error('Error: Invalid export file format');
        await session.db.disconnect();
        process.exit(1);
    }
    if (isInteractive) {
        const { confirm } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'This will merge data into existing database. Continue?',
                default: false
            }
        ]);
        if (!confirm) {
            console.log('Cancelled.');
            await session.db.disconnect();
            return;
        }
    }
    let importedProjects = 0;
    let importedEnvs = 0;
    for (const item of importData.projects) {
        if (item.encryptedValue !== undefined) {
            const project = await session.db.getProject(item.projectId || item.id);
            if (project) {
                await session.db.createEnv(project.id, item.key, item.encryptedValue);
                importedEnvs++;
            }
        }
    }
    for (const item of importData.globalSettings || []) {
        await session.db.storeGlobalSetting(item.key, item.value);
    }
    console.log(`✓ Imported ${importedProjects} projects and ${importedEnvs} envs`);
    await session.db.disconnect();
}
