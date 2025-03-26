import { describe, expect, test, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { SqliteSchemaManager } from '../../src/sqlite/schema';
import { TableSchema } from '../../src/types';
import { Database } from 'sqlite3';
import { open } from 'sqlite';

// SQLite 타입을 위한 인터페이스 정의
interface MockSqliteDatabase {
  exec: jest.Mock;
  all: jest.Mock;
  get: jest.Mock;
  close: jest.Mock;
}

// SQLite 모듈 및 함수 모킹
jest.mock('sqlite3', () => {
  return {
    Database: jest.fn(),
  };
});

jest.mock('sqlite', () => {
  const mockExec = jest.fn().mockResolvedValue(undefined);
  const mockAll = jest.fn().mockResolvedValue([]);
  const mockGet = jest.fn().mockResolvedValue(null);
  const mockClose = jest.fn().mockResolvedValue(undefined);

  return {
    open: jest.fn().mockResolvedValue({
      exec: mockExec,
      all: mockAll,
      get: mockGet,
      close: mockClose,
    }),
  };
});

describe('SqliteSchemaManager', () => {
  let schemaManager: SqliteSchemaManager;
  const mockDbPath = ':memory:';

  beforeAll(async () => {
    schemaManager = new SqliteSchemaManager(mockDbPath);
    await schemaManager.init();
  });

  afterAll(async () => {
    await schemaManager.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    test('SQLite 연결을 초기화해야 함', () => {
      expect(open).toHaveBeenCalledWith({
        filename: ':memory:',
        driver: Database,
      });
    });
  });

  describe('createTable', () => {
    test('유효한 스키마로 테이블을 생성해야 함', async () => {
      // Mock the db.exec method
      const db = (await open({
        filename: ':memory:',
        driver: Database,
      })) as unknown as MockSqliteDatabase;
      (db.exec as jest.Mock).mockResolvedValueOnce(undefined);

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
          data_type: 'TEXT',
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
      expect(db.exec).toHaveBeenCalledTimes(1);
      // SQL에 테이블 이름과 컬럼 정의가 포함되어 있는지 확인
      const sqlCall = (db.exec as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('CREATE TABLE test_table');
      expect(sqlCall).toContain('id INTEGER PRIMARY KEY');
      expect(sqlCall).toContain('name TEXT');
    });
  });

  describe('extractSchema', () => {
    test('테이블 스키마를 추출해야 함', async () => {
      // Mock the db methods
      const db = (await open({
        filename: ':memory:',
        driver: Database,
      })) as unknown as MockSqliteDatabase;

      // PRAGMA table_info 모킹
      (db.all as jest.Mock).mockResolvedValueOnce([
        {
          cid: 0,
          name: 'id',
          type: 'INTEGER',
          notnull: 1,
          dflt_value: null,
          pk: 1,
        },
        {
          cid: 1,
          name: 'name',
          type: 'TEXT',
          notnull: 1,
          dflt_value: null,
          pk: 0,
        },
      ]);

      // PRAGMA foreign_key_list 모킹
      (db.all as jest.Mock).mockResolvedValueOnce([]);

      // PRAGMA index_list 모킹
      (db.all as jest.Mock).mockResolvedValueOnce([
        {
          seq: 0,
          name: 'idx_test_table_name',
          unique: 1,
        },
      ]);

      // PRAGMA index_info 모킹
      (db.all as jest.Mock).mockResolvedValueOnce([
        {
          seqno: 0,
          cid: 1,
          name: 'name',
        },
      ]);

      const tableName = 'test_table';
      const result = await schemaManager.extractSchema(tableName);

      // PRAGMA 쿼리가 실행되었는지 확인
      expect(db.all).toHaveBeenCalledTimes(4);
      expect((db.all as jest.Mock).mock.calls[0][0]).toBe('PRAGMA table_info(test_table)');
      expect((db.all as jest.Mock).mock.calls[1][0]).toBe('PRAGMA foreign_key_list(test_table)');
      expect((db.all as jest.Mock).mock.calls[2][0]).toBe('PRAGMA index_list(test_table)');

      // 결과가 예상대로 변환되었는지 확인
      expect(result).toHaveLength(2);

      // id 컬럼 체크
      expect(result[0].table_name).toBe('test_table');
      expect(result[0].column_name).toBe('id');
      expect(result[0].data_type).toBe('INTEGER');
      expect(result[0].is_nullable).toBe(false);
      expect(result[0].is_primary).toBe(true);
      expect(result[0].auto_increment).toBe(true);

      // name 컬럼 체크
      expect(result[1].column_name).toBe('name');
      expect(result[1].data_type).toBe('TEXT');
      expect(result[1].is_nullable).toBe(false);
      expect(result[1].is_primary).toBe(false);
      expect(result[1].is_unique).toBe(true); // 인덱스 정보에서 유니크 체크
    });
  });

  describe('Utility methods', () => {
    test('getDataTypeSQL이 올바른 SQL 타입을 반환해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      expect(instance.getDataTypeSQL({ data_type: 'VARCHAR', length: 255 })).toBe('TEXT(255)');
      expect(instance.getDataTypeSQL({ data_type: 'INT' })).toBe('INTEGER');
      expect(instance.getDataTypeSQL({ data_type: 'DECIMAL' })).toBe('NUMERIC');
      expect(instance.getDataTypeSQL({ data_type: 'BLOB' })).toBe('BLOB');
    });

    test('generateColumnSQL이 올바른 컬럼 정의를 생성해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      const column: TableSchema = {
        table_name: 'test_table',
        column_name: 'test_column',
        data_type: 'TEXT',
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
      expect(result).toContain('TEXT');
      expect(result).toContain('NOT NULL');
      expect(result).toContain('UNIQUE');
    });

    test('INTEGER PRIMARY KEY 컬럼은 자동 증가 기본키로 정의되어야 함', () => {
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
      expect(result).toContain('PRIMARY KEY');
      // SQLite에서는 INTEGER PRIMARY KEY가 자동으로 ROWID와 연결되어 자동 증가
    });
  });
});
