import { Pool } from 'pg';
import { TableSchema, DbConfig } from '../types';

export class PostgresSchemaManager {
  public pool: Pool;
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

  // 테이블 목록 조회 함수
  async findTables(keyword?: string): Promise<string[]> {
    try {
      let query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;

      const params: any[] = [];

      // 키워드가 있으면 검색 조건 추가
      if (keyword) {
        query += ` AND table_name ~ $1`;
        params.push(keyword);
      }

      const result = await this.pool.query(query, params);

      // 결과를 문자열 배열로 변환
      return result.rows.map((row) => row.table_name);
    } catch (error) {
      console.error('PostgreSQL 테이블 목록 조회 중 오류:', error);
      return [];
    }
  }

  // 테이블 삭제 함수
  async removeTables(keyword?: string): Promise<{ [key: string]: boolean }> {
    try {
      // 삭제할 테이블 목록 조회
      const tables = await this.findTables(keyword);
      const results: { [key: string]: boolean } = {};

      // 각 테이블 삭제 (CASCADE 옵션을 사용하여 의존성 문제 해결)
      for (const table of tables) {
        try {
          await this.pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
          results[table] = true;
          console.log(`PostgreSQL 테이블 삭제 성공: ${table}`);
        } catch (err) {
          console.error(`PostgreSQL 테이블 삭제 실패: ${table}`, err);
          results[table] = false;
        }
      }

      return results;
    } catch (error) {
      console.error('PostgreSQL 테이블 삭제 중 오류:', error);
      throw error;
    }
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
      // 컬럼 기본 정보 조회
      const columnsResult = await this.pool.query(
        `
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length AS length,
          c.numeric_precision AS precision,
          c.numeric_scale AS scale,
          (c.is_nullable = 'YES') AS is_nullable,
          c.column_default AS default_value,
          c.ordinal_position
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = $1
        ORDER BY c.ordinal_position
      `,
        [tableName]
      );

      // 기본 키 정보 조회
      const primaryKeysResult = await this.pool.query(
        `
        SELECT
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,
        [tableName]
      );

      // 유니크 키 정보 조회
      const uniqueKeysResult = await this.pool.query(
        `
        SELECT
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,
        [tableName]
      );

      // 외래 키 정보 조회
      const foreignKeysResult = await this.pool.query(
        `
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,
        [tableName]
      );

      // 자동 증가 컬럼 조회
      const autoIncrementResult = await this.pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND (column_default LIKE 'nextval%' OR column_default LIKE '%identity%')
      `,
        [tableName]
      );

      // 각 필드 매핑을 위한 데이터 준비
      const primaryKeys = primaryKeysResult.rows.map((row) => row.column_name);
      const uniqueKeys = uniqueKeysResult.rows.map((row) => row.column_name);
      const foreignKeys = foreignKeysResult.rows;
      const autoIncrementColumns = autoIncrementResult.rows.map((row) => row.column_name);

      // 최종 스키마 생성
      return columnsResult.rows.map((column) => {
        // 현재 컬럼과 관련된 외래 키 찾기
        const fk = foreignKeys.find((fk) => fk.column_name === column.column_name);

        return {
          table_name: tableName,
          column_name: column.column_name,
          data_type: column.data_type,
          length: column.length ? parseInt(column.length) : undefined,
          precision: column.precision ? parseInt(column.precision) : undefined,
          scale: column.scale ? parseInt(column.scale) : undefined,
          is_nullable: column.is_nullable,
          is_primary: primaryKeys.includes(column.column_name),
          is_unique: uniqueKeys.includes(column.column_name) || primaryKeys.includes(column.column_name),
          is_foreign: !!fk,
          foreign_table: fk ? fk.foreign_table : undefined,
          foreign_column: fk ? fk.foreign_column : undefined,
          default_value: column.default_value,
          auto_increment: autoIncrementColumns.includes(column.column_name),
          description: '',
        };
      });
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
}
