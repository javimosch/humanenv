import { derivePkFromMnemonic, hashPkForVerification, validateMnemonic, generateMnemonic, decryptWithPk, encryptWithPk, generateFingerprint } from 'humanenv-shared'
import { HumanEnvError, ErrorCode } from 'humanenv-shared'

export class PkManager {
  private pk: Buffer | null = null
  private mnemonic: string | null = null

  async bootstrap(storedHash: string | null): Promise<{ status: 'ready' | 'needs_input'; existing?: 'hash' | 'first' }> {
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
