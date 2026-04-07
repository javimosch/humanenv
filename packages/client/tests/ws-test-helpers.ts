import { HumanEnvClient } from '../src/ws-manager.ts'

export class MockWebSocket {
  static OPEN = 1
  readyState = 1
  handlers: Record<string, Array<(data?: any) => void>> = {}
  sentMessages: string[] = []
  closed = false

  on(event: string, handler: (data?: any) => void) {
    if (!this.handlers[event]) this.handlers[event] = []
    this.handlers[event].push(handler)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.closed = true
  }

  trigger(event: string, data?: any) {
    (this.handlers[event] || []).forEach(h => h(data))
  }

  lastSent(): any {
    return JSON.parse(this.sentMessages[this.sentMessages.length - 1])
  }
}

export function makeClient(overrides: Partial<ConstructorParameters<typeof HumanEnvClient>[0]> = {}): HumanEnvClient {
  return new HumanEnvClient({
    serverUrl: 'http://localhost:3056',
    projectName: 'test-project',
    projectApiKey: 'test-key',
    ...overrides,
  })
}

export function injectMockWs(client: HumanEnvClient, ws: MockWebSocket, opts: { connected?: boolean; authenticated?: boolean } = {}) {
  ;(client as any).ws = ws
  ;(client as any).connected = opts.connected ?? true
  ;(client as any).authenticated = opts.authenticated ?? true
}
