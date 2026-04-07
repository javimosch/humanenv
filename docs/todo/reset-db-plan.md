# Reset Database

> Wipe all data and restart fresh. Required when the mnemonic is lost and secrets are unrecoverable.

## Endpoint

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/reset` | Basic Auth | — | `{"ok": true}` |

**Effect:** Deletes all projects, envs, API keys, whitelist entries, and PK hash. Server returns to first-run state.

## Implementation

### 1. Database Interface — `db/interface.ts`

```typescript
reset(): Promise<void>
```

### 2. SQLite Provider — `db/sqlite.ts`

```typescript
async reset(): Promise<void> {
  await this.disconnect()
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(this.dbPath + ext) } catch {}
  }
  await this.connect()
}
```

### 3. MongoDB Provider — `db/mongo.ts`

```typescript
async reset(): Promise<void> {
  const collections = await this.db.collections()
  for (const col of collections) await col.drop()
}
```

### 4. Route — `index.ts`

```typescript
app.post('/api/reset', async (req, res) => {
  await db.reset()
  pk.clear()
  res.json({ ok: true })
})
```

### 5. Admin UI — `views/index.ejs`

Two entry points:

| Location | Trigger |
|----------|--------|
| PK-not-available screen | "Lost your recovery phrase?" link |
| Settings tab | Danger Zone section |

Confirmation: user types `RESET` to enable the button.

```html
<dialog class="modal modal-open">
  <div class="modal-box">
    <h3>Reset Database?</h3>
    <p class="text-error">This deletes everything. Cannot be undone.</p>
    <input v-model="resetText" placeholder="Type RESET" />
    <button @click="doReset" :disabled="resetText !== 'RESET'">Confirm</button>
  </div>
</dialog>
```

## Flow

```
User clicks Reset → types "RESET" → POST /api/reset → DB wiped + PK cleared → page reloads → fresh setup
```
