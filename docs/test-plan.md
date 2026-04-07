# Test Plan

> 354 tests across 23 files. All pass. All use mocks — no real DB or WebSocket connections.

## Dashboard

| Package | File | Tests | Status |
|---------|------|-------|--------|
| shared | `crypto-encrypt-decrypt.test.ts` | 7 | ✅ |
| shared | `crypto-mnemonic.test.ts` | 17 | ✅ |
| shared | `errors.test.ts` | 10 | ✅ |
| shared | `fingerprint.test.ts` | 6 | ✅ |
| shared | `security-crypto.test.ts` | 14 | ✅ |
| server | `pk-manager-bootstrap.test.ts` | 7 | ✅ |
| server | `pk-manager-submit.test.ts` | 16 | ✅ |
| server | `auth-middleware.test.ts` | 8 | ✅ |
| server | `db-sqlite-basic.test.ts` | 16 | ✅ |
| server | `db-sqlite-extended.test.ts` | 28 | ✅ |
| server | `db-mongo.test.ts` | 37 | ✅ |
| server | `ws-router.test.ts` | 14 | ✅ |
| server | `rest-routes.test.ts` | 17 | ✅ |
| server | `routes-handlers-projects-envs.test.ts` | 17 | ✅ |
| server | `routes-handlers-keys-whitelist-settings.test.ts` | 18 | ✅ |
| server | `security-auth.test.ts` | 10 | ✅ |
| server | `security-input-validation.test.ts` | 22 | ✅ |
| client | `ws-manager-lifecycle.test.ts` | 39 | ✅ |
| client | `ws-manager-message.test.ts` | 7 | ✅ |
| client | `ws-manager-reconnect.test.ts` | 6 | ✅ |
| client | `singleton.test.ts` | 9 | ✅ |
| client | `security-fingerprint.test.ts` | 11 | ✅ |
| cli | `cli.test.ts` | 18 | ✅ |
| **Total** | **23 files** | **354** | **✅** |

## By Package

| Package | Files | Tests |
|---------|-------|-------|
| shared | 5 | 54 |
| server | 12 | 210 |
| client | 5 | 72 |
| cli | 1 | 18 |
| **Total** | **23** | **354** |

## Pending

| Scope | Tests | Blocker |
|-------|-------|---------|
| End-to-end workflow | ~8 | Requires running server |
| Rate limiting | ~8 | Feature not implemented |

## Infrastructure

| Component | Choice |
|-----------|--------|
| Runner | `node:test` (built-in) |
| Assertions | `node:assert` |
| Database | SQLite temp files (isolated per test) |
| Mocking | Full mocks — no real DB, WS, or network |
| Port | Random assignment (no conflicts) |
| State | Clean between tests (drop/recreate) |

## Prerequisites

- Node.js v20+
- `npm run build` before tests (client needs built dist)
- Write access for temp DB files

## Run

```bash
# All tests
npm test

# Single package
cd packages/server && npm test
cd packages/shared && npm test
cd packages/client && npm test

# Single file
node --import tsx --test packages/server/tests/db-mongo.test.ts

# With force-exit (for client tests with timers)
node --import tsx --test --test-force-exit packages/client/tests/*.test.ts
```

## CI

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - run: npm test
```
