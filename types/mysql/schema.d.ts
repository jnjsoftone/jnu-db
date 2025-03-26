import mysql from 'mysql2/promise';
import { TableSchema, DbConfig } from '../types';
export declare class MySqlSchemaManager {
    connection: mysql.Connection;
    private config;
    constructor(config: DbConfig);
    init(): Promise<void>;
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
    private mapColumnToSchema;
}
//# sourceMappingURL=schema.d.ts.map