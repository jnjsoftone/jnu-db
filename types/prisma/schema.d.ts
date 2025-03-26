import { TableSchema } from '../types';
export declare class PrismaSchemaManager {
    generatePrismaSchema(schemas: TableSchema[], provider?: 'postgresql' | 'mysql' | 'sqlite'): string;
    extractFromPrismaSchema(prismaSchema: string): TableSchema[];
    private groupByTableName;
    private generatePrismaHeader;
    private generateModelDefinition;
    private generateFieldDefinition;
    private mapSQLTypeToPrisma;
    private mapPrismaTypeToSQL;
    private formatPrismaDefaultValue;
    private pascalCase;
    private parsePrismaSchema;
    private parseFieldLine;
}
//# sourceMappingURL=schema.d.ts.map