export interface IDatabaseProvider {
  connect(): Promise<void>
  disconnect(): Promise<void>
  
  // Project CRUD
  createProject(name: string): Promise<{ id: string }>
  getProject(name: string): Promise<{ id: string; name: string; createdAt: number } | null>
  listProjects(): Promise<Array<{ id: string; name: string; createdAt: number }>>
  deleteProject(id: string): Promise<void>
  
  // Env CRUD
  createEnv(projectId: string, key: string, encryptedValue: string, apiModeOnly: boolean): Promise<{ id: string }>
  getEnv(projectId: string, key: string): Promise<{ encryptedValue: string; apiModeOnly: boolean } | null>
  listEnvs(projectId: string): Promise<Array<{ id: string; key: string; apiModeOnly: boolean; createdAt: number }>>
  updateEnv(projectId: string, key: string, encryptedValue: string, apiModeOnly: boolean): Promise<void>
  deleteEnv(projectId: string, key: string): Promise<void>
  
  // API Key CRUD
  createApiKey(projectId: string, encryptedValue: string, plainValue: string, ttl?: number): Promise<{ id: string }>
  getApiKey(projectId: string, plainValue: string): Promise<{ id: string; expiresAt?: number } | null>
  listApiKeys(projectId: string): Promise<Array<{ id: string; maskedPreview: string; ttl?: number; expiresAt?: number; createdAt: number }>>
  revokeApiKey(projectId: string, id: string): Promise<void>
  
  // Whitelist CRUD
  createWhitelistEntry(projectId: string, fingerprint: string, status: 'pending' | 'approved' | 'rejected'): Promise<{ id: string }>
  getWhitelistEntry(projectId: string, fingerprint: string): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' } | null>
  listWhitelistEntries(projectId: string): Promise<Array<{ id: string; fingerprint: string; status: 'pending' | 'approved' | 'rejected'; createdAt: number }>>
  updateWhitelistStatus(id: string, status: 'approved' | 'rejected'): Promise<void>
  
  // PK verification (stores hash only)
  storePkHash(hash: string): Promise<void>
  getPkHash(): Promise<string | null>
}
