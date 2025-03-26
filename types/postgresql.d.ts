import { PoolClient, QueryResult } from 'pg';
interface PostgresConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number;
    max?: number;
}
interface QueryResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
declare const createPool: (config: PostgresConfig) => Pool;
declare const connect: (config: PostgresConfig) => Promise<PoolClient | null>;
declare const disconnect: (client: PoolClient) => Promise<void>;
declare const executeQuery: <T>(client: PoolClient, query: string, params?: any[]) => Promise<QueryResult<T[]>>;
declare const executeTransaction: <T>(client: PoolClient, queries: {
    query: string;
    params?: any[];
}[]) => Promise<QueryResult<T[]>>;
declare const backup: (client: PoolClient, backupPath: string) => Promise<QueryResult<void>>;
declare const restore: (client: PoolClient, backupPath: string) => Promise<QueryResult<void>>;
export { createPool, connect, disconnect, executeQuery, executeTransaction, backup, restore };
//# sourceMappingURL=postgresql.d.ts.map