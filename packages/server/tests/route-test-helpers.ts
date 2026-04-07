import express from 'express'
import http from 'http'
import type { IDatabaseProvider } from '../src/db/interface.ts'
import type { PkManager } from '../src/pk-manager.ts'

export function createMockDb(): IDatabaseProvider {
  return {
    connect: async () => {},
    disconnect: async () => {},
    createProject: async () => ({ id: 'proj-1' }),
    getProject: async () => null,
    listProjects: async () => [],
    deleteProject: async () => {},
    updateProject: async () => {},
    createEnv: async () => ({ id: 'env-1' }),
    getEnv: async () => null,
    listEnvs: async () => [],
    listEnvsWithValues: async () => [],
    updateEnv: async () => {},
    deleteEnv: async () => {},
    createApiKey: async () => ({ id: 'key-1' }),
    getApiKey: async () => null,
    listApiKeys: async () => [],
    revokeApiKey: async () => {},
    updateApiKeyLastUsed: async () => {},
    createWhitelistEntry: async () => ({ id: 'wl-1' }),
    getWhitelistEntry: async () => null,
    listWhitelistEntries: async () => [],
    updateWhitelistStatus: async () => {},
    storePkHash: async () => {},
    getPkHash: async () => null,
    storeGlobalSetting: async () => {},
    getGlobalSetting: async () => null,
  }
}

export function createMockPk(): PkManager {
  return {
    encrypt: (value: string, _aad: string) => `enc:${value}`,
    decrypt: (encrypted: string, _aad: string) => encrypted.replace('enc:', ''),
  } as unknown as PkManager
}

export function startApp(setupRoutes: (app: express.Express) => void): Promise<{ server: http.Server; base: string }> {
  return new Promise((resolve) => {
    const app = express()
    app.use(express.json())
    setupRoutes(app)
    const server = http.createServer(app)
    server.listen(0, () => {
      const addr = server.address() as { port: number }
      resolve({ server, base: `http://127.0.0.1:${addr.port}` })
    })
  })
}
