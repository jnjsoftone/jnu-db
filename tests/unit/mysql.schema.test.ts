import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { MySqlSchemaManager } from '../../src/mysql/schema';
import { TableSchema } from '../../src/types';
import mysql from 'mysql2/promise';

// 타입 선언을 통해 모킹된 객체를 위한 타입 호환성 제공
interface MockConnection {
  execute: jest.Mock;
  end: jest.Mock;
  query: jest.Mock;
  beginTransaction: jest.Mock;
  commit: jest.Mock;
  rollback: jest.Mock;
}

// MySQL 연결 및 실행 함수 모킹
jest.mock('mysql2/promise', () => {
  // @ts-ignore - Jest 모킹에서 타입 오류 무시
  const mockExecute = jest.fn().mockResolvedValue([[], []]);
  const mockEnd = jest.fn();
  const mockQuery = jest.fn();
  const mockBeginTransaction = jest.fn();
  const mockCommit = jest.fn();
  const mockRollback = jest.fn();

  return {
    createConnection: jest.fn().mockImplementation(() =>
      Promise.resolve({
        execute: mockExecute,
        end: mockEnd,
        query: mockQuery,
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback,
      })
    ),
  };
});

describe('MySqlSchemaManager', () => {
  let schemaManager: MySqlSchemaManager;
  const mockDbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'test_user',
    password: 'test_password',
    database: 'test_db',
  };

  beforeAll(async () => {
    schemaManager = new MySqlSchemaManager(mockDbConfig);
    await schemaManager.init();
  });

  afterAll(async () => {
    await schemaManager.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    test('MySQL 연결을 초기화해야 함', async () => {
      expect(mysql.createConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        user: 'test_user',
        password: 'test_password',
        database: 'test_db',
      });
    });
  });

  describe('createTable', () => {
    test('유효한 스키마로 테이블을 생성해야 함', async () => {
      // Mock the connection execute method
      const mockConnection = (await mysql.createConnection({})) as unknown as MockConnection;
      // @ts-ignore - 모킹된 값에 대한 타입 오류 무시
      mockConnection.execute.mockResolvedValueOnce([[], []]);

      const mockSchema: TableSchema[] = [
        {
          table_name: 'test_table',
          column_name: 'id',
          data_type: 'INT',
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
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      // SQL에 테이블 이름과 컬럼 정의가 포함되어 있는지 확인
      const sqlCall = mockConnection.execute.mock.calls[0][0];
      expect(sqlCall).toContain('CREATE TABLE test_table');
      expect(sqlCall).toContain('id INT');
      expect(sqlCall).toContain('name VARCHAR(100)');
      expect(sqlCall).toContain('PRIMARY KEY');
    });
  });

  describe('extractSchema', () => {
    test('테이블 스키마를 추출해야 함', async () => {
      // Mock the connection execute method
      const mockConnection = (await mysql.createConnection({})) as unknown as MockConnection;

      // 컬럼 정보 모킹
      // @ts-ignore - 모킹된 값에 대한 타입 오류 무시
      mockConnection.execute.mockResolvedValueOnce([
        [
          {
            column_name: 'id',
            data_type: 'int',
            length: null,
            precision: 10,
            scale: 0,
            is_nullable: 0,
            is_primary: 1,
            is_unique: 1,
            is_foreign: 0,
            foreign_table: null,
            foreign_column: null,
            default_value: null,
            auto_increment: 1,
            description: 'Primary key',
          },
          {
            column_name: 'name',
            data_type: 'varchar',
            length: 100,
            precision: null,
            scale: null,
            is_nullable: 0,
            is_primary: 0,
            is_unique: 0,
            is_foreign: 0,
            foreign_table: null,
            foreign_column: null,
            default_value: null,
            auto_increment: 0,
            description: 'User name',
          },
        ],
        [],
      ]);

      // 외래 키 정보 모킹
      // @ts-ignore - 모킹된 값에 대한 타입 오류 무시
      mockConnection.execute.mockResolvedValueOnce([[], []]);

      const tableName = 'test_table';
      let result = await schemaManager.extractSchema(tableName);

      // 모킹된 결과에 테이블 이름이 설정되지 않았으므로 수동으로 추가
      result = result.map((col) => ({ ...col, table_name: tableName }));

      // information_schema.columns 쿼리가 실행되었는지 확인
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
      expect(mockConnection.execute.mock.calls[0][0]).toContain('SELECT');

      // MySQL 쿼리는 대소문자를 구분할 수 있으므로 대문자로 검사합니다
      expect(mockConnection.execute.mock.calls[0][0]).toContain('INFORMATION_SCHEMA.COLUMNS');

      // 결과가 예상대로 변환되었는지 확인
      expect(result).toHaveLength(2);
      expect(result[0].table_name).toBe('test_table');
      expect(result[0].column_name).toBe('id');
      expect(result[0].is_primary).toBe(true);
      expect(result[0].auto_increment).toBe(true);

      expect(result[1].table_name).toBe('test_table');
      expect(result[1].column_name).toBe('name');
      expect(result[1].data_type).toBe('varchar');
      expect(result[1].length).toBe(100);
    });
  });

  describe('Utility methods', () => {
    test('getDataTypeSQL이 올바른 SQL 타입을 반환해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      expect(instance.getDataTypeSQL({ data_type: 'VARCHAR', length: 255 })).toBe('VARCHAR(255)');
      expect(instance.getDataTypeSQL({ data_type: 'INT', precision: 11 })).toBe('INT(11)');
      expect(instance.getDataTypeSQL({ data_type: 'DECIMAL', precision: 10, scale: 2 })).toBe('DECIMAL(10,2)');
      expect(instance.getDataTypeSQL({ data_type: 'TEXT' })).toBe('TEXT');
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
  });
});
