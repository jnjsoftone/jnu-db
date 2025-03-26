import { TableSchema } from '../types';

interface PrismaField {
  name: string;
  type: string;
  required: boolean;
  isPrimary: boolean;
  isUnique: boolean;
  isRelation: boolean;
  relationTable?: string;
  relationField?: string;
  isAutoIncrement: boolean;
  documentation?: string;
  default?: string;
}

interface PrismaModel {
  name: string;
  fields: PrismaField[];
  documentation?: string;
}

export class PrismaSchemaManager {
  // Prisma 스키마 생성
  generatePrismaSchema(schemas: TableSchema[], provider: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'): string {
    const tableGroups = this.groupByTableName(schemas);
    let prismaSchema = this.generatePrismaHeader(provider);

    for (const [tableName, columns] of Object.entries(tableGroups)) {
      prismaSchema += this.generateModelDefinition(tableName, columns);
    }

    return prismaSchema;
  }

  // Prisma 스키마에서 표준 스키마 추출
  extractFromPrismaSchema(prismaSchema: string): TableSchema[] {
    const models = this.parsePrismaSchema(prismaSchema);
    const schemas: TableSchema[] = [];

    for (const model of models) {
      for (const field of model.fields) {
        schemas.push({
          table_name: model.name,
          column_name: field.name,
          data_type: this.mapPrismaTypeToSQL(field.type),
          is_nullable: !field.required,
          is_primary: field.isPrimary,
          is_unique: field.isUnique,
          is_foreign: field.isRelation,
          foreign_table: field.relationTable,
          foreign_column: field.relationField,
          auto_increment: field.isAutoIncrement,
          description: field.documentation || '',
          default_value: field.default,
        });
      }
    }

    return schemas;
  }

  private groupByTableName(schema: TableSchema[]): Record<string, TableSchema[]> {
    return schema.reduce((acc, col) => {
      const { table_name } = col;
      if (!acc[table_name]) {
        acc[table_name] = [];
      }
      acc[table_name].push(col);
      return acc;
    }, {} as Record<string, TableSchema[]>);
  }

  private generatePrismaHeader(provider: 'postgresql' | 'mysql' | 'sqlite'): string {
    return `
datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

`;
  }

  private generateModelDefinition(tableName: string, columns: TableSchema[]): string {
    const fields = columns.map((col) => this.generateFieldDefinition(col)).join('\n  ');

    return `model ${this.pascalCase(tableName)} {
  ${fields}
}

`;
  }

  private generateFieldDefinition(column: TableSchema): string {
    const typeName = this.mapSQLTypeToPrisma(column.data_type, column.length);
    const modifiers: string[] = [];

    if (!column.is_nullable) {
      modifiers.push('');
    }

    if (column.is_primary) {
      modifiers.push('@id');
    }

    if (column.auto_increment) {
      modifiers.push('@default(autoincrement())');
    } else if (column.default_value) {
      // 기본값 처리를 위한 로직 추가 필요
      const defaultValue = this.formatPrismaDefaultValue(column.default_value, column.data_type);
      if (defaultValue) {
        modifiers.push(`@default(${defaultValue})`);
      }
    }

    if (column.is_unique && !column.is_primary) {
      modifiers.push('@unique');
    }

    if (column.description) {
      modifiers.push(`/// ${column.description}`);
    }

    const modifierStr = modifiers.length > 0 ? ' ' + modifiers.filter((m) => m).join(' ') : '';

    return `${column.column_name} ${typeName}${column.is_nullable ? '?' : ''}${modifierStr}`;
  }

  private mapSQLTypeToPrisma(sqlType: string, length?: number): string {
    const type = sqlType.toLowerCase();

    switch (type) {
      case 'int':
      case 'integer':
      case 'serial':
        return 'Int';
      case 'bigint':
      case 'bigserial':
        return 'BigInt';
      case 'varchar':
      case 'character varying':
      case 'text':
      case 'char':
      case 'character':
        return 'String';
      case 'boolean':
      case 'bool':
        return 'Boolean';
      case 'real':
      case 'float':
      case 'float4':
        return 'Float';
      case 'double':
      case 'double precision':
      case 'float8':
        return 'Float';
      case 'decimal':
      case 'numeric':
        return 'Decimal';
      case 'date':
        return 'Date';
      case 'time':
      case 'timetz':
        return 'DateTime';
      case 'timestamp':
      case 'timestamptz':
        return 'DateTime';
      case 'json':
      case 'jsonb':
        return 'Json';
      case 'uuid':
        return 'String';
      default:
        return 'String';
    }
  }

  private mapPrismaTypeToSQL(prismaType: string): string {
    switch (prismaType) {
      case 'Int':
        return 'INTEGER';
      case 'BigInt':
        return 'BIGINT';
      case 'String':
        return 'VARCHAR';
      case 'Boolean':
        return 'BOOLEAN';
      case 'Float':
        return 'FLOAT';
      case 'Decimal':
        return 'DECIMAL';
      case 'DateTime':
        return 'TIMESTAMP';
      case 'Date':
        return 'DATE';
      case 'Json':
        return 'JSON';
      case 'Bytes':
        return 'BYTEA';
      default:
        return 'VARCHAR';
    }
  }

  private formatPrismaDefaultValue(defaultValue: string, dataType: string): string | null {
    if (!defaultValue) return null;

    // 문자열이면 따옴표 추가
    if (
      dataType.toLowerCase().includes('char') ||
      dataType.toLowerCase().includes('text') ||
      dataType.toLowerCase() === 'varchar'
    ) {
      return `"${defaultValue.replace(/"/g, '\\"')}"`;
    }

    // 함수 호출이면 그대로 반환
    if (defaultValue.includes('(') && defaultValue.includes(')')) {
      return defaultValue;
    }

    // 숫자면 그대로 반환
    if (!isNaN(Number(defaultValue))) {
      return defaultValue;
    }

    // 기타 케이스 (예: now(), true/false 등)
    if (defaultValue.toLowerCase() === 'true' || defaultValue.toLowerCase() === 'false') {
      return defaultValue.toLowerCase();
    }

    if (defaultValue.toLowerCase() === 'now()') {
      return 'now()';
    }

    return `"${defaultValue}"`;
  }

  private pascalCase(input: string): string {
    return input
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private parsePrismaSchema(schema: string): PrismaModel[] {
    const models: PrismaModel[] = [];
    const lines = schema.split('\n');

    let currentModel: PrismaModel | null = null;
    let modelDocumentation = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 주석 처리
      if (line.startsWith('///')) {
        modelDocumentation = line.substring(3).trim();
        continue;
      }

      // 모델 시작 감지
      if (line.startsWith('model ')) {
        const modelName = line.substring(6, line.indexOf('{')).trim();
        currentModel = {
          name: modelName,
          fields: [],
          documentation: modelDocumentation,
        };
        modelDocumentation = '';
        continue;
      }

      // 모델 종료 감지
      if (line === '}' && currentModel) {
        models.push(currentModel);
        currentModel = null;
        continue;
      }

      // 필드 감지
      if (currentModel && line && !line.startsWith('}') && !line.startsWith('model ')) {
        const field = this.parseFieldLine(line);
        if (field) {
          field.documentation = modelDocumentation;
          currentModel.fields.push(field);
          modelDocumentation = '';
        }
      }
    }

    return models;
  }

  private parseFieldLine(line: string): PrismaField | null {
    // 주석만 있는 경우 무시
    if (line.startsWith('//')) return null;

    // 필드 이름과 타입 추출
    const parts = line.split(/\s+/);
    if (parts.length < 2) return null;

    const name = parts[0];
    let type = parts[1];

    // 옵셔널 타입 확인
    const required = !type.endsWith('?');
    if (!required) {
      type = type.slice(0, -1);
    }

    const field: PrismaField = {
      name,
      type,
      required,
      isPrimary: line.includes('@id'),
      isUnique: line.includes('@unique'),
      isRelation: false, // 관계 감지는 복잡하므로 별도 처리 필요
      isAutoIncrement: line.includes('@default(autoincrement())'),
    };

    // 기본값 추출
    const defaultMatch = line.match(/@default\((.*?)\)/);
    if (defaultMatch) {
      field.default = defaultMatch[1];
    }

    return field;
  }
}
