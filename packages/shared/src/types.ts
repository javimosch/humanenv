// ============================================================
// Domain models
// ============================================================

export interface Project {
  id: string
  name: string
  createdAt: number
}

export interface Env {
  id: string
  projectId: string
  key: string
  encryptedValue: string
  apiModeOnly: boolean
  createdAt: number
}

export interface ApiKey {
  id: string
  projectId: string
  encryptedValue: string
  ttl?: number
  expiresAt?: number
  createdAt: number
}

export interface WhitelistEntry {
  id: string
  projectId: string
  fingerprint: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

// ============================================================
// WebSocket message types
// ============================================================

export type WsMessage =
  | { type: 'auth'; payload: AuthPayload }
  | { type: 'auth_response'; payload: AuthResponse }
  | { type: 'get'; payload: { key: string } }
  | { type: 'get_response'; payload: { key: string; value: string } | { error: string; code: string } }
  | { type: 'set'; payload: { key: string; value: string } }
  | { type: 'set_response'; payload: { success: boolean } | { error: string; code: string } }
  | { type: 'generate_api_key'; payload: { projectName: string } }
  | { type: 'apikey_request'; payload: { clientFingerprint: string; projectName: string } }
  | { type: 'apikey_response'; payload: { success: boolean; apiKey?: string } | { error: string; code: string } }
  | { type: 'whitelist_request'; payload: { fingerprint: string; projectName: string } }
  | { type: 'whitelist_response'; payload: { fingerprint: string; approved: boolean } }
  | { type: 'disconnect'; payload?: never }
  | { type: 'ping'; payload?: never }
  | { type: 'pong'; payload?: never }

export interface AuthPayload {
  projectName: string
  apiKey: string
  fingerprint: string
}

export interface AuthResponse {
  success: boolean
  whitelisted: boolean
  status?: 'approved' | 'pending' | 'rejected'
  error?: string
  code?: string
}

// ============================================================
// Client library config
// ============================================================

export interface ClientConfig {
  serverUrl: string
  projectName: string
  projectApiKey?: string
  maxRetries?: number
}

export interface ServerConfig {
  port: number
  basicAuth?: { username: string; password: string }
  dataDir: string
  dbUri?: string
}

export type CredentialStore = {
  projectName: string
  serverUrl: string
  apiKey?: string
}

export interface SkillMetadata {
  name: string
  description: string
  category?: string
}

export const SKILL_CONTENT = `---
name: humanenv-usage
description: Use humanenv to retrieve sensitives/envs. Never log/read sensitives from humanenv. They are envs for humans only.
---

## How to retrieve sensitives

### JavaScript API
Use \`humanenv.get('key')\` inside your application. The returned value must be used immediately and then set to \`null\` to prevent memory leaks.

### CLI (non-TTY mode)
Only non-API-mode envs are accessible. Do not attempt to use this to log or dump all envs.

## Rules
1. NEVER log env values retrieved from humanenv
2. NEVER dump or export multiple values at once
3. ALWAYS null variables after use
4. NEVER write sensitives to files
5. Do not generate scripts that use humanenv in loops or to exfiltrate data`
