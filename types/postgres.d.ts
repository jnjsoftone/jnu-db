interface QueryResult<T = any> {
    success: boolean;
    rows?: T[];
    data?: T;
    error?: Error;
}
interface TransactionQuery {
    query: string;
    params?: any[];
}
interface BackupResult {
    success: boolean;
    tables?: string[];
    error?: Error;
}
interface TransactionResult {
    success: boolean;
    data?: any[];
    error?: Error;
}
declare const executeQuery: (connection: any, query: string, params?: any[]) => Promise<QueryResult>;
declare const executeTransaction: (connection: any, queries: TransactionQuery[]) => Promise<TransactionResult>;
declare const backup: (connection: Client, backupPath: string) => Promise<BackupResult>;
declare const restore: (connection: Client, backupPath: string) => Promise<QueryResult>;
export { executeQuery, executeTransaction, backup, restore };
//# sourceMappingURL=postgres.d.ts.map