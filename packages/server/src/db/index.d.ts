import { IDatabaseProvider } from './interface';
export declare function createDatabase(dataDir: string, mongoUri?: string): Promise<{
    provider: IDatabaseProvider;
    active: 'sqlite' | 'mongodb';
}>;
//# sourceMappingURL=index.d.ts.map