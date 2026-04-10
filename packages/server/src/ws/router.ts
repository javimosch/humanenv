import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { IDatabaseProvider } from '../db/interface'
import { PkManager } from '../pk-manager'
import { ErrorCode, HumanEnvError, ErrorMessages, WsMessage, AuthResponse } from 'humanenv-shared'

type PendingRequestResolver = { resolve: (msg: any) => void; reject: (e: any) => void; timeout: ReturnType<typeof setTimeout> }

export class WsRouter {
  private wss: WebSocketServer
  private pendingRequests = new Map<string, PendingRequestResolver>()
  private adminClients = new Set<WebSocket>()
  private clientSessions = new Map<WebSocket, { projectName: string; fingerprint: string; authenticated: boolean }>()
  private autoAcceptApiKey = false
  private lastUsedMap = new Map<string, number>()
  private lastUsedFlushInterval: ReturnType<typeof setInterval>

  constructor(
    private server: any,
    private db: IDatabaseProvider,
    private pk: PkManager
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws' })
    this.wss.on('connection', this.onConnection.bind(this))
    this.lastUsedFlushInterval = setInterval(() => this.flushLastUsed(), 60_000)
  }

  async shutdown(): Promise<void> {
    clearInterval(this.lastUsedFlushInterval)
    await this.flushLastUsed()
  }

  private async flushLastUsed(): Promise<void> {
    if (this.lastUsedMap.size === 0) return
    const batch = new Map(this.lastUsedMap)
    this.lastUsedMap.clear()
    for (const [id, ts] of batch) {
      try { await this.db.updateApiKeyLastUsed(id, ts) } catch {}
    }
  }

  /** Register admin UI WS clients */
  registerAdminClient(ws: WebSocket): void {
    this.adminClients.add(ws)
    ws.on('close', () => this.adminClients.delete(ws))
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage
        this.handleAdminMessage(ws, msg)
      } catch (e) {
        // ignore malformed admin messages
      }
    })
  }

  unregisterAdminClient(ws: WebSocket): void {
    this.adminClients.delete(ws)
  }

  setAutoAcceptApiKey(value: boolean): void {
    this.autoAcceptApiKey = value
  }

  getAutoAcceptApiKey(): boolean {
    return this.autoAcceptApiKey
  }

  /** Broadcast event to all admin UI clients */
  broadcastAdmin(event: string, payload: any): void {
    const data = JSON.stringify({ event, payload })
    for (const ws of this.adminClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    }
  }

  /** Resolve a pending request from admin action */
  resolvePending(id: string, response: any): void {
    const pending = this.pendingRequests.get(id)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(response)
      this.pendingRequests.delete(id)
    }
  }

  rejectPending(id: string, error: string): void {
    const pending = this.pendingRequests.get(id)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.reject(error)
      this.pendingRequests.delete(id)
    }
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    // Admin UI connects to /ws/admin
    if (req.url?.startsWith('/ws/admin')) {
      this.registerAdminClient(ws)
      ws.send(JSON.stringify({ event: 'admin_connected', payload: { ok: true } }))
      return
    }

    // Client SDK connects to /ws
    this.setupClient(ws)
  }

  private setupClient(ws: WebSocket): void {
    let authState: { projectName: string; fingerprint: string } | null = null
    let authenticated = false

    const send = (msg: WsMessage) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
    }

    ws.on('message', async (raw) => {
      let msg: WsMessage | null = null
      try {
        msg = JSON.parse(raw.toString()) as WsMessage
      } catch {
        send({ type: 'get_response', payload: { error: 'Malformed request', code: ErrorCode.SERVER_INTERNAL_ERROR } })
        return
      }

      if (!this.pk.isReady() && msg.type !== 'auth') {
        send({ type: (msg.type === 'get' ? 'get_response' : 'set_response') as any, payload: { error: ErrorMessages.SERVER_PK_NOT_AVAILABLE, code: ErrorCode.SERVER_PK_NOT_AVAILABLE } })
        return
      }

      switch (msg.type) {
        case 'auth': {
          const { projectName, apiKey, fingerprint } = msg.payload as any
          const project = await this.db.getProject(projectName)
          if (!project) {
            send({ type: 'auth_response', payload: { success: false, whitelisted: false, error: ErrorMessages.CLIENT_AUTH_INVALID_PROJECT_NAME, code: ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME } })
            return
          }

          // API key is optional - if provided and requireApiKey is true, validate it
          // If server doesn't require API key, ignore provided key even if invalid
          if (apiKey && apiKey.trim() !== '') {
            const apiKeyDoc = await this.db.getApiKey(project.id, apiKey)
            if (!apiKeyDoc) {
              if (project.requireApiKey) {
                send({ type: 'auth_response', payload: { success: false, whitelisted: false, error: ErrorMessages.CLIENT_AUTH_INVALID_API_KEY, code: ErrorCode.CLIENT_AUTH_INVALID_API_KEY } })
                return
              }
            } else {
              this.lastUsedMap.set(apiKeyDoc.id, Date.now())
            }
          } else if (project.requireApiKey) {
            send({ type: 'auth_response', payload: { success: false, whitelisted: false, error: ErrorMessages.CLIENT_AUTH_INVALID_API_KEY, code: ErrorCode.CLIENT_AUTH_INVALID_API_KEY } })
            return
          }

          let wl = await this.db.getWhitelistEntry(project.id, fingerprint)
          const wlStatus = wl?.status || null

          if (!wl) {
            // Create a pending whitelist entry and notify admin
            await this.db.createWhitelistEntry(project.id, fingerprint, 'pending')
            this.broadcastAdmin('whitelist_pending', { fingerprint, projectName: project.name, projectId: project.id })
          }

          authState = { projectName, fingerprint }
          authenticated = true
          send({ type: 'auth_response', payload: { success: true, whitelisted: wlStatus === 'approved', status: wlStatus || 'pending' } })
          break
        }

        case 'get': {
          if (!authenticated) {
            send({ type: 'get_response', payload: { error: 'Not authenticated', code: ErrorCode.CLIENT_AUTH_INVALID_API_KEY } })
            return
          }
          const { key } = msg.payload as any
          const project = await this.db.getProject(authState!.projectName)
          if (!project) return send({ type: 'get_response', payload: { error: ErrorMessages.CLIENT_AUTH_INVALID_PROJECT_NAME, code: ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME } })

          if (project.fingerprintVerification) {
            const wl = await this.db.getWhitelistEntry(project.id, authState!.fingerprint)
            if (wl?.status !== 'approved') {
              return send({ type: 'get_response', payload: { error: ErrorMessages.CLIENT_AUTH_NOT_WHITELISTED, code: ErrorCode.CLIENT_AUTH_NOT_WHITELISTED } })
            }
          }

          const env = await this.db.getEnv(project.id, key)
          if (!env) return send({ type: 'get_response', payload: { error: `Key not found: ${key}`, code: ErrorCode.SERVER_INTERNAL_ERROR } })

          // NOTE: apiModeOnly flag is reserved for future CLI/SDK channel distinction
          // Currently all authenticated clients (SDK and CLI) can access all envs
          // if (env.apiModeOnly) {
          //   return send({ type: 'get_response', payload: { error: ErrorMessages.ENV_API_MODE_ONLY, code: ErrorCode.ENV_API_MODE_ONLY } })
          // }

          const decrypted = this.pk.decrypt(env.encryptedValue, `${project.id}:${key}`)
          send({ type: 'get_response', payload: { key, value: decrypted } })
          break
        }

        case 'set': {
          if (!authenticated) {
            send({ type: 'set_response', payload: { error: 'Not authenticated', code: ErrorCode.CLIENT_AUTH_INVALID_API_KEY } })
            return
          }
          const { key, value } = msg.payload as any
          const project = await this.db.getProject(authState!.projectName)
          if (!project) return send({ type: 'set_response', payload: { error: ErrorMessages.CLIENT_AUTH_INVALID_PROJECT_NAME, code: ErrorCode.CLIENT_AUTH_INVALID_PROJECT_NAME } })

          if (project.fingerprintVerification) {
            const wl = await this.db.getWhitelistEntry(project.id, authState!.fingerprint)
            if (wl?.status !== 'approved') {
              return send({ type: 'set_response', payload: { error: ErrorMessages.CLIENT_AUTH_NOT_WHITELISTED, code: ErrorCode.CLIENT_AUTH_NOT_WHITELISTED } })
            }
          }

          const existing = await this.db.getEnv(project.id, key)
          const encrypted = this.pk.encrypt(value, `${project.id}:${key}`)

          if (existing) {
            await this.db.updateEnv(project.id, key, encrypted)
          } else {
            await this.db.createEnv(project.id, key, encrypted)
          }

          send({ type: 'set_response', payload: { success: true } })
          break
        }

        case 'ping':
          send({ type: 'pong' })
          break

        default:
          send({ type: 'get_response', payload: { error: 'Unknown message type', code: ErrorCode.SERVER_INTERNAL_ERROR } })
      }
    })

    ws.on('close', () => {
      // cleanup
    })
  }

  private handleAdminMessage(ws: WebSocket, msg: WsMessage): void {
    switch (msg.type) {
      case 'whitelist_response': {
        const { fingerprint, approved } = msg.payload as any
        // We need projectId and fingerprint to update - admin sends this via REST actually
        // For simplicity, this WS channel just notifies the admin; the actual approve/reject
        // is done via REST API which calls db.updateWhitelistStatus()
        // We can broadcast the decision if needed
        break
      }
      case 'apikey_response': {
        const { reqId, approved, projectName } = msg.payload as any
        this.resolvePending(reqId, { approved, projectName })
        break
      }
    }
  }
}
