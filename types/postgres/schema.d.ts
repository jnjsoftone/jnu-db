import { Pool } from 'pg';
import { TableSchema, DbConfig } from '../types';
export declare class PostgresSchemaManager {
    pool: Pool;
    private config;
    constructor(config: DbConfig);
    close(): Promise<void>;
    findTables(keyword?: string): Promise<string[]>;
    removeTables(keyword?: string): Promise<{
        [key: string]: boolean;
    }>;
    createTable(schema: TableSchema[]): Promise<boolean>;
    extractSchema(tableName: string): Promise<TableSchema[]>;
    private groupByTableName;
    private generateCreateTableSQL;
    private generateColumnSQL;
    private generateForeignKeySQL;
    private getDataTypeSQL;
}
//# sourceMappingURL=schema.d.ts.map