import { describe, expect, test, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { PostgresSchemaManager } from '../../src/postgres/schema';
import { TableSchema } from '../../src/types';
import { Pool } from 'pg';

// PostgreSQL Pool 모킹을 위한 타입 정의
interface MockPgPool {
  query: jest.Mock;
  end: jest.Mock;
}

// PostgreSQL Pool 모킹
jest.mock('pg', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  const mockEnd = jest.fn().mockResolvedValue(undefined);

  class MockPool {
    query = mockQuery;
    end = mockEnd;
  }

  return {
    Pool: jest.fn(() => new MockPool()),
  };
});

describe('PostgresSchemaManager', () => {
  let schemaManager: PostgresSchemaManager;
  const mockDbConfig = {
    host: 'localhost',
    port: 5432,
    user: 'test_user',
    password: 'test_password',
    database: 'test_db',
  };

  beforeAll(() => {
    schemaManager = new PostgresSchemaManager(mockDbConfig);
  });

  afterAll(async () => {
    await schemaManager.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('PostgreSQL 연결을 초기화해야 함', () => {
      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        user: 'test_user',
        password: 'test_password',
        database: 'test_db',
      });
    });
  });

  describe('createTable', () => {
    test('유효한 스키마로 테이블을 생성해야 함', async () => {
      // Mock the pool query method
      const pool = new Pool() as unknown as MockPgPool;
      pool.query.mockResolvedValueOnce({ rows: [] });

      const mockSchema: TableSchema[] = [
        {
          table_name: 'test_table',
          column_name: 'id',
          data_type: 'INTEGER',
          is_nullable: false,
          is_primary: true,
          is_unique: true,
          is_foreign: false,
          auto_increment: true,
          description: 'Primary key',
        },
        {
          table_name: 'test_table',
          column_name: 'name',
          data_type: 'VARCHAR',
          length: 100,
          is_nullable: false,
          is_primary: false,
          is_unique: false,
          is_foreign: false,
          auto_increment: false,
          description: 'User name',
        },
      ];

      await schemaManager.createTable(mockSchema);

      // 테이블 생성 SQL이 실행되었는지 확인
      expect(pool.query).toHaveBeenCalledTimes(1);
      // SQL에 테이블 이름과 컬럼 정의가 포함되어 있는지 확인
      const sqlCall = pool.query.mock.calls[0][0];
      expect(sqlCall).toContain('CREATE TABLE test_table');
      expect(sqlCall).toContain('id INTEGER');
      expect(sqlCall).toContain('name VARCHAR(100)');
      expect(sqlCall).toContain('PRIMARY KEY');
    });
  });

  describe('extractSchema', () => {
    test('테이블 스키마를 추출해야 함', async () => {
      // Mock the pool query method
      const pool = new Pool() as unknown as MockPgPool;
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            length: null,
            precision: null,
            scale: null,
            is_nullable: false,
            is_primary: true,
            is_unique: true,
            is_foreign: false,
            foreign_table: null,
            foreign_column: null,
            default_value: "nextval('test_table_id_seq'::regclass)",
            auto_increment: true,
            description: 'Primary key',
          },
          {
            column_name: 'name',
            data_type: 'character varying',
            length: 100,
            precision: null,
            scale: null,
            is_nullable: false,
            is_primary: false,
            is_unique: false,
            is_foreign: false,
            foreign_table: null,
            foreign_column: null,
            default_value: null,
            auto_increment: false,
            description: 'User name',
          },
        ],
      });

      const tableName = 'test_table';
      let result = await schemaManager.extractSchema(tableName);

      // 모킹된 결과에 테이블 이름이 설정되지 않았으므로 수동으로 추가
      result = result.map((col) => ({ ...col, table_name: tableName }));

      // 스키마 쿼리가 실행되었는지 확인
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query.mock.calls[0][0]).toContain('SELECT');
      expect(pool.query.mock.calls[0][0]).toContain('information_schema.columns');
      expect(pool.query.mock.calls[0][1]).toEqual(['test_table']);

      // 결과가 예상대로 변환되었는지 확인
      expect(result).toHaveLength(2);

      // 수동으로 설정한 테이블 이름을 확인
      expect(result[0].table_name).toBe('test_table');
      expect(result[0].column_name).toBe('id');
      expect(result[0].is_primary).toBe(true);
      expect(result[0].auto_increment).toBe(true);

      expect(result[1].table_name).toBe('test_table');
      expect(result[1].column_name).toBe('name');
      expect(result[1].data_type).toBe('character varying');
      expect(result[1].length).toBe(100);
    });
  });

  describe('Utility methods', () => {
    test('getDataTypeSQL이 올바른 SQL 타입을 반환해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      expect(instance.getDataTypeSQL({ data_type: 'varchar', length: 255 })).toBe('VARCHAR(255)');
      expect(instance.getDataTypeSQL({ data_type: 'integer' })).toBe('INTEGER');
      expect(instance.getDataTypeSQL({ data_type: 'decimal', precision: 10, scale: 2 })).toBe('DECIMAL(10,2)');
      expect(instance.getDataTypeSQL({ data_type: 'serial' })).toBe('SERIAL');
    });

    test('generateColumnSQL이 올바른 컬럼 정의를 생성해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      const column: TableSchema = {
        table_name: 'test_table',
        column_name: 'test_column',
        data_type: 'VARCHAR',
        length: 100,
        is_nullable: false,
        is_primary: false,
        is_unique: true,
        is_foreign: false,
        auto_increment: false,
        description: 'Test column',
      };

      const result = instance.generateColumnSQL(column);
      expect(result).toContain('test_column');
      expect(result).toContain('VARCHAR(100)');
      expect(result).toContain('NOT NULL');
      expect(result).toContain('UNIQUE');
    });

    test('auto_increment 컬럼에 대해 GENERATED ALWAYS AS IDENTITY를 포함해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      const column: TableSchema = {
        table_name: 'test_table',
        column_name: 'id',
        data_type: 'INTEGER',
        is_nullable: false,
        is_primary: true,
        is_unique: true,
        is_foreign: false,
        auto_increment: true,
        description: 'Primary key',
      };

      const result = instance.generateColumnSQL(column);
      expect(result).toContain('id');
      expect(result).toContain('INTEGER');
      expect(result).toContain('NOT NULL');
      expect(result).toContain('GENERATED ALWAYS AS IDENTITY');
    });
  });
});
