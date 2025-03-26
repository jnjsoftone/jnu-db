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
        WITH
        pks AS (
          SELECT a.attname
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass AND i.indisprimary
        ),
        fks AS (
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
        ),
        uks AS (
          SELECT ic.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage AS ic ON tc.constraint_name = ic.constraint_name
          WHERE tc.constraint_type = 'UNIQUE' AND tc.table_name = $1
        )
        SELECT
          c.column_name,
          c.data_type,
          c.character_maximum_length AS length,
          c.numeric_precision AS "precision",
          c.numeric_scale AS scale,
          CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END AS is_nullable,
          CASE WHEN pk.attname IS NOT NULL THEN true ELSE false END AS is_primary,
          CASE WHEN uk.column_name IS NOT NULL THEN true ELSE false END AS is_unique,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END AS is_foreign,
          fk.foreign_table,
          fk.foreign_column,
          c.column_default AS default_value,
          CASE 
            WHEN c.column_default LIKE '%nextval%' THEN true 
            WHEN c.column_default LIKE '%identity%' THEN true
            ELSE false 
          END AS auto_increment,
          pgd.description
        FROM information_schema.columns c
        LEFT JOIN pks pk ON pk.attname = c.column_name
        LEFT JOIN fks fk ON fk.column_name = c.column_name
        LEFT JOIN uks uk ON uk.column_name = c.column_name
        LEFT JOIN pg_catalog.pg_statio_all_tables AS st ON st.relname = c.table_name
        LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid
          AND pgd.objsubid = c.ordinal_position
        WHERE c.table_name = $1
      `,
        [tableName]
      );

      return result.rows.map((row) => ({
        table_name: tableName,
        column_name: row.column_name,
        data_type: row.data_type,
        length: row.length || undefined,
        precision: row.precision || undefined,
        scale: row.scale || undefined,
        is_nullable: row.is_nullable,
        is_primary: row.is_primary,
        is_unique: row.is_unique,
        is_foreign: row.is_foreign,
        foreign_table: row.foreign_table || undefined,
        foreign_column: row.foreign_column || undefined,
        default_value: row.default_value || undefined,
        auto_increment: row.auto_increment,
        description: row.description || '',
      }));
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
