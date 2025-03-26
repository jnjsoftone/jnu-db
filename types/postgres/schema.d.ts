import { TableSchema, DbConfig } from '../types';
export declare class PostgresSchemaManager {
    private pool;
    private config;
    constructor(config: DbConfig);
    close(): Promise<void>;
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