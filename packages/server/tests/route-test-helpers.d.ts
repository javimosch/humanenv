import express from 'express';
import http from 'http';
import type { IDatabaseProvider } from '../src/db/interface.ts';
import type { PkManager } from '../src/pk-manager.ts';
export declare function createMockDb(): IDatabaseProvider;
export declare function createMockPk(): PkManager;
export declare function startApp(setupRoutes: (app: express.Express) => void): Promise<{
    server: http.Server;
    base: string;
}>;
//# sourceMappingURL=route-test-helpers.d.ts.map