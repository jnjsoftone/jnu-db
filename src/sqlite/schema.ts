import { Database } from 'sqlite3';
import { open } from 'sqlite';
import { TableSchema } from '../types';

export class SqliteSchemaManager {
  private db: any; // sqlite.Database
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async init(): Promise<void> {
    this.db = await open({
      filename: this.filePath,
      driver: Database,
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }

  async createTable(schema: TableSchema[]): Promise<boolean> {
    try {
      const tableGroups = this.groupByTableName(schema);

      for (const [tableName, columns] of Object.entries(tableGroups)) {
        const createTableSQL = this.generateCreateTableSQL(tableName, columns);
        await this.db.exec(createTableSQL);
      }
      return true;
    } catch (error) {
      console.error('SQLite 테이블 생성 중 오류:', error);
      return false;
    }
  }

  async extractSchema(tableName: string): Promise<TableSchema[]> {
    try {
      // PRAGMA table_info를 통해 테이블 구조 가져오기
      const tableInfo = await this.db.all(`PRAGMA table_info(${tableName})`);

      // 외래 키 정보 가져오기
      const foreignKeys = await this.db.all(`PRAGMA foreign_key_list(${tableName})`);

      // 인덱스 정보 가져오기 (유니크 제약조건 확인용)
      const indexList = await this.db.all(`PRAGMA index_list(${tableName})`);

      // 유니크 인덱스에 포함된 컬럼 정보 추출
      const uniqueColumns: string[] = [];
      for (const idx of indexList) {
        if (idx.unique === 1) {
          const indexInfo = await this.db.all(`PRAGMA index_info(${idx.name})`);
          indexInfo.forEach((info) => uniqueColumns.push(info.name));
        }
      }

      // 테이블 정보 변환
      const result = tableInfo.map((col: any) => {
        // 외래 키 정보 찾기
        const fk = foreignKeys.find((fk: any) => fk.from === col.name);

        // INTEGER PRIMARY KEY는 SQLite에서 자동 증가 컬럼
        const isAutoIncrement = col.pk === 1 && col.type.toUpperCase() === 'INTEGER';

        return {
          table_name: tableName,
          column_name: col.name,
          data_type: col.type,
          is_nullable: col.notnull === 0,
          is_primary: col.pk === 1,
          is_unique: uniqueColumns.includes(col.name) || col.pk === 1,
          is_foreign: !!fk,
          foreign_table: fk ? fk.table : undefined,
          foreign_column: fk ? fk.to : undefined,
          default_value: col.dflt_value,
          auto_increment: isAutoIncrement,
          description: '', // SQLite에는 컬럼 설명 정보 저장하는 기능이 제한적
        };
      });

      return result;
    } catch (error) {
      console.error('SQLite 스키마 추출 중 오류:', error);
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

    let sql = `
CREATE TABLE ${tableName} (
  ${columnDefs.join(',\n  ')}`;

    // 복합 기본키가 있는 경우에만 PRIMARY KEY 제약 조건 추가
    if (primaryKeys.length > 1) {
      sql += `,\n  PRIMARY KEY (${primaryKeys.join(', ')})`;
    }

    // 외래 키 제약 조건 추가
    if (foreignKeys.length > 0) {
      sql += `,\n  ${foreignKeys.join(',\n  ')}`;
    }

    sql += '\n)';

    return sql;
  }

  private generateColumnSQL(column: TableSchema): string {
    const parts = [
      column.column_name,
      this.getDataTypeSQL(column),
      // SQLite에서 INTEGER PRIMARY KEY는 자동으로 ROWID와 연결되어 자동 증가 역할을 함
      column.is_primary && column.auto_increment && column.data_type.toUpperCase() === 'INTEGER' ? 'PRIMARY KEY' : '',
      column.is_primary && (!column.auto_increment || column.data_type.toUpperCase() !== 'INTEGER')
        ? 'PRIMARY KEY'
        : '',
      column.is_nullable ? '' : 'NOT NULL',
      column.is_unique && !column.is_primary ? 'UNIQUE' : '',
      column.default_value ? `DEFAULT ${column.default_value}` : '',
    ];

    return parts.filter(Boolean).join(' ');
  }

  private generateForeignKeySQL(column: TableSchema): string {
    return `FOREIGN KEY (${column.column_name}) REFERENCES ${column.foreign_table} (${column.foreign_column})`;
  }

  private getDataTypeSQL(column: TableSchema): string {
    // SQLite는 동적 타입 시스템을 갖고 있어 엄격한 타입 체크가 없으나,
    // 명시적으로 타입을 지정하는 것이 좋은 관행
    switch (column.data_type.toUpperCase()) {
      case 'INT':
      case 'INTEGER':
      case 'TINYINT':
      case 'SMALLINT':
      case 'MEDIUMINT':
      case 'BIGINT':
      case 'UNSIGNED BIG INT':
      case 'INT2':
      case 'INT8':
        return 'INTEGER';
      case 'CHARACTER':
      case 'VARCHAR':
      case 'VARYING CHARACTER':
      case 'NCHAR':
      case 'NATIVE CHARACTER':
      case 'NVARCHAR':
        return column.length ? `TEXT(${column.length})` : 'TEXT';
      case 'TEXT':
      case 'CLOB':
        return 'TEXT';
      case 'BLOB':
        return 'BLOB';
      case 'REAL':
      case 'DOUBLE':
      case 'DOUBLE PRECISION':
      case 'FLOAT':
        return 'REAL';
      case 'NUMERIC':
      case 'DECIMAL':
      case 'BOOLEAN':
      case 'DATE':
      case 'DATETIME':
        return 'NUMERIC';
      default:
        return column.data_type;
    }
  }
}
