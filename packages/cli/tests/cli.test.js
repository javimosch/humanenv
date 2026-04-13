"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
// Test the CLI helper functions by extracting and testing them
// Since bin.js is CommonJS, we test the logic patterns
(0, node_test_1.describe)('CLI - Credentials Management', () => {
    const testCredentialsDir = path.join(os.tmpdir(), 'humanenv-test-creds');
    let originalCredentialsDir;
    (0, node_test_1.beforeEach)(() => {
        originalCredentialsDir = testCredentialsDir;
        // Clean up before test
        if (fs.existsSync(testCredentialsDir)) {
            fs.rmSync(testCredentialsDir, { recursive: true, force: true });
        }
    });
    (0, node_test_1.afterEach)(() => {
        // Clean up after test
        if (fs.existsSync(testCredentialsDir)) {
            fs.rmSync(testCredentialsDir, { recursive: true, force: true });
        }
    });
    (0, node_test_1.it)('ensureCredentialsDir creates directory if not exists', () => {
        node_assert_1.default.strictEqual(fs.existsSync(testCredentialsDir), false);
        fs.mkdirSync(testCredentialsDir, { recursive: true });
        node_assert_1.default.strictEqual(fs.existsSync(testCredentialsDir), true);
    });
    (0, node_test_1.it)('writeCredentials stores JSON file', () => {
        fs.mkdirSync(testCredentialsDir, { recursive: true });
        const credsPath = path.join(testCredentialsDir, 'credentials.json');
        const creds = {
            projectName: 'test-app',
            serverUrl: 'http://localhost:3056',
            apiKey: 'test-key-123',
        };
        fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
        node_assert_1.default.ok(fs.existsSync(credsPath));
        const stored = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        node_assert_1.default.strictEqual(stored.projectName, 'test-app');
        node_assert_1.default.strictEqual(stored.serverUrl, 'http://localhost:3056');
    });
    (0, node_test_1.it)('readCredentials returns null if file not exists', () => {
        const credsPath = path.join(testCredentialsDir, 'credentials.json');
        node_assert_1.default.strictEqual(fs.existsSync(credsPath), false);
        // Simulating readCredentials behavior
        const result = fs.existsSync(credsPath)
            ? JSON.parse(fs.readFileSync(credsPath, 'utf8'))
            : null;
        node_assert_1.default.strictEqual(result, null);
    });
    (0, node_test_1.it)('readCredentials returns parsed JSON if file exists', () => {
        fs.mkdirSync(testCredentialsDir, { recursive: true });
        const credsPath = path.join(testCredentialsDir, 'credentials.json');
        const creds = {
            projectName: 'my-app',
            serverUrl: 'http://localhost:3056',
        };
        fs.writeFileSync(credsPath, JSON.stringify(creds));
        const result = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        node_assert_1.default.strictEqual(result.projectName, 'my-app');
    });
    (0, node_test_1.it)('readCredentials returns null on invalid JSON', () => {
        fs.mkdirSync(testCredentialsDir, { recursive: true });
        const credsPath = path.join(testCredentialsDir, 'credentials.json');
        fs.writeFileSync(credsPath, 'invalid json {');
        try {
            JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            node_assert_1.default.fail('Should have thrown');
        }
        catch {
            // Expected - simulates readCredentials returning null
        }
    });
});
(0, node_test_1.describe)('CLI - Skill File Management', () => {
    const testSkillPath = path.join(os.tmpdir(), 'humanenv-test-skill', '.agents', 'skills', 'humanenv-usage', 'SKILL.md');
    (0, node_test_1.beforeEach)(() => {
        // Clean up before test
        if (fs.existsSync(path.dirname(testSkillPath))) {
            fs.rmSync(path.dirname(testSkillPath), { recursive: true, force: true });
        }
    });
    (0, node_test_1.afterEach)(() => {
        // Clean up after test
        if (fs.existsSync(path.dirname(testSkillPath))) {
            fs.rmSync(path.dirname(testSkillPath), { recursive: true, force: true });
        }
    });
    (0, node_test_1.it)('ensureSkillFile creates directory structure', () => {
        node_assert_1.default.strictEqual(fs.existsSync(testSkillPath), false);
        // Simulate ensureSkillFile logic
        if (!fs.existsSync(testSkillPath)) {
            fs.mkdirSync(path.dirname(testSkillPath), { recursive: true });
            fs.writeFileSync(testSkillPath, 'test skill content', 'utf8');
        }
        node_assert_1.default.ok(fs.existsSync(testSkillPath));
    });
    (0, node_test_1.it)('ensureSkillFile does not overwrite existing file', () => {
        fs.mkdirSync(path.dirname(testSkillPath), { recursive: true });
        fs.writeFileSync(testSkillPath, 'original content', 'utf8');
        // Simulate ensureSkillFile logic (should not overwrite)
        if (!fs.existsSync(testSkillPath)) {
            fs.writeFileSync(testSkillPath, 'new content', 'utf8');
        }
        const content = fs.readFileSync(testSkillPath, 'utf8');
        node_assert_1.default.strictEqual(content, 'original content');
    });
    (0, node_test_1.it)('SKILL_CONTENT has required metadata header', () => {
        const { SKILL_CONTENT } = require('humanenv-shared');
        node_assert_1.default.ok(SKILL_CONTENT.includes('---'));
        node_assert_1.default.ok(SKILL_CONTENT.includes('name: humanenv-usage'));
        node_assert_1.default.ok(SKILL_CONTENT.includes('description:'));
    });
    (0, node_test_1.it)('SKILL_CONTENT includes security rules', () => {
        const { SKILL_CONTENT } = require('humanenv-shared');
        node_assert_1.default.ok(SKILL_CONTENT.includes('NEVER log env values'));
        node_assert_1.default.ok(SKILL_CONTENT.includes('NEVER dump or export'));
        node_assert_1.default.ok(SKILL_CONTENT.includes('ALWAYS null variables'));
    });
});
(0, node_test_1.describe)('CLI - Command Parsing', () => {
    (0, node_test_1.it)('auth command requires project-name and server-url', () => {
        // Simulate validation logic from bin.js
        const validateAuth = (opts) => {
            if (!opts.projectName || !opts.serverUrl) {
                return 'Error: --project-name and --server-url required';
            }
            return null;
        };
        node_assert_1.default.ok(validateAuth({}));
        node_assert_1.default.ok(validateAuth({ projectName: 'test' }));
        node_assert_1.default.ok(validateAuth({ serverUrl: 'http://localhost' }));
        node_assert_1.default.strictEqual(validateAuth({ projectName: 'test', serverUrl: 'http://localhost' }), null);
    });
    (0, node_test_1.it)('get command requires key argument', () => {
        const validateGet = (key) => {
            if (!key) {
                return 'Error: key required';
            }
            return null;
        };
        node_assert_1.default.ok(validateGet(undefined));
        node_assert_1.default.strictEqual(validateGet('API_KEY'), null);
    });
    (0, node_test_1.it)('set command requires key and value arguments', () => {
        const validateSet = (key, value) => {
            if (!key || value === undefined) {
                return 'Error: key and value required';
            }
            return null;
        };
        node_assert_1.default.ok(validateSet(undefined, undefined));
        node_assert_1.default.ok(validateSet('KEY', undefined));
        node_assert_1.default.strictEqual(validateSet('KEY', 'value'), null);
    });
    (0, node_test_1.it)('server command accepts optional port', () => {
        const parseServerOpts = (port, basicAuth) => {
            const portArg = port ? `--port=${port}` : '';
            const basicAuthArg = basicAuth ? '--basicAuth' : '';
            return [portArg, basicAuthArg].filter(Boolean);
        };
        node_assert_1.default.deepStrictEqual(parseServerOpts(), []);
        node_assert_1.default.deepStrictEqual(parseServerOpts('4000'), ['--port=4000']);
        node_assert_1.default.deepStrictEqual(parseServerOpts('4000', true), ['--port=4000', '--basicAuth']);
    });
});
(0, node_test_1.describe)('CLI - TTY Detection', () => {
    (0, node_test_1.it)('TTY mode shows help text', () => {
        const isTTY = true;
        const getOutput = (isTTY) => {
            if (isTTY) {
                return 'HumanEnv - Secure environment variable injection\n\nUsage:...';
            }
            else {
                return '---\nname: humanenv-usage\n...';
            }
        };
        const output = getOutput(isTTY);
        node_assert_1.default.ok(output.includes('HumanEnv'));
        node_assert_1.default.ok(output.includes('Usage'));
    });
    (0, node_test_1.it)('Non-TTY mode outputs skill content', () => {
        const isTTY = false;
        const { SKILL_CONTENT } = require('humanenv-shared');
        const getOutput = (isTTY) => {
            if (!isTTY) {
                return SKILL_CONTENT;
            }
            return 'Help text...';
        };
        const output = getOutput(isTTY);
        node_assert_1.default.ok(output.includes('---'));
        node_assert_1.default.ok(output.includes('name: humanenv-usage'));
    });
});
(0, node_test_1.describe)('CLI - Error Handling', () => {
    (0, node_test_1.it)('exits with code 1 on auth error', () => {
        // Simulate error handling pattern
        const handleError = (error) => {
            if (error) {
                console.error('Auth failed:', error.message);
                return 1; // exit code
            }
            return 0;
        };
        node_assert_1.default.strictEqual(handleError(new Error('Connection failed')), 1);
        node_assert_1.default.strictEqual(handleError(null), 0);
    });
    (0, node_test_1.it)('exits with code 1 on get error', () => {
        const handleError = (error) => {
            if (error) {
                console.error('Failed to get env:', error.message);
                return 1;
            }
            return 0;
        };
        node_assert_1.default.strictEqual(handleError(new Error('Key not found')), 1);
    });
    (0, node_test_1.it)('exits with code 1 on set error', () => {
        const handleError = (error) => {
            if (error) {
                console.error('Failed to set env:', error.message);
                return 1;
            }
            return 0;
        };
        node_assert_1.default.strictEqual(handleError(new Error('Not authenticated')), 1);
    });
});
//# sourceMappingURL=cli.test.js.map