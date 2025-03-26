import { PrismaClient } from '@prisma/client';
interface PrismaConfig {
    datasource: {
        url: string;
    };
}
interface QueryResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
declare const connect: (config: PrismaConfig) => Promise<PrismaClient | null>;
declare const disconnect: (client: PrismaClient) => Promise<void>;
declare const executeQuery: <T>(client: PrismaClient, model: string, operation: string, args?: any) => Promise<QueryResult<T>>;
declare const executeTransaction: <T>(client: PrismaClient, operations: {
    model: string;
    operation: string;
    args: any;
}[]) => Promise<QueryResult<T[]>>;
declare const backup: (client: PrismaClient, backupPath: string) => Promise<QueryResult<void>>;
declare const restore: (client: PrismaClient, backupPath: string) => Promise<QueryResult<void>>;
export { connect, disconnect, executeQuery, executeTransaction, backup, restore };
//# sourceMappingURL=prisma.d.ts.map