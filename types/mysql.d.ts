import { Connection, Pool } from 'mysql2/promise';
interface MySqlConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number;
    connectionLimit?: number;
}
interface QueryResult<T = any> {
    success: boolean;
    data?: T;
    error?: Error;
}
interface TransactionQuery {
    query: string;
    params?: any[];
}
interface TransactionResult {
    success: boolean;
    data?: any[];
    error?: Error;
}
declare const createPool: (config: MySqlConfig) => Pool;
declare const executeQuery: (connection: Connection, query: string, params?: any[]) => Promise<QueryResult>;
declare const executeTransaction: (connection: Connection, queries: TransactionQuery[]) => Promise<TransactionResult>;
declare const backup: (connection: Connection, backupPath: string) => Promise<QueryResult>;
declare const restore: (connection: Connection, backupPath: string) => Promise<QueryResult>;
export { createPool, executeQuery, executeTransaction, backup, restore };
//# sourceMappingURL=mysql.d.ts.map