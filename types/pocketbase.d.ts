import PocketBase from 'pocketbase';
interface PocketBaseConfig {
    url: string;
    email?: string;
    password?: string;
}
interface QueryResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
declare const connect: (config: PocketBaseConfig) => Promise<PocketBase | null>;
declare const disconnect: (client: PocketBase) => Promise<void>;
declare const executeQuery: <T>(client: PocketBase, collection: string, query?: any) => Promise<QueryResult<T[]>>;
declare const executeTransaction: <T>(client: PocketBase, operations: {
    collection: string;
    operation: 'create' | 'update' | 'delete';
    data?: any;
    id?: string;
}[]) => Promise<QueryResult<T[]>>;
declare const backup: (client: PocketBase, backupPath: string) => Promise<QueryResult<void>>;
declare const restore: (client: PocketBase, backupPath: string) => Promise<QueryResult<void>>;
export { connect, disconnect, executeQuery, executeTransaction, backup, restore };
//# sourceMappingURL=pocketbase.d.ts.map