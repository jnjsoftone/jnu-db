import { TableSchema } from '../types';
export declare class SqliteSchemaManager {
    private db;
    private filePath;
    constructor(filePath: string);
    init(): Promise<void>;
    close(): Promise<void>;
    createTable(schema: TableSchema[]): Promise<boolean>;
    extractSchema(tableName: string): Promise<TableSchema[]>;
    private groupByTableName;
    private generateCreateTableSQL;
    private generateColumnSQL;
    private generateForeignKeySQL;
    private getDataTypeSQL;
}
//# sourceMappingURL=schema.d.ts.map