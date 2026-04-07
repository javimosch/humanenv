# Reset Database Feature

Wipe all data and start fresh. Essential for lost-mnemonic recovery.

---

## API

| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | `/api/reset` | Basic Auth (if enabled) | `{"ok": true}` or `{"error": "..."}` |

**Effect:** Deletes all projects, envs, API keys, whitelist entries, and PK hash.

---

## Files to Modify

### 1. `packages/server/src/db/interface.ts`

Add `reset()` to `IDatabaseProvider`:

```typescript
reset(): Promise<void>
```

### 2. `packages/server/src/db/sqlite.ts`

```typescript
async reset(): Promise<void> {
  await this.disconnect()
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(this.dbPath + ext) } catch {}
  }
  await this.connect()
}
```

### 3. `packages/server/src/db/mongo.ts`

```typescript
async reset(): Promise<void> {
  const collections = await this.db.collections()
  for (const col of collections) await col.drop()
}
```

### 4. `packages/server/src/index.ts`

```typescript
app.post('/api/reset', async (req, res) => {
  await db.reset()
  pk.clear()
  res.json({ ok: true })
})
```

### 5. `packages/server/src/views/index.ejs`

Add two UI entry points:

**A. "Needs-PK" screen** — "Lost your recovery phrase?" link with reset button

**B. Settings tab** — Danger Zone section with reset button

**C. Confirmation dialog** — requires typing "RESET" to confirm

```html
<dialog v-if="showResetDialog" class="modal modal-open">
  <div class="modal-box">
    <h3>Reset Database?</h3>
    <p class="text-error">This action cannot be undone.</p>
    <input v-model="resetConfirmText" placeholder="Type RESET">
    <button @click="doReset" :disabled="resetConfirmText !== 'RESET'">Confirm</button>
  </div>
</dialog>
```

---

## UI Flow

1. User clicks Reset → confirmation dialog
2. User types "RESET" → POST `/api/reset`
3. Server deletes DB, clears PK
4. Page reloads → fresh setup screen
