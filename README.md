# humanenv

Securely inject environment variables into your application so that AI agents and non-human consumers **cannot access secrets directly**. The server is the single source of truth. Secrets are encrypted at rest and exist in memory only when explicitly requested.

## Core Idea

Instead of storing `.env` files that every process can read, `humanenv` sits between your app and its secrets. Clients connect via WebSocket, authenticate with a per-project API key + device fingerprint, retrieve individual values, use them, and null them out. No bulk dump possible.

## Architecture

```
humanenv (client) ──[WS:port]── humanenv-server ──[SQLite/MongoDB]── encrypted envs
     │                             │
     ├─ JS SDK ── your app ────────┤
     ├─ CLI ── terminal ───────────┤
     └─ .agents/skills/ ── AI agents read skill, use humanenv.get()

humanenv-server ──[HTTP:port]── Admin UI (Vue3 SPA)
```

## Quick Start

### 1. Start the Server

Run directly from source (after `npm install`):

```bash
# From the monorepo root
npx tsx packages/server/src/index.ts --port 3056 --basicAuth
```

Or after building:
```bash
node packages/server/dist/index.js --port 3056 --basicAuth
```

Flags:
- `--port <number>` — override default 3056 (also supports `PORT` env)
- `--basicAuth` — require HTTP Basic Auth for admin UI (reads `BASIC_AUTH_USERNAME`/`BASIC_AUTH_PASSWORD`, falls back to `admin/admin`)
- `MONGODB_URI=<uri>` — use MongoDB instead of SQLite

### 2. First-Time Admin Setup

1. Open `http://localhost:3056` in your browser
2. If `HUMANENV_MNEMONIC` env var is **not set**, the UI prompts you to generate or paste a 12-word recovery phrase
3. **Save the phrase securely** — it is never stored. Losing it means all encrypted data is unrecoverable
4. Create your first project

### 3. Create a Project & API Key

In the Admin UI:
1. Create a project (e.g., `my-app`)
2. Under **API Keys**, generate a new key
3. Copy the plain API key — it will not be shown again

### 4. Authenticate the CLI

```bash
# Set up credentials
npx tsx packages/cli/src/bin.js auth \
  --project-name my-app \
  --server-url http://localhost:3056 \
  --api-key <your-api-key>
```

This stores credentials at `~/.humanenv/credentials.json`.

### 5. Retrieve a Secret

```bash
npx tsx packages/cli/src/bin.js get API_KEY
# Outputs: sk-proj-xxxxxxxxxxxx
```

### 6. Use in Your Application

```javascript
import humanenv from 'humanenv'

humanenv.config({
  serverUrl: 'http://localhost:3056',
  projectName: 'my-app',
  projectApiKey: 'your-api-key',
})

// Single key
let apiKey = await humanenv.get('API_KEY')
someLib.use(apiKey)
apiKey = null  // always null after use

// Multiple keys at once
let { API_KEY, DATABASE_URL } = await humanenv.get(['API_KEY', 'DATABASE_URL'])
db.connect(DATABASE_URL)
DATABASE_URL = null
API_KEY = null

// Set/unset secrets at runtime
await humanenv.set('API_KEY', 'new-value')
```

CommonJS compatible:
```javascript
const humanenv = require('humanenv').default
```

## CLI Reference

Commands:

```bash
humanenv                        # Auto-generate .agents/skills/humanenv-usage/SKILL.md
                                # Outputs skill to stdout if non-TTY (for agents)
                                # Outputs help if TTY (for humans)

humanenv auth --project-name <name> --server-url <url> [--api-key <key>]
                                # Authenticate with the server

humanenv get <key>              # Retrieve an env value
humanenv set <key> <value>      # Update or create an env value

humanenv server [--port 3056] [--basicAuth]
                                # Start the server in-process
```

### Skill Auto-Generation

Running `humanenv` without arguments creates `.agents/skills/humanenv-usage/SKILL.md` in the current directory. This skill teaches AI agents how to use humanenv correctly:
- Never log or dump sensitive values
- Always null variables after use
- Never write secrets to files
- Use `humanenv.get('key')` individually

## Security Model

### Encryption at Rest

All env values are encrypted with AES-256-GCM before persistence. The encryption key (PK) is derived from a BIP39 12-word mnemonic using PBKDF2 (SHA-256, 100k iterations).

The PK **never touches disk**. Only a SHA-256 hash of the PK is stored in the database for verification.

### Zero-Touch Restarts via HUMANENV_MNEMONIC

For production use (Docker, K8s, CI), set the mnemonic as an environment variable:

```bash
HUMANENV_MNEMONIC="word1 word2 word3 ... word12" humanenv server
```

The PK is derived on startup — no manual entry required. If the env var is **not set**, the server blocks client requests and waits for admin input via the UI.

### Client Authentication

Each client authenticates with:
1. **Project name** — must exist on the server
2. **API key** — per-project secret (encrypted at rest)
3. **Fingerprint** — deterministic hash of hostname + platform + arch + Node version

Clients must be **whitelisted** by an admin before they can retrieve secrets. New clients send a pending request visible in real-time in the Admin UI.

### API-Mode Only Envs

Secrets can be flagged as **api-mode only**. These are accessible only via the WebSocket SDK (your app), not via the CLI. Non-human agents cannot bypass this: the CLI enforces the gate.

### Threat Matrix

| Scenario | Mitigation |
|---|---|
| Agent reads .env files | No .env files exist |
| Agent logs env values | Skill instructs against it; SDK does not auto-log |
| Database dump leaked | All values encrypted; PK not in database |
| Server restart | PK from env var or manual admin re-entry |
| Rogue client connects | Fingerprint + API key + whitelist required |
| Memory dump | Developer must null values after use |

## Server Configuration

### Ports & Auth

```bash
# Environment variables
PORT=3056                           # Server port
BASIC_AUTH_USERNAME=admin           # Admin UI username
BASIC_AUTH_PASSWORD=secret          # Admin UI password

# Flags
--port 3056                         # Override PORT
--basicAuth                         # Enable basic auth for admin UI
```

### Database

**SQLite (default):**
```bash
# Uses ~/.humanenv/humanenv.db automatically
```

**MongoDB:**
```bash
MONGODB_URI="mongodb://localhost:27017" npx tsx packages/server/src/index.ts
```

MongoDB connection failure at bootstrap falls back to SQLite with a warning. Runtime MongoDB disconnections trigger infinite retry with 10-second delays.

### Data Directory

All persistent data (SQLite DB, credentials) lives in `~/.humanenv/` by default.

## Admin UI

Access at `http://localhost:<PORT>`.

### Dashboard
- Create/delete projects
- View project list with creation timestamps

### Per-Project Management

**Envs Tab:**
- Add key-value pairs
- Toggle "api-mode-only" flag per env
- Update or delete existing envs

**API Keys Tab:**
- Generate new keys (with optional TTL in seconds)
- Revoke/rotate existing keys
- Toggle auto-accept for client API key generation requests

**Whitelist Tab:**
- Add approved fingerprints manually
- Review pending requests from unknown clients
- Accept or reject in real-time

**Real-Time Notifications:**
Toast notifications appear when:
- A new client sends a whitelist request
- A client requests API key generation

## Project Structure

```
packages/
  shared/             # Shared types, crypto utilities, error codes
    src/
      crypto.ts       # AES-256-GCM, PBKDF2, BIP39 mnemonic, fingerprints
      errors.ts       # ErrorCode enum and HumanEnvError class
      types.ts        # Interfaces + SKILL_CONTENT template
      index.ts        # Re-exports
  server/             # Express + WebSocket server + Admin UI
    src/
      index.ts        # Server entry, Express setup, route wiring
      pk-manager.ts   # Private key lifecycle (derive, verify, encrypt, decrypt)
      auth.ts         # HTTP Basic Auth middleware
      db/
        interface.ts  # IDatabaseProvider interface
        sqlite.ts     # better-sqlite3 implementation
        mongo.ts      # MongoDB (native driver) implementation
        index.ts      # Factory: try Mongo, fallback to SQLite
      routes/
        index.ts      # REST endpoints: projects, envs, api keys, whitelist
      ws/
        router.ts     # WebSocket handler: client SDK + admin UI channels
      views/
        index.ejs     # Admin UI (Vue3, Tailwind, DaisyUI via CDN)
  client/             # npm package (humanenv) — SDK for apps
    src/
      index.ts        # Main API: config(), get(), set(), disconnect()
      ws-manager.ts   # WebSocket connection, auth, auto-reconnect
  cli/               # CLI tool
    src/
      bin.js          # commander CLI: auth, get, set, server
```

## Error Codes

| Code | Description |
|---|---|
| `SERVER_PK_NOT_AVAILABLE` | Server has no PK in memory; admin must provide mnemonic |
| `CLIENT_AUTH_INVALID_PROJECT_NAME` | Project name does not exist |
| `CLIENT_AUTH_NOT_WHITELISTED` | Client fingerprint not approved |
| `CLIENT_AUTH_INVALID_API_KEY` | API key is invalid or expired |
| `CLIENT_CONN_MAX_RETRIES_EXCEEDED` | WS reconnection limit reached |
| `ENV_API_MODE_ONLY` | Env flagged as API-mode only; CLI access denied |

## Development

```bash
npm install                     # Monorepo install (workspaces)

# Start server (dev)
cd packages/server && npx tsx src/index.ts

# Start CLI (dev)
cd packages/cli && node src/bin.js get MY_KEY

# Type check
npx tsc --noEmit -p packages/server
npx tsc --noEmit -p packages/client
npx tsc --noEmit -p packages/shared
```

## License

MIT
