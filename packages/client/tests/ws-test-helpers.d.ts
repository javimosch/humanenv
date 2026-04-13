import { HumanEnvClient } from '../src/ws-manager.ts';
export declare class MockWebSocket {
    static OPEN: number;
    readyState: number;
    handlers: Record<string, Array<(data?: any) => void>>;
    sentMessages: string[];
    closed: boolean;
    on(event: string, handler: (data?: any) => void): void;
    send(data: string): void;
    close(): void;
    trigger(event: string, data?: any): void;
    lastSent(): any;
}
export declare function makeClient(overrides?: Partial<ConstructorParameters<typeof HumanEnvClient>[0]>): HumanEnvClient;
export declare function injectMockWs(client: HumanEnvClient, ws: MockWebSocket, opts?: {
    connected?: boolean;
    authenticated?: boolean;
}): void;
//# sourceMappingURL=ws-test-helpers.d.ts.map