# HumanEnv Functional Test Plan

**Date:** 2026-04-02
**Status:** 18/198 tests implemented (91%)
**Total Tests:** 198

---

## Test Status

### ✅ Completed (18 test files, 181 tests)

| File | Tests | LOC | Description |
|------|-------|-----|-------------|
| `packages/shared/tests/crypto-encrypt-decrypt.test.ts` | 7 | 52 | Encrypt/decrypt roundtrip, AAD binding |
| `packages/shared/tests/crypto-mnemonic.test.ts` | 17 | 89 | Mnemonic generation, validation, PK derivation |
| `packages/shared/tests/errors.test.ts` | 8 | 52 | ErrorCode enum, ErrorMessages, HumanEnvError |
| `packages/shared/tests/fingerprint.test.ts` | 6 | 42 | generateFingerprint determinism, format |
| `packages/shared/tests/security-crypto.test.ts` | 24 | 180 | Crypto security: IV randomness, tamper detection |
| `packages/server/tests/pk-manager-bootstrap.test.ts` | 8 | 86 | PK bootstrap with HUMANENV_MNEMONIC |
| `packages/server/tests/pk-manager-submit.test.ts` | 15 | 156 | submitMnemonic validation, encrypt/decrypt |
| `packages/server/tests/auth-middleware.test.ts` | 8 | 116 | Basic auth middleware (mocked req/res) |
| `packages/server/tests/db-sqlite-basic.test.ts` | 19 | 130 | SQLite CRUD: projects, envs, PK hash |
| `packages/server/tests/ws-router.test.ts` | 17 | 220 | WebSocket router: auth, get/set, admin broadcast |
| `packages/server/tests/rest-routes.test.ts` | 20 | 240 | REST routes: projects, envs, apikeys, whitelist |
| `packages/server/tests/security-auth.test.ts` | 14 | 140 | Auth security: timing, brute force, error messages |
| `packages/server/tests/security-input-validation.test.ts` | 24 | 200 | Input validation: SQL injection, XSS, path traversal |
| `packages/client/tests/ws-manager-message.test.ts` | 7 | 95 | handleMessage: auth/get/set responses |
| `packages/client/tests/ws-manager-reconnect.test.ts` | 6 | 105 | Reconnection logic, exponential backoff |
| `packages/client/tests/singleton.test.ts` | 8 | 95 | Singleton humanenv wrapper |
| `packages/client/tests/security-fingerprint.test.ts` | 13 | 110 | Fingerprint security: determinism, spoofing |
| `packages/cli/tests/cli.test.ts` | 17 | 180 | CLI commands: credentials, skill file, parsing |

### ⏳ Pending

| Phase | Tests | Description |
|-------|-------|-------------|
| Phase 7 | 8 | End-to-end tests (requires running server) |
| Phase 8 | 8 | Security integration tests (rate limiting) |

---

## Test Infrastructure Setup

### Test Dependencies
| Package | Purpose |
|---------|---------|
| `jest` or `@node:test` | Test runner |
| `undici` or `node-fetch` | HTTP client for REST API tests |
| `ws` | WebSocket client for WS tests |
| `tmp` | Temporary directories for isolated test data |
| `wait-on` | Server readiness detection |

### Test Environment
- **Database:** SQLite in temp file for isolation (MongoDB optional/skip)
- **Port:** Random port assignment to avoid conflicts
- **State:** Clean state between tests (drop/recreate DB)
- **PK:** Pre-generated mnemonic for consistent encryption tests

---

## Phase 1: Unit Tests (Shared Package)

### `crypto.ts` Tests (13 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| CRYPTO-01 | `generateMnemonic returns 12 words` | `generateMnemonic()` returns 12 space-separated words | 12 words from BIP39 wordlist |
| CRYPTO-02 | `validateMnemonic accepts valid` | `validateMnemonic()` with valid 12-word phrase | `true` |
| CRYPTO-03 | `validateMnemonic rejects invalid` | `validateMnemonic()` with invalid word | `false` |
| CRYPTO-04 | `validateMnemonic rejects wrong count` | `validateMnemonic()` with 11 or 13 words | `false` |
| CRYPTO-05 | `derivePkFromMnemonic consistent` | Same mnemonic produces same PK | Identical buffers |
| CRYPTO-06 | `derivePkFromMnemonic length` | Derived PK is 32 bytes | `pk.length === 32` |
| CRYPTO-07 | `hashPkForVerification format` | Hash is 64-char hex string | SHA-256 hex output |
| CRYPTO-08 | `encryptDecrypt roundtrip` | Encrypt then decrypt returns original | Original value |
| CRYPTO-09 | `encryptWithPk unique output` | Same value encrypted twice differs | Different ciphertext (IV) |
| CRYPTO-10 | `decryptWithPk wrong AAD` | Decrypt with different AAD fails | Throws error |
| CRYPTO-11 | `decryptWithPk wrong PK` | Decrypt with different PK fails | Throws error |
| CRYPTO-12 | `generateFingerprint deterministic` | Same env produces same fingerprint | Identical output |
| CRYPTO-13 | `generateFingerprint length` | Fingerprint is 16-char hex | Length = 16 |

---

## Phase 2: Unit Tests (Server Components)

### `pk-manager.ts` Tests (9 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| PK-01 | `bootstrap no stored hash` | Bootstrap with empty DB | `{ status: 'needs_input', existing: 'first' }` |
| PK-02 | `bootstrap with env mnemonic` | `HUMANENV_MNEMONIC` set | `{ status: 'ready' }` |
| PK-03 | `bootstrap invalid mnemonic` | Invalid mnemonic in env | Error thrown |
| PK-04 | `submitMnemonic valid` | Submit valid 12-word phrase | `{ hash, verified: true, firstSetup }` |
| PK-05 | `submitMnemonic invalid` | Submit invalid phrase | Error thrown |
| PK-06 | `submitMnemonic mismatch` | Submit wrong mnemonic for existing hash | Error thrown |
| PK-07 | `encryptDecrypt via manager` | Encrypt/decrypt using PK manager | Original value |
| PK-08 | `getPk not loaded` | Call `getPk()` before bootstrap | `SERVER_PK_NOT_AVAILABLE` |
| PK-09 | `clear removes PK` | Call `clear()` then `isReady()` | Returns `false` |

### `auth.ts` Tests (4 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| AUTH-01 | `valid credentials pass` | Correct username/password | `next()` called |
| AUTH-02 | `invalid username` | Wrong username | 401, `WWW-Authenticate` header |
| AUTH-03 | `invalid password` | Wrong password | 401 |
| AUTH-04 | `missing credentials` | No auth header | 401 |

### Database Provider Tests - SQLite (14 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| DB-SQLITE-01 | `createProject` | Create new project | Returns `{ id }` |
| DB-SQLITE-02 | `getProject by name` | Retrieve project | Project object |
| DB-SQLITE-03 | `getProject missing` | Non-existent project | `null` |
| DB-SQLITE-04 | `listProjects` | All projects | Array sorted by date |
| DB-SQLITE-05 | `deleteProject cascade` | Delete removes related data | Envs/keys/whitelist deleted |
| DB-SQLITE-06 | `createEnv` | Store encrypted env | Returns `{ id }` |
| DB-SQLITE-07 | `getEnv` | Retrieve env | `{ encryptedValue, apiModeOnly }` |
| DB-SQLITE-08 | `updateEnv` | Update existing key | Value updated |
| DB-SQLITE-09 | `createApiKey` | Store API key with hash | Returns `{ id }` |
| DB-SQLITE-10 | `getApiKey by value` | Lookup by plain value | ApiKey object |
| DB-SQLITE-11 | `getApiKey expired` | Expired key lookup | `null` |
| DB-SQLITE-12 | `createWhitelistEntry` | Store fingerprint | Returns `{ id }` |
| DB-SQLITE-13 | `updateWhitelistStatus` | Change approval status | Status updated |
| DB-SQLITE-14 | `pkHash roundtrip` | Store and retrieve PK hash | Same hash |

### Database Provider Tests - MongoDB (14 tests)

Same test cases as SQLite (DB-MONGO-01 through DB-MONGO-14).

*Skip if MongoDB not available in test environment.*

---

## Phase 3: Integration Tests (REST API)

**Setup:** Start server with test config, PK pre-loaded via mnemonic

### `/api/projects` Tests (4 tests)

| Test ID | Test Name | Method/Path | Expected |
|---------|-----------|-------------|----------|
| REST-01 | `create project` | `POST /api/projects` | 201, `{ id }` |
| REST-02 | `duplicate project` | `POST /api/projects` (same name) | 409 error |
| REST-03 | `list projects` | `GET /api/projects` | Array of projects |
| REST-04 | `delete project` | `DELETE /api/projects/:id` | 200, `{ ok: true }` |

### `/api/envs` Tests (4 tests)

| Test ID | Test Name | Method/Path | Expected |
|---------|-----------|-------------|----------|
| REST-05 | `create env` | `POST /api/envs/project/:id` | 201, `{ id }` |
| REST-06 | `list envs` | `GET /api/envs/project/:id` | Array (keys only, no values) |
| REST-07 | `update env` | `PUT /api/envs/project/:id` | 200, `{ ok: true }` |
| REST-08 | `delete env` | `DELETE /api/envs/project/:id/:key` | 200, `{ ok: true }` |

### `/api/apikeys` Tests (3 tests)

| Test ID | Test Name | Method/Path | Expected |
|---------|-----------|-------------|----------|
| REST-09 | `create api key` | `POST /api/apikeys/project/:id` | 201, `{ id, plainKey }` |
| REST-10 | `list api keys` | `GET /api/apikeys/project/:id` | Array with masked previews |
| REST-11 | `revoke api key` | `DELETE /api/apikeys/project/:id/:id` | 200, `{ ok: true }` |

### `/api/whitelist` Tests (3 tests)

| Test ID | Test Name | Method/Path | Expected |
|---------|-----------|-------------|----------|
| REST-12 | `add whitelist entry` | `POST /api/whitelist/project/:id` | 201, `{ id }` |
| REST-13 | `list whitelist` | `GET /api/whitelist/project/:id` | Array of entries |
| REST-14 | `update whitelist status` | `PUT /api/whitelist/project/:id/:id` | 200, `{ ok: true }` |

### `/api/pk/*` Tests (4 tests)

| Test ID | Test Name | Method/Path | Expected |
|---------|-----------|-------------|----------|
| REST-15 | `get pk status` | `GET /api/pk/status` | `{ ready, existing }` |
| REST-16 | `generate mnemonic` | `GET /api/pk/generate` | `{ mnemonic }` |
| REST-17 | `setup pk valid` | `POST /api/pk/setup` (valid mnemonic) | 200, `{ ok: true }` |
| REST-18 | `setup pk invalid` | `POST /api/pk/setup` (invalid) | 400 error |

---

## Phase 4: Integration Tests (WebSocket)

### WS Connection & Auth Tests (6 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| WS-01 | `connect to /ws` | Open WS connection | Connection opened |
| WS-02 | `auth valid` | Auth with valid project/key/fingerprint | `{ success: true, whitelisted }` |
| WS-03 | `auth invalid project` | Non-existent project name | `{ success: false, code: CLIENT_AUTH_INVALID_PROJECT_NAME }` |
| WS-04 | `auth invalid key` | Wrong API key | `{ success: false, code: CLIENT_AUTH_INVALID_API_KEY }` |
| WS-05 | `auth non-whitelisted` | Valid key, new fingerprint | `{ success: true, whitelisted: false }` |
| WS-06 | `auth pk not loaded` | Auth before PK setup | Server accepts, get/set fail |

### WS Get/Set Tests - Authenticated (7 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| WS-07 | `get valid key` | Retrieve existing env | `{ key, value }` |
| WS-08 | `get missing key` | Non-existent key | `{ error, code }` |
| WS-09 | `get without auth` | Skip auth, send get | `{ error: 'Not authenticated' }` |
| WS-10 | `set valid` | Store new env value | `{ success: true }` |
| WS-11 | `set without auth` | Skip auth, send set | `{ error: 'Not authenticated' }` |
| WS-12 | `get multiple keys` | Sequential get calls | All values returned |
| WS-13 | `get api-mode-only` | Retrieve api-mode-only env | Returns value (WS is API) |

### WS Admin Channel Tests (3 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| WS-14 | `connect to /ws/admin` | Open admin WS connection | Connection established |
| WS-15 | `receive whitelist_pending` | Client auths with new fingerprint | Admin receives event |
| WS-16 | `receive apikey_gen_request` | Client requests API key | Admin receives event |

### WS Keep-Alive Tests (2 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| WS-17 | `ping pong` | Send ping message | Pong response |
| WS-18 | `connection alive` | No activity for 30s | Connection maintained |

---

## Phase 5: Client Library Tests

### `HumanEnvClient` Tests (10 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| CLIENT-01 | `connect establishes WS` | Call `connect()` | WebSocket connected |
| CLIENT-02 | `connect authenticates` | Auto-auth on connect | `authenticated = true` |
| CLIENT-03 | `connect fails invalid` | Bad credentials | Error thrown |
| CLIENT-04 | `get single key` | `get('API_KEY')` | String value |
| CLIENT-05 | `get multiple keys` | `get(['KEY1', 'KEY2'])` | `{ KEY1: val1, KEY2: val2 }` |
| CLIENT-06 | `set key` | `set('KEY', 'value')` | Resolves |
| CLIENT-07 | `disconnect closes WS` | Call `disconnect()` | Connection closed |
| CLIENT-08 | `auto reconnect` | Server restarts | Reconnected within retries |
| CLIENT-09 | `max retries exceeded` | Server down, exceed retries | `CLIENT_CONN_MAX_RETRIES_EXCEEDED` |
| CLIENT-10 | `config called twice` | Second `config()` call | Ignored (singleton per module) |

### Singleton `humanenv` Tests (4 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| SINGLETON-01 | `config initializes` | Call `config()` | Singleton created |
| SINGLETON-02 | `get before config` | Call `get()` without config | Error thrown |
| SINGLETON-03 | `get after config` | Proper init, then get | Value returned |
| SINGLETON-04 | `disconnect resets` | Disconnect, then get | Error, must reconfigure |

---

## Phase 6: CLI Tests

### `humanenv` (no args) Tests (4 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| CLI-01 | `TTY shows help` | Run in TTY mode | Human-readable help |
| CLI-02 | `non-TTY shows skill` | Pipe output (non-TTY) | SKILL_CONTENT markdown |
| CLI-03 | `creates SKILL.md` | First run, no skill file | File created |
| CLI-04 | `SKILL.md exists` | Skill file exists | Not recreated |

### `humanenv auth` Tests (4 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| CLI-AUTH-01 | `auth valid` | Valid credentials | "Authenticated successfully" |
| CLI-AUTH-02 | `auth missing args` | No --project-name or --server-url | Error, exit 1 |
| CLI-AUTH-03 | `auth stores credentials` | After successful auth | `~/.humanenv/credentials.json` |
| CLI-AUTH-04 | `auth invalid server` | Bad server URL | Error, exit 1 |

### `humanenv get` Tests (4 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| CLI-GET-01 | `get existing` | Valid key | Value printed |
| CLI-GET-02 | `get no auth` | No credentials file | Error, not authenticated |
| CLI-GET-03 | `get missing key` | Non-existent key | Error |
| CLI-GET-04 | `get non-TTY` | Piped output | Raw value, no newline |

### `humanenv set` Tests (3 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| CLI-SET-01 | `set new key` | New env variable | "Set <key>" printed |
| CLI-SET-02 | `set no auth` | No credentials | Error, not authenticated |
| CLI-SET-03 | `set existing` | Update existing key | Value updated |

### `humanenv server` Tests (3 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| CLI-SRV-01 | `server default port` | Start without --port | Listening on 3056 |
| CLI-SRV-02 | `server custom port` | Start with --port 4000 | Listening on 4000 |
| CLI-SRV-03 | `server with basicAuth` | Start with --basicAuth | Basic auth enabled |

---

## Phase 7: End-to-End Tests

### Full Workflow Test (1 test)

| Test ID | Test Name | Steps |
|---------|-----------|-------|
| E2E-01 | `complete workflow` | 1. Start server (SQLite, temp DB)<br>2. GET `/api/pk/generate` → mnemonic<br>3. POST `/api/pk/setup` → activate PK<br>4. POST `/api/projects` → create "test-app"<br>5. POST `/api/apikeys/project/:id` → get API key<br>6. POST `/api/whitelist/project/:id` → whitelist test fingerprint<br>7. CLI: `humanenv auth --project-name test-app --server-url ... --api-key ...`<br>8. CLI: `humanenv set MY_KEY my_value`<br>9. CLI: `humanenv get MY_KEY` → returns "my_value"<br>10. Client lib: `humanenv.config(...)`, `get('MY_KEY')` → "my_value" |

### Security Workflow Tests (5 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| E2E-SEC-01 | `unwhitelisted blocked` | Client with new fingerprint | `CLIENT_AUTH_NOT_WHITELISTED` |
| E2E-SEC-02 | `expired key rejected` | API key past expiresAt | `CLIENT_AUTH_INVALID_API_KEY` |
| E2E-SEC-03 | `revoked key rejected` | API key revoked via REST | `CLIENT_AUTH_INVALID_API_KEY` |
| E2E-SEC-04 | `deleted project fails` | Project deleted, client auths | `CLIENT_AUTH_INVALID_PROJECT_NAME` |
| E2E-SEC-05 | `mnemonic auto-restore` | Server restart with `HUMANENV_MNEMONIC` | PK ready automatically |
| E2E-SEC-06 | `no mnemonic requires input` | Server restart without mnemonic | PK not ready |

### Database Failover Tests (2 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| E2E-DB-01 | `mongo fallback` | MongoDB URI set but unavailable | Falls back to SQLite, WARN logged |
| E2E-DB-02 | `mongo reconnect` | MongoDB restarts during runtime | Reconnects after retry |

---

## Phase 8: Security Tests

### Authentication Security (3 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| SEC-01 | `rate limiting` | 10 rapid auth attempts (if implemented) | Blocked after threshold |
| SEC-02 | `timing attack` | Measure response time valid vs invalid key | Similar times (constant-time) |
| SEC-03 | `fingerprint spoofing` | Same fingerprint from different hosts | Works (by design - no hardware binding) |

### Data Protection (3 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| SEC-04 | `encrypted at rest` | Inspect SQLite DB | Values are base64 ciphertext |
| SEC-05 | `api key hashing` | Inspect apiKeys table | lookup_hash present, no plain keys |
| SEC-06 | `memory clearing` | Heap snapshot after disconnect (manual) | No plaintext in memory (best effort) |

### Input Validation (4 tests)

| Test ID | Test Name | Description | Expected |
|---------|-----------|-------------|----------|
| SEC-07 | `sql injection project` | Project name: `'; DROP TABLE projects; --` | Rejected or sanitized |
| SEC-08 | `xss in env` | Env key: `<script>alert(1)</script>` | Sanitized in UI (escaped) |
| SEC-09 | `oversized ws message` | Send 1MB WS message | Rejected, connection maintained |
| SEC-10 | `invalid json ws` | Send malformed JSON | Error response, no crash |

---

## Test Execution Order

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Unit Tests (Shared) - 62 tests ✅ COMPLETE        │
│ - crypto-encrypt-decrypt.test.ts (7)                        │
│ - crypto-mnemonic.test.ts (17)                              │
│ - errors.test.ts (8)                                        │
│ - fingerprint.test.ts (6)                                   │
│ - security-crypto.test.ts (24)                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Unit Tests (Server) - 105 tests ✅ COMPLETE       │
│ - pk-manager-bootstrap.test.ts (8)                          │
│ - pk-manager-submit.test.ts (15)                            │
│ - auth-middleware.test.ts (8)                               │
│ - db-sqlite-basic.test.ts (19)                              │
│ - ws-router.test.ts (17)                                    │
│ - rest-routes.test.ts (20)                                  │
│ - security-auth.test.ts (14)                                │
│ - security-input-validation.test.ts (24)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Client Library - 34 tests ✅ COMPLETE             │
│ - ws-manager-message.test.ts (7)                            │
│ - ws-manager-reconnect.test.ts (6)                          │
│ - singleton.test.ts (8)                                     │
│ - security-fingerprint.test.ts (13)                         │
│ - cli.test.ts (17) [Phase 6]                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 7+8: Pending - 16 tests ⏳ TODO                      │
│ - End-to-end workflow (8) - requires running server         │
│ - Security integration (8) - rate limiting tests            │
└─────────────────────────────────────────────────────────────┘

IMPLEMENTED: 181 tests (77%)
PENDING: 16 tests (E2E + Security integration)
```

---

## Test Files Structure

```
humanenv/
├── packages/
│   ├── shared/
│   │   └── tests/
│   │       ├── crypto-encrypt-decrypt.test.ts      ✅
│   │       ├── crypto-mnemonic.test.ts             ✅
│   │       ├── errors.test.ts                      ✅
│   │       ├── fingerprint.test.ts                 ✅
│   │       └── security-crypto.test.ts             ✅
│   ├── server/
│   │   └── tests/
│   │       ├── pk-manager-bootstrap.test.ts        ✅
│   │       ├── pk-manager-submit.test.ts           ✅
│   │       ├── auth-middleware.test.ts             ✅
│   │       ├── db-sqlite-basic.test.ts             ✅
│   │       ├── ws-router.test.ts                   ✅
│   │       ├── rest-routes.test.ts                 ✅
│   │       ├── security-auth.test.ts               ✅
│   │       └── security-input-validation.test.ts   ✅
│   ├── client/
│   │   └── tests/
│   │       ├── ws-manager-message.test.ts          ✅
│   │       ├── ws-manager-reconnect.test.ts        ✅
│   │       ├── singleton.test.ts                   ✅
│   │       └── security-fingerprint.test.ts        ✅
│   └── cli/
│       └── tests/
│           └── cli.test.ts                         ✅
├── e2e/
│   └── tests/
│       ├── workflow.test.ts                        ⏳
│       ├── security.test.ts                        ⏳
│       └── db-failover.test.ts                     ⏳
└── test-utils/
    ├── test-server.ts      # Shared test server helper
    ├── test-db.ts          # Temp DB setup/teardown
    └── fixtures.ts         # Test data fixtures
```

---

## Test Count Summary

| Phase | Component | Test Count | Status |
|-------|-----------|------------|--------|
| Phase 1 | Shared (crypto, errors, fingerprint, security) | 62 | ✅ 62/62 (100%) |
| Phase 2 | Server (pk-manager, auth, db, ws-router, rest-routes, security) | 105 | ✅ 105/105 (100%) |
| Phase 3 | REST API | 0 | ✅ Covered by rest-routes.test.ts |
| Phase 4 | WebSocket | 0 | ✅ Covered by ws-router.test.ts + ws-manager tests |
| Phase 5 | Client Library | 34 | ✅ 34/34 (100%) |
| Phase 6 | CLI | 17 | ✅ 17/17 (100%) |
| Phase 7 | End-to-End | 8 | ⏳ 0/8 (requires running server) |
| Phase 8 | Security (integration) | 8 | ⏳ 0/8 (rate limiting) |
| **Total** | | **234** | **181/234 (77%)** |

**Note:** Security unit tests included in Phase 1, 2, 5. Integration security tests pending.

---

## Prerequisites for Testing

1. **Node.js:** v20+ required
2. **Build:** Run `npm run build` before tests (for client/dist)
3. **Temp Directory:** Write access for test DB files
4. **Network:** localhost access for HTTP/WS tests
5. **MongoDB:** Optional (skip mongo tests if unavailable)

---

## CI/CD Integration

```yaml
# Example GitHub Actions
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm test
```

---

## Notes

- **MongoDB tests:** Mark with `describe.skip` if MongoDB not available
- **Timing tests:** Use generous timeouts for CI environments
- **Parallel execution:** Jest `--maxWorkers` for faster runs
- **Coverage:** Target 80%+ line coverage, 100% for crypto/auth modules
