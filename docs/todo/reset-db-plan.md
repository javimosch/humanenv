# Reset Database Feature Plan

## Overview

Add a "Reset Database" feature to the HumanEnv admin UI that allows administrators to wipe all data and start fresh. This is essential for recovery when the 12-word mnemonic is lost.

## Use Cases

1. **Lost Mnemonic Recovery**: Admin has an existing database with PK hash but lost the 12-word recovery phrase
2. **Fresh Start**: Admin wants to wipe all data and restart with a new private key
3. **Development/Testing**: Quick reset during development without manually deleting files

## Security Model

- Reset endpoint is protected by Basic Auth (if `--basicAuth` is enabled)
- If Basic Auth is not enabled, the endpoint works without additional auth (consistent with current admin UI security model)
- Reset operation clears:
  - All projects
  - All environment variables
  - All API keys
  - All whitelist entries
  - The stored PK hash (allowing new mnemonic setup)

## Technical Changes

### 1. Database Interface (`packages/server/src/db/interface.ts`)

Add `reset()` method to `IDatabaseProvider`:

```typescript
interface IDatabaseProvider {
  // ... existing methods ...
  reset(): Promise<void>
}
```

### 2. SQLite Provider (`packages/server/src/db/sqlite.ts`)

Implement `reset()`:

```typescript
async reset(): Promise<void> {
  await this.disconnect()
  
  // Delete SQLite file and WAL files
  const files = [this.dbPath, `${this.dbPath}-wal`, `${this.dbPath}-shm`]
  for (const file of files) {
    try { fs.unlinkSync(file) } catch {}
  }
  
  // Reconnect and reinitialize
  await this.connect()
}
```

### 3. MongoDB Provider (`packages/server/src/db/mongo.ts`)

Implement `reset()`:

```typescript
async reset(): Promise<void> {
  const collections = await this.db.collections()
  for (const col of collections) {
    await col.drop()
  }
}
```

### 4. Server Endpoint (`packages/server/src/index.ts`)

Add reset endpoint:

```typescript
app.post('/api/reset', async (req, res) => {
  try {
    await db.reset()
    pk.clear()
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})
```

### 5. Admin UI (`packages/server/src/views/index.ejs`)

#### A. "Needs-PK" Screen (Lost Mnemonic Recovery)

Add below the mnemonic textarea:

```html
<div class="mt-4">
  <p class="text-sm text-base-content/70">Lost your recovery phrase?</p>
  <button @click="showResetDialog = true" class="btn btn-error btn-sm btn-outline">
    Reset Database (Start Fresh)
  </button>
</div>
```

#### B. Settings Tab (Danger Zone)

Add section for running server:

```html
<div class="divider">Danger Zone</div>
<div class="alert alert-error">
  <p>Resetting will permanently delete all projects, environment variables, API keys, and whitelist entries.</p>
  <button @click="showResetDialog = true" class="btn btn-error btn-sm">Reset Database</button>
</div>
```

#### C. Confirmation Dialog

```html
<dialog v-if="showResetDialog" class="modal modal-open">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Reset Database?</h3>
    <p class="py-4 text-error">
      This action cannot be undone. All data will be permanently deleted.
    </p>
    <p class="text-sm mb-2">Type "RESET" to confirm:</p>
    <input v-model="resetConfirmText" class="input input-bordered input-sm w-full" placeholder="RESET">
    <div class="modal-action">
      <button @click="showResetDialog = false" class="btn">Cancel</button>
      <button @click="doReset" class="btn btn-error" :disabled="resetConfirmText !== 'RESET'">Confirm Reset</button>
    </div>
  </div>
</dialog>
```

## API Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reset` | Basic Auth (if enabled) | Reset database to initial state |

### Response

**Success:**
```json
{ "ok": true }
```

**Error:**
```json
{ "error": "error message" }
```

## UI Flow

### Lost Mnemonic Recovery Flow

1. User starts server, sees "Setup Private Key" screen
2. Screen shows existing PK hash (data exists)
3. User doesn't have the 12-word phrase
4. User clicks "Lost your recovery phrase? Reset Database"
5. Confirmation dialog appears with warning
6. User types "RESET" and confirms
7. POST `/api/reset` is called
8. Server deletes DB file, clears PK hash
9. Page reloads, shows "first setup" state
10. New mnemonic is generated and displayed

### Normal Reset Flow (Server Running)

1. Admin navigates to Settings tab
2. Sees "Danger Zone: Reset Database"
3. Clicks "Reset Database"
4. Confirmation dialog appears
5. User types "RESET" and confirms
6. POST `/api/reset` is called
7. Server resets, page redirects to setup screen

## Files to Modify

1. `packages/server/src/db/interface.ts` - Add `reset()` to interface
2. `packages/server/src/db/sqlite.ts` - Implement SQLite reset
3. `packages/server/src/db/mongo.ts` - Implement MongoDB reset
4. `packages/server/src/index.ts` - Add `/api/reset` endpoint
5. `packages/server/src/views/index.ejs` - Add UI buttons and dialog

## Testing Considerations

- Test reset with SQLite database
- Test reset with MongoDB database
- Test reset when Basic Auth is enabled
- Test reset when Basic Auth is not enabled
- Verify all data is actually deleted
- Verify new mnemonic can be set after reset
- Verify server continues running after reset (no restart needed)

## Future Enhancements

1. **Backup before reset**: Option to export encrypted backup before resetting
2. **Session-based auth**: Proper login system for admin UI (instead of relying on Basic Auth)
3. **Audit log**: Log reset operations for security auditing
4. **Soft delete**: Option to archive data before deletion
