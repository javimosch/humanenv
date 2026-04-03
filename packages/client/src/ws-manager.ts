import { generateFingerprint, ErrorCode, HumanEnvError } from './shared'
import WebSocket from 'ws'

export type ClientConfig = {
  serverUrl: string
  projectName: string
  projectApiKey?: string
  maxRetries?: number
}

type PendingOp = {
  resolve: (v: any) => void
  reject: (e: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export class HumanEnvClient {
  private ws: WebSocket | null = null
  private connected = false
  private authenticated = false
  private _whitelistStatus: 'approved' | 'pending' | 'rejected' | null = null
  private attempts = 0
  private pending = new Map<string, PendingOp>()
  private config: Required<ClientConfig>
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnecting = false
  private disconnecting = false
  private _authResolve: (() => void) | null = null
  private _authReject: ((e: Error) => void) | null = null

  get whitelistStatus(): 'approved' | 'pending' | 'rejected' | null {
    return this._whitelistStatus
  }

  constructor(config: ClientConfig) {
    this.config = {
      serverUrl: config.serverUrl,
      projectName: config.projectName,
      projectApiKey: config.projectApiKey || '',
      maxRetries: config.maxRetries ?? 10,
    }
  }

  private getFingerprint(): string {
    return generateFingerprint()
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.doConnect(resolve, reject)
    })
  }

  private doConnect(resolve: () => void, reject: (e: Error) => void): void {
    const proto = this.config.serverUrl.startsWith('https') ? 'wss' : 'ws'
    const host = this.config.serverUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const url = `${proto}://${host}/ws`

    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.connected = true
      this.attempts = 0
      this.reconnecting = false
      this.startPing()
      this.sendAuth(resolve, reject)
    })

    this.ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleMessage(msg)
      } catch { /* ignore */ }
    })

    this.ws.on('close', () => {
      this.connected = false
      this.authenticated = false
      this.stopPing()
      if (!this.disconnecting && !this.reconnecting) this.scheduleReconnect(reject)
    })

    this.ws.on('error', () => { /* handled via close */ })
  }

  private sendAuth(resolve: () => void, reject: (e: Error) => void): void {
    this._authResolve = resolve
    this._authReject = reject
    this.ws?.send(JSON.stringify({
      type: 'auth',
      payload: {
        projectName: this.config.projectName,
        apiKey: this.config.projectApiKey,
        fingerprint: this.getFingerprint(),
      }
    }))
  }

  private handleMessage(msg: any): void {
    if (msg.type === 'auth_response') {
      if (msg.payload.success) {
        this.authenticated = true
        this._whitelistStatus = msg.payload.status || (msg.payload.whitelisted ? 'approved' : 'pending')
        this._authResolve?.()
      } else {
        this._authReject?.(new HumanEnvError(msg.payload.code as ErrorCode, msg.payload.error))
      }
      this._authResolve = null
      this._authReject = null
      return
    }

    if (msg.type === 'get_response') {
      this._resolvePending('get', msg.payload)
      return
    }

    if (msg.type === 'set_response') {
      this._resolvePending('set', msg.payload)
      return
    }

    if (msg.type === 'pong') { /* keep-alive */ }
  }

  private _resolvePending(kind: 'get' | 'set', payload: any): void {
    for (const [id, op] of this.pending) {
      clearTimeout(op.timeout)
      this.pending.delete(id)
      if (payload.error) {
        op.reject(new HumanEnvError(payload.code as ErrorCode, payload.error))
      } else {
        op.resolve(payload)
      }
      return
    }
  }

  async get(key: string): Promise<string>
  async get(keys: string[]): Promise<Record<string, string>>
  async get(keyOrKeys: string | string[]): Promise<string | Record<string, string>> {
    if (!this.connected || !this.authenticated) throw new HumanEnvError(ErrorCode.CLIENT_AUTH_INVALID_API_KEY)

    if (Array.isArray(keyOrKeys)) {
      const result: Record<string, string> = {}
      await Promise.all(keyOrKeys.map(async (key) => {
        result[key] = await this._getSingle(key)
      }))
      return result
    }
    return this._getSingle(keyOrKeys)
  }

  private _getSingle(key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const msgId = `${key}-${Date.now()}`
      const timeout = setTimeout(() => {
        this.pending.delete(msgId)
        reject(new Error(`Timeout getting env: ${key}`))
      }, 8000)
      this.pending.set(msgId, { resolve: (v: any) => resolve(v.value), reject, timeout })
      this.ws?.send(JSON.stringify({ type: 'get', payload: { key } }))
    })
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.connected || !this.authenticated) throw new HumanEnvError(ErrorCode.CLIENT_AUTH_INVALID_API_KEY)
    const msgId = `set-${Date.now()}`
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(msgId)
        reject(new Error(`Timeout setting env: ${key}`))
      }, 8000)
      this.pending.set(msgId, { resolve, reject, timeout })
      this.ws?.send(JSON.stringify({ type: 'set', payload: { key, value } }))
    })
  }

  private scheduleReconnect(reject: (e: Error) => void): void {
    if (this.attempts >= this.config.maxRetries) {
      reject(new HumanEnvError(ErrorCode.CLIENT_CONN_MAX_RETRIES_EXCEEDED))
      return
    }
    this.reconnecting = true
    this.attempts++
    const delay = Math.min(1000 * Math.pow(2, this.attempts - 1), 30000)
    if (process.stdout.isTTY) {
      console.error(`[humanenv] Reconnecting in ${delay}ms (attempt ${this.attempts}/${this.config.maxRetries})...`)
    }
    this.retryTimer = setTimeout(() => {
      this.doConnect(() => {}, reject)
    }, delay)
  }

  private startPing(): void {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)
  }

  private stopPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
  }

  /** Connect (creates fresh WS) and waits for auth response up to `timeoutMs`. Resolves silently on timeout. */
  async connectAndWaitForAuth(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      // If already connected and authenticated, resolve immediately
      if (this.connected && this.authenticated) { resolve(); return }

      const deadline = Date.now() + timeoutMs
      const checkInterval = setInterval(() => {
        if (this.connected && this.authenticated) {
          clearInterval(checkInterval)
          resolve()
          return
        }
        if (Date.now() >= deadline) {
          clearInterval(checkInterval)
          resolve()
          return
        }
      }, 200)

      // If not connected, establish connection
      if (!this.connected) {
        this.attempts = 0
        this.doConnect(() => {
          // connected, now waiting for auth
        }, () => {
          clearInterval(checkInterval)
          resolve()
        })
      }
    })
  }

  disconnect(): void {
    this.stopPing()
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
    this.disconnecting = true
    this.reconnecting = false
    this.ws?.close()
  }
}
