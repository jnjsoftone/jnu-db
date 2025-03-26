import mysql from 'mysql2/promise';
import { TableSchema, DbConfig } from '../types';

export class MySqlSchemaManager {
  public connection!: mysql.Connection;
  private config: DbConfig;

  constructor(config: DbConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
    });
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
  }

  // 테이블 목록 조회 함수
  async findTables(keyword?: string): Promise<string[]> {
    try {
      let query = `
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
      `;

      const params: any[] = [this.config.database];

      // 키워드가 있으면 검색 조건 추가
      if (keyword) {
        query += ` AND TABLE_NAME REGEXP ?`;
        params.push(keyword);
      }

      const [rows] = await this.connection.execute(query, params);

      // 결과를 문자열 배열로 변환
      return Array.isArray(rows) ? (rows as any[]).map((row) => row.TABLE_NAME) : [];
    } catch (error) {
      console.error('MySQL 테이블 목록 조회 중 오류:', error);
      return [];
    }
  }

  // 테이블 삭제 함수
  async removeTables(keyword?: string): Promise<{ [key: string]: boolean }> {
    try {
      // 삭제할 테이블 목록 조회
      const tables = await this.findTables(keyword);
      const results: { [key: string]: boolean } = {};

      // 외래 키 제약 조건 비활성화
      await this.connection.execute('SET FOREIGN_KEY_CHECKS = 0');

      // 각 테이블 삭제
      for (const table of tables) {
        try {
          await this.connection.execute(`DROP TABLE IF EXISTS ${table}`);
          results[table] = true;
          console.log(`MySQL 테이블 삭제 성공: ${table}`);
        } catch (err) {
          console.error(`MySQL 테이블 삭제 실패: ${table}`, err);
          results[table] = false;
        }
      }

      // 외래 키 제약 조건 다시 활성화
      await this.connection.execute('SET FOREIGN_KEY_CHECKS = 1');

      return results;
    } catch (error) {
      console.error('MySQL 테이블 삭제 중 오류:', error);
      throw error;
    }
  }

  // 테이블 생성
  async createTable(schema: TableSchema[]): Promise<boolean> {
    try {
      const tableGroups = this.groupByTableName(schema);

      for (const [tableName, columns] of Object.entries(tableGroups)) {
        const createTableSQL = this.generateCreateTableSQL(tableName, columns);
        await this.connection.execute(createTableSQL);
      }
      return true;
    } catch (error) {
      console.error('MySQL 테이블 생성 중 오류:', error);
      return false;
    }
  }

  // 테이블 스키마 추출
  async extractSchema(tableName: string): Promise<TableSchema[]> {
    try {
      const [columns] = await this.connection.execute(
        `
        SELECT 
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          CHARACTER_MAXIMUM_LENGTH as length,
          NUMERIC_PRECISION as \`precision\`,
          NUMERIC_SCALE as \`scale\`,
          CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as is_nullable,
          CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END as is_primary,
          CASE WHEN COLUMN_KEY = 'UNI' THEN 1 ELSE 0 END as is_unique,
          CASE WHEN COLUMN_KEY = 'MUL' THEN 1 ELSE 0 END as is_foreign,
          NULL as foreign_table,
          NULL as foreign_column,
          COLUMN_DEFAULT as default_value,
          CASE WHEN EXTRA = 'auto_increment' THEN 1 ELSE 0 END as auto_increment,
          COLUMN_COMMENT as description
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `,
        [this.config.database, tableName]
      );

      // 외래 키 정보 가져오기
      const [foreignKeys] = await this.connection.execute(
        `
        SELECT
          COLUMN_NAME as column_name,
          REFERENCED_TABLE_NAME as foreign_table,
          REFERENCED_COLUMN_NAME as foreign_column
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
        [this.config.database, tableName]
      );

      // 외래 키 정보를 기본 열 정보와 병합
      const columnsWithFK = Array.isArray(columns)
        ? columns.map((col: any) => {
            const fk = Array.isArray(foreignKeys)
              ? (foreignKeys as any[]).find((fk) => fk.column_name === col.column_name)
              : null;

            return {
              ...col,
              table_name: tableName, // 테이블 이름 명시적 추가
              foreign_table: fk ? fk.foreign_table : null,
              foreign_column: fk ? fk.foreign_column : null,
              is_foreign: !!fk,
            };
          })
        : [];

      return columnsWithFK.map(this.mapColumnToSchema);
    } catch (error) {
      console.error('MySQL 스키마 추출 중 오류:', error);
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
      column.auto_increment ? 'AUTO_INCREMENT' : '',
      column.default_value ? `DEFAULT ${column.default_value}` : '',
      column.is_unique && !column.is_primary ? 'UNIQUE' : '',
      column.description ? `COMMENT '${column.description.replace(/'/g, "''")}'` : '',
    ];

    return parts.filter(Boolean).join(' ');
  }

  private generateForeignKeySQL(column: TableSchema): string {
    return `FOREIGN KEY (${column.column_name}) REFERENCES ${column.foreign_table} (${column.foreign_column})`;
  }

  private getDataTypeSQL(column: TableSchema): string {
    switch (column.data_type.toUpperCase()) {
      case 'VARCHAR':
        return `VARCHAR(${column.length || 255})`;
      case 'INT':
      case 'INTEGER':
        return column.precision ? `INT(${column.precision})` : 'INT';
      case 'DECIMAL':
        return `DECIMAL(${column.precision || 10},${column.scale || 0})`;
      default:
        return column.data_type;
    }
  }

  private mapColumnToSchema(column: any): TableSchema {
    return {
      table_name: column.table_name || '',
      column_name: column.column_name || '',
      data_type: column.data_type || '',
      length: column.length ? parseInt(column.length) : undefined,
      precision: column.precision ? parseInt(column.precision) : undefined,
      scale: column.scale ? parseInt(column.scale) : undefined,
      is_nullable: column.is_nullable === true || column.is_nullable === 1 || column.is_nullable === 'YES',
      is_primary: column.is_primary === true || column.is_primary === 1,
      is_unique: column.is_unique === true || column.is_unique === 1,
      is_foreign: column.is_foreign === true || column.is_foreign === 1,
      foreign_table: column.foreign_table || undefined,
      foreign_column: column.foreign_column || undefined,
      default_value: column.default_value || undefined,
      auto_increment:
        column.auto_increment === true || column.auto_increment === 1 || column.auto_increment === 'auto_increment',
      description: column.description || '',
    };
  }
}
