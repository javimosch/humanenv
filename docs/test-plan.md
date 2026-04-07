# HumanEnv Test Plan

**Status:** 216/234 tests implemented (92%) across 20 test files

---

## Test Dashboard

| Phase | Package | File | Tests | Status |
|-------|---------|------|-------|--------|
| 1 | shared | `crypto-encrypt-decrypt.test.ts` | 7 | ✅ |
| 1 | shared | `crypto-mnemonic.test.ts` | 17 | ✅ |
| 1 | shared | `errors.test.ts` | 8 | ✅ |
| 1 | shared | `fingerprint.test.ts` | 6 | ✅ |
| 1 | shared | `security-crypto.test.ts` | 24 | ✅ |
| 2 | server | `pk-manager-bootstrap.test.ts` | 8 | ✅ |
| 2 | server | `pk-manager-submit.test.ts` | 15 | ✅ |
| 2 | server | `auth-middleware.test.ts` | 8 | ✅ |
| 2 | server | `db-sqlite-basic.test.ts` | 19 | ✅ |
| 2 | server | `ws-router.test.ts` | 17 | ✅ |
| 2 | server | `rest-routes.test.ts` | 20 | ✅ |
| 2 | server | `routes-handlers-projects-envs.test.ts` | 17 | ✅ |
| 2 | server | `routes-handlers-keys-whitelist-settings.test.ts` | 18 | ✅ |
| 2 | server | `security-auth.test.ts` | 14 | ✅ |
| 2 | server | `security-input-validation.test.ts` | 24 | ✅ |
| 5 | client | `ws-manager-message.test.ts` | 7 | ✅ |
| 5 | client | `ws-manager-reconnect.test.ts` | 6 | ✅ |
| 5 | client | `singleton.test.ts` | 8 | ✅ |
| 5 | client | `security-fingerprint.test.ts` | 13 | ✅ |
| 6 | cli | `cli.test.ts` | 17 | ✅ |
| **Total** | | | **216** | **✅** |

### Pending

| Phase | Tests | Description | Blocker |
|-------|-------|-------------|---------|
| 7 | 8 | End-to-end workflow | Requires running server |
| 8 | 8 | Security integration (rate limiting) | Feature not implemented |

---

## Phase Summary

| Phase | Scope | Count | Status |
|-------|-------|-------|--------|
| 1 | Shared (crypto, errors, fingerprint) | 62 | ✅ 100% |
| 2 | Server (pk, auth, db, ws, routes, security) | 160 | ✅ 100% |
| 3-4 | REST + WebSocket integration | — | ✅ Covered by Phase 2 |
| 5 | Client library | 34 | ✅ 100% |
| 6 | CLI | 17 | ✅ 100% |
| 7 | End-to-end | 8 | ⏳ Blocked |
| 8 | Security integration | 8 | ⏳ Blocked |

---

## Test Infrastructure

| Component | Choice |
|-----------|--------|
| Runner | `node:test` (built-in) |
| Assertions | `node:assert` |
| HTTP client | `fetch` (built-in) |
| Database | SQLite in temp file (isolated) |
| Port | Random assignment (no conflicts) |
| State | Clean between tests (drop/recreate) |
| PK | Pre-generated mnemonic for encryption |

---

## Running Tests

```bash
# All tests
npm test

# Single package
cd packages/server && npm test
cd packages/shared && npm test
cd packages/client && npm test

# Single file
node --import tsx --test packages/server/tests/routes-handlers-projects-envs.test.ts
```

---

## CI/CD

```yaml
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

## Prerequisites

- Node.js v20+
- `npm run build` before tests (client/dist)
- Write access for temp DB files
- localhost access for HTTP/WS tests
- MongoDB: optional (skip if unavailable)

---

## Coverage Targets

| Module | Target |
|--------|--------|
| crypto/auth | 100% line coverage |
| All others | 80%+ line coverage |
