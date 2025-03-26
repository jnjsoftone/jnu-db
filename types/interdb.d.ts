import { Database as SQLiteDatabase } from 'sqlite3';
import { Client as PostgresClient } from 'pg';
import { Connection as MySQLConnection } from 'mysql2/promise';
type DatabaseType = 'sqlite' | 'postgres' | 'mysql';
interface DatabaseConnection {
    type: DatabaseType;
    connection: SQLiteDatabase | PostgresClient | MySQLConnection;
}
interface MigrationOptions {
    sourceDb: DatabaseConnection;
    targetDb: DatabaseConnection;
    tables?: string[];
    batchSize?: number;
}
interface MigrationResult {
    success: boolean;
    tables?: {
        name: string;
        rows: number;
        error?: Error;
    }[];
    error?: Error;
    data?: any;
}
declare const migrate: (sourceDb: DatabaseConnection, targetDb: DatabaseConnection, tableName: string) => Promise<MigrationResult>;
export { migrate, DatabaseType, DatabaseConnection, MigrationOptions, MigrationResult };
//# sourceMappingURL=interdb.d.ts.map