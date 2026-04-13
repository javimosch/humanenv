import { HumanEnvClient, type ClientConfig } from './ws-manager.js';
export { HumanEnvClient };
export type { ClientConfig };
declare const _default: {
    config(cfg: ClientConfig): void;
    get(keyOrKeys: string | string[]): Promise<string | Record<string, string>>;
    set(key: string, value: string): Promise<void>;
    disconnect(): void;
};
export default _default;
//# sourceMappingURL=index.d.ts.map