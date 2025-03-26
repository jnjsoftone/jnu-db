import { Pool } from 'pg';
import { TableSchema, DbConfig } from '../types';

export class PostgresSchemaManager {
  private pool: Pool;
  private config: DbConfig;

  constructor(config: DbConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createTable(schema: TableSchema[]): Promise<boolean> {
    try {
      const tableGroups = this.groupByTableName(schema);

      for (const [tableName, columns] of Object.entries(tableGroups)) {
        const createTableSQL = this.generateCreateTableSQL(tableName, columns);
        await this.pool.query(createTableSQL);
      }
      return true;
    } catch (error) {
      console.error('PostgreSQL 테이블 생성 중 오류:', error);
      return false;
    }
  }

  async extractSchema(tableName: string): Promise<TableSchema[]> {
    try {
      const result = await this.pool.query(
        `
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length as length,
          c.numeric_precision as precision,
          c.numeric_scale as scale,
          c.is_nullable = 'YES' as is_nullable,
          (
            SELECT true FROM pg_constraint pc
            JOIN pg_class cl ON cl.oid = pc.conrelid
            JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(pc.conkey)
            WHERE pc.contype = 'p' AND cl.relname = $1 AND a.attname = c.column_name
          ) as is_primary,
          (
            SELECT true FROM pg_constraint pc
            JOIN pg_class cl ON cl.oid = pc.conrelid
            JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(pc.conkey)
            WHERE pc.contype = 'u' AND cl.relname = $1 AND a.attname = c.column_name
          ) as is_unique,
          (
            SELECT true FROM pg_constraint pc
            JOIN pg_class cl ON cl.oid = pc.conrelid
            JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(pc.conkey)
            WHERE pc.contype = 'f' AND cl.relname = $1 AND a.attname = c.column_name
          ) as is_foreign,
          (
            SELECT ccu.table_name FROM information_schema.constraint_column_usage ccu
            JOIN information_schema.referential_constraints rc 
              ON rc.constraint_name = ccu.constraint_name
            JOIN information_schema.key_column_usage kcu 
              ON kcu.constraint_name = rc.constraint_name
            WHERE kcu.table_name = $1 AND kcu.column_name = c.column_name
            LIMIT 1
          ) as foreign_table,
          (
            SELECT ccu.column_name FROM information_schema.constraint_column_usage ccu
            JOIN information_schema.referential_constraints rc 
              ON rc.constraint_name = ccu.constraint_name
            JOIN information_schema.key_column_usage kcu 
              ON kcu.constraint_name = rc.constraint_name
            WHERE kcu.table_name = $1 AND kcu.column_name = c.column_name
            LIMIT 1
          ) as foreign_column,
          c.column_default as default_value,
          (
            SELECT EXISTS(
              SELECT 1 FROM pg_attrdef ad
              JOIN pg_class cl ON cl.oid = ad.adrelid
              WHERE cl.relname = $1 AND ad.adnum = c.ordinal_position AND ad.adsrc LIKE 'nextval%'
            )
          ) as auto_increment,
          (
            SELECT pd.description 
            FROM pg_description pd
            JOIN pg_class pc ON pd.objoid = pc.oid
            JOIN pg_attribute pa ON pa.attrelid = pc.oid AND pd.objsubid = pa.attnum
            WHERE pc.relname = $1 AND pa.attname = c.column_name
          ) as description
        FROM information_schema.columns c
        WHERE c.table_name = $1 AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `,
        [tableName]
      );

      return result.rows.map(this.mapColumnToSchema);
    } catch (error) {
      console.error('PostgreSQL 스키마 추출 중 오류:', error);
      return [];
    }
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

  private generateCreateTableSQL(tableName: string, columns: TableSchema[]): string {
    const columnDefs = columns.map((col) => this.generateColumnSQL(col));

    const primaryKeys = columns.filter((col) => col.is_primary).map((col) => col.column_name);

    const foreignKeys = columns
      .filter((col) => col.is_foreign && col.foreign_table && col.foreign_column)
      .map((col) => this.generateForeignKeySQL(col));

    return `
      CREATE TABLE ${tableName} (
        ${columnDefs.join(',\n        ')}
        ${primaryKeys.length > 0 ? `,\n        PRIMARY KEY (${primaryKeys.join(',')})` : ''}
        ${foreignKeys.length > 0 ? `,\n        ${foreignKeys.join(',\n        ')}` : ''}
      )
    `;
  }

  private generateColumnSQL(column: TableSchema): string {
    const parts = [
      column.column_name,
      this.getDataTypeSQL(column),
      column.is_nullable ? 'NULL' : 'NOT NULL',
      column.auto_increment ? `GENERATED ALWAYS AS IDENTITY` : '',
      column.default_value && !column.auto_increment ? `DEFAULT ${column.default_value}` : '',
      column.is_unique && !column.is_primary ? 'UNIQUE' : '',
    ];

    return parts.filter(Boolean).join(' ');
  }

  private generateForeignKeySQL(column: TableSchema): string {
    return `FOREIGN KEY (${column.column_name}) REFERENCES ${column.foreign_table} (${column.foreign_column})`;
  }

  private getDataTypeSQL(column: TableSchema): string {
    switch (column.data_type.toLowerCase()) {
      case 'varchar':
      case 'character varying':
        return `VARCHAR(${column.length || 255})`;
      case 'int':
      case 'integer':
        return 'INTEGER';
      case 'numeric':
      case 'decimal':
        return `DECIMAL(${column.precision || 10},${column.scale || 0})`;
      case 'serial':
        return 'SERIAL';
      case 'bigserial':
        return 'BIGSERIAL';
      default:
        return column.data_type;
    }
  }

  private mapColumnToSchema(row: any): TableSchema {
    return {
      table_name: row.table_name || '',
      column_name: row.column_name || '',
      data_type: row.data_type || '',
      length: row.length ? parseInt(row.length) : undefined,
      precision: row.precision ? parseInt(row.precision) : undefined,
      scale: row.scale ? parseInt(row.scale) : undefined,
      is_nullable: row.is_nullable === true || row.is_nullable === 't' || row.is_nullable === 'YES',
      is_primary: row.is_primary === true || row.is_primary === 't',
      is_unique: row.is_unique === true || row.is_unique === 't',
      is_foreign: row.is_foreign === true || row.is_foreign === 't',
      foreign_table: row.foreign_table || undefined,
      foreign_column: row.foreign_column || undefined,
      default_value: row.default_value || undefined,
      auto_increment: row.auto_increment === true || row.auto_increment === 't',
      description: row.description || '',
    };
  }
}
