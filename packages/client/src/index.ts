import { HumanEnvClient, type ClientConfig } from './ws-manager.js';

export { HumanEnvClient };
export type { ClientConfig };

let singleton: HumanEnvClient | null = null
let configSet = false

async function ensure(): Promise<HumanEnvClient> {
  if (!singleton) throw new Error('humanenv.config() must be called first')
  return singleton
}

export default {
  config(cfg: ClientConfig): void {
    if (configSet) return
    configSet = true
    singleton = new HumanEnvClient(cfg)
  },
  async get(keyOrKeys: string | string[]): Promise<string | Record<string, string>> {
    const client = await ensure()
    return client.get(keyOrKeys as any)
  },
  async set(key: string, value: string): Promise<void> {
    const client = await ensure()
    return client.set(key, value)
  },
  disconnect(): void {
    if (singleton) { singleton.disconnect(); singleton = null; configSet = false }
  },
}
