import { MongoClient, Db, Document, Filter } from 'mongodb';
interface MongoConfig {
    url: string;
    dbName: string;
}
interface QueryResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
declare const connect: (config: MongoConfig) => Promise<{
    client: MongoClient;
    db: Db;
} | null>;
declare const disconnect: (client: MongoClient) => Promise<void>;
declare const executeQuery: <T extends Document>(db: Db, collectionName: string, query: Filter<T>, options?: any) => Promise<QueryResult<T[]>>;
declare const executeTransaction: <T extends Document>(db: Db, client: MongoClient, operations: {
    collection: string;
    operation: 'insert' | 'update' | 'delete';
    query: Document;
    update?: Document;
    options?: any;
}[]) => Promise<QueryResult<any[]>>;
declare const backup: (db: Db, backupPath: string) => Promise<QueryResult<void>>;
declare const restore: (db: Db, client: MongoClient, backupPath: string) => Promise<QueryResult<void>>;
export { connect, disconnect, executeQuery, executeTransaction, backup, restore };
//# sourceMappingURL=mongodb.d.ts.map