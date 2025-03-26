import { TableSchema, DbConfig } from '../types';
export declare class MySqlSchemaManager {
    private connection;
    private config;
    constructor(config: DbConfig);
    init(): Promise<void>;
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