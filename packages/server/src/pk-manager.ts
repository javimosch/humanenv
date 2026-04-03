import { derivePkFromMnemonic, hashPkForVerification, validateMnemonic, generateMnemonic, decryptWithPk, encryptWithPk, generateFingerprint } from 'humanenv-shared'
import { HumanEnvError, ErrorCode } from 'humanenv-shared'
import fs from 'fs'
import path from 'path'
import os from 'os'

const TEMPORAL_PK_FILE = path.join(process.env.DATA_DIR || path.join(os.homedir(), '.humanenv'), 'temporal-pk.dat')

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function sanitizeProjectName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

async function buildTemporalSalt(db: { listProjects(): Promise<Array<{ name: string }>> }): Promise<string> {
  const date = getTodayDate().replace(/-/g, '')
  try {
    const projects = await db.listProjects()
    if (projects.length === 0) return date
    const names = projects.map(p => sanitizeProjectName(p.name)).sort().join('_')
    return names ? `${date}_${names}` : date
  } catch {
    return date
  }
}

export class PkManager {
  private pk: Buffer | null = null
  private mnemonic: string | null = null
  private temporalPkEnabled = false
  private dbForTemporal: { listProjects(): Promise<Array<{ name: string }>> } | null = null

  async bootstrap(storedHash: string | null, db: { getGlobalSetting(key: string): Promise<string | null>; listProjects(): Promise<Array<{ name: string }>> }): Promise<{ status: 'ready' | 'needs_input'; existing?: 'hash' | 'first' }> {
    this.temporalPkEnabled = await this.isTemporalPkEnabled(db)
    this.dbForTemporal = db

    if (this.temporalPkEnabled) {
      const loadedFromFile = await this.loadTemporalPk(storedHash)
      if (loadedFromFile) {
        return { status: 'ready', existing: storedHash ? 'hash' : 'first' }
      }
    }

    const envMnemonic = process.env.HUMANENV_MNEMONIC
    if (envMnemonic) {
      const trimmed = envMnemonic.trim()
      if (!validateMnemonic(trimmed)) {
        throw new HumanEnvError(ErrorCode.SERVER_INTERNAL_ERROR, 'HUMANENV_MNEMONIC env contains invalid mnemonic')
      }
      this.mnemonic = trimmed
      this.pk = derivePkFromMnemonic(trimmed)
      const derivedHash = hashPkForVerification(this.pk)
      if (storedHash && derivedHash !== storedHash) {
        console.warn('WARN: Derived PK hash does not match stored hash. Data may be unrecoverable.')
      }
      console.log('PK restored from HUMANENV_MNEMONIC env var.')
      return { status: 'ready', existing: storedHash ? 'hash' : 'first' }
    }

    if (!storedHash) {
      return { status: 'needs_input', existing: 'first' }
    }

    return { status: 'needs_input', existing: 'hash' }
  }

  async isTemporalPkEnabled(db: { getGlobalSetting(key: string): Promise<string | null> }): Promise<boolean> {
    if (process.env.HUMANENV_TEMPORAL_PK === 'true') return true
    const stored = await db.getGlobalSetting('temporal-pk')
    return stored === 'true'
  }

  private async loadTemporalPk(storedHash: string | null): Promise<boolean> {
    if (!fs.existsSync(TEMPORAL_PK_FILE)) return false

    try {
      const encrypted = fs.readFileSync(TEMPORAL_PK_FILE, 'utf8')
      const salt = await buildTemporalSalt(this.dbForTemporal!)

      const tempPk = derivePkFromMnemonic(salt)
      const decrypted = decryptWithPk(encrypted, tempPk as any, 'temporal-pk')

      if (!validateMnemonic(decrypted)) {
        throw new Error('Invalid mnemonic in temporal file')
      }

      this.mnemonic = decrypted
      this.pk = derivePkFromMnemonic(decrypted)
      const derivedHash = hashPkForVerification(this.pk)
      if (storedHash && derivedHash !== storedHash) {
        console.warn('WARN: Derived PK hash does not match stored hash. Data may be unrecoverable.')
      }

      fs.unlinkSync(TEMPORAL_PK_FILE)
      console.log('PK restored from temporal file.')
      return true
    } catch (e) {
      try { fs.unlinkSync(TEMPORAL_PK_FILE) } catch {}
      console.warn('Failed to load temporal PK, removing corrupted file:', e instanceof Error ? e.message : 'unknown')
      return false
    }
  }

  async saveTemporalPk(): Promise<void> {
    if (!this.pk || !this.mnemonic) return
    if (!this.temporalPkEnabled || !this.dbForTemporal) return

    try {
      const salt = await buildTemporalSalt(this.dbForTemporal)
      const tempPk = derivePkFromMnemonic(salt)
      const encrypted = encryptWithPk(this.mnemonic, tempPk as any, 'temporal-pk')
      fs.writeFileSync(TEMPORAL_PK_FILE, encrypted, { mode: 0o600 })
      console.log('PK saved to temporal file for restart survival.')
    } catch (e) {
      console.warn('Failed to save temporal PK:', e instanceof Error ? e.message : 'unknown')
    }
  }

  isReady(): boolean {
    return this.pk !== null
  }

  getPk(): Uint8Array {
    if (!this.pk) throw new HumanEnvError(ErrorCode.SERVER_PK_NOT_AVAILABLE)
    return this.pk as unknown as Uint8Array
  }

  getMnemonic(): string {
    if (!this.mnemonic) {
      this.mnemonic = generateMnemonic()
    }
    return this.mnemonic
  }

  submitMnemonic(mnemonic: string, storedHash: string | null): { hash: string; verified: boolean; firstSetup: boolean } {
    const trimmed = mnemonic.trim()
    if (!validateMnemonic(trimmed)) {
      throw new Error('Invalid mnemonic: must be a 12-word BIP39-compatible phrase')
    }
    const derived = derivePkFromMnemonic(trimmed)
    const hash = hashPkForVerification(derived)
    
    if (storedHash && hash !== storedHash) {
      throw new Error('Mnemonic does not match the stored hash. Data was encrypted with a different key.')
    }

    this.pk = derived
    this.mnemonic = trimmed
    return { hash, verified: true, firstSetup: !storedHash }
  }

  encrypt(value: string, aad: string): string {
    return encryptWithPk(value, this.getPk() as any, aad)
  }

  decrypt(encryptedValue: string, aad: string): string {
    return decryptWithPk(encryptedValue, this.getPk() as any, aad)
  }

  clear(): void {
    this.pk = null
    this.mnemonic = null
  }
}

export { generateFingerprint }
