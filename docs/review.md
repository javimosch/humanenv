# Architecture Overview

> humanenv is a secrets manager that serves individual keys over WebSocket. No `.env` files, no bulk access.

## Package Map

| Package | Purpose | Key Files | LOC |
|---------|---------|-----------|-----|
| `packages/shared` | Crypto, types, errors | `crypto.ts`, `errors.ts`, `types.ts` | ~250 |
| `packages/server` | Express + WebSocket server, admin UI | `ws/router.ts`, `routes/index.ts`, `db/` | ~1000 |
| `packages/client` | WebSocket client with auto-reconnect | `ws-manager.ts`, `index.ts` | ~280 |
| `packages/cli` | CLI commands (auth, get, set, server) | `bin.js`, `entry.js` | ~670 |

## Data Flow

```
Agent/App → SDK (ws-manager.ts) → WebSocket → Server (ws/router.ts)
                                                  ↓
                                              pk-manager.ts → decrypt → db (sqlite/mongo)
                                                  ↓
                                              Single value returned
```

## Server Components

| Component | File | Responsibility |
|-----------|------|---------------|
| WebSocket router | `ws/router.ts` | Auth, get/set message handling |
| REST routes | `routes/index.ts` | Admin API (projects, envs, keys, whitelist) |
| PK manager | `pk-manager.ts` | Mnemonic → encryption key derivation |
| Auth middleware | `auth.ts` | Basic auth for admin UI |
| SQLite provider | `db/sqlite.ts` | SQLite CRUD implementation |
| MongoDB provider | `db/mongo.ts` | MongoDB CRUD implementation |
| Admin UI | `views/index.ejs` | Vue3 + Tailwind + DaisyUI SPA |

## Database Interface

Both providers implement `IDatabaseProvider` (`db/interface.ts`):

| Method | Description |
|--------|-------------|
| `createProject` / `getProject` / `updateProject` | Project CRUD |
| `setEnv` / `getEnv` / `listEnvs` / `deleteEnv` | Encrypted env CRUD |
| `createApiKey` / `getApiKey` / `listApiKeys` / `revokeApiKey` | API key management |
| `createWhitelistEntry` / `getWhitelistEntry` / `updateWhitelistStatus` | Fingerprint whitelist |
| `getGlobalSetting` / `setGlobalSetting` | Key-value config store |

## Security Layers

| Layer | Implementation |
|-------|---------------|
| Encryption at rest | AES-256-GCM, unique IV per value |
| Key derivation | 12-word mnemonic → PBKDF2 → PK (memory only) |
| Client auth | Project name + API key + device fingerprint |
| Access control | Per-fingerprint whitelist with approval flow |
| API key expiry | Optional TTL with automatic invalidation |
| CLI restriction | `api-mode-only` flag per env |

## Test Coverage

| Package | Test Files | Tests | Status |
|---------|-----------|-------|--------|
| shared | 5 | 62 | ✅ |
| server | 12 | 226 | ✅ |
| client | 5 | 72 | ✅ |
| cli | 1 | 18 | ✅ |
| **Total** | **23** | **354+** | **✅** |

Test runner: `node:test` (built-in). All tests use mocks — no real DB or WebSocket connections.

## Known Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| No rate limiting on auth | Brute force possible | Medium |
| No audit logging | No access trail | Low |
| No graceful shutdown | WS/DB connections may leak on SIGTERM | Low |
| E2E tests blocked | Requires running server instance | Low |
