import { Database } from 'sqlite3';
interface QueryResult<T = any> {
    success: boolean;
    data?: T;
    error?: Error;
}
interface TransactionQuery {
    query: string;
    params?: any[];
}
declare const executeQuery: <T = any>(connection: Database, query: string, params?: any[]) => Promise<QueryResult<T>>;
declare const executeTransaction: (connection: Database, queries: TransactionQuery[]) => Promise<QueryResult>;
declare const backup: (connection: Database, backupPath: string) => Promise<QueryResult>;
declare const restore: (connection: Database, backupPath: string) => Promise<QueryResult>;
export { executeQuery, executeTransaction, backup, restore };
//# sourceMappingURL=sqlite.d.ts.map