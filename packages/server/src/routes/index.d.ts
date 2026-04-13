import { Router } from 'express';
import { IDatabaseProvider } from '../db/interface';
import { PkManager } from '../pk-manager';
export declare function createProjectsRouter(db: IDatabaseProvider, pk: PkManager): Router;
export declare function createEnvsRouter(db: IDatabaseProvider, pk: PkManager): Router;
export declare function createApiKeysRouter(db: IDatabaseProvider, pk: PkManager): Router;
export declare function createWhitelistRouter(db: IDatabaseProvider): Router;
export declare function createGlobalSettingsRouter(db: IDatabaseProvider): Router;
//# sourceMappingURL=index.d.ts.map