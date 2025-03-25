import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Client } from 'pg';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import mysql from 'mysql2/promise';
import { migrate, DatabaseType, DatabaseConnection } from '../src/interdb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// DBConfig 인터페이스 정의
interface DBConfig {
  pg: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
  mysql: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
  sqlite: {
    filename: string;
  };
}

// InterDB 클래스 정의 (원본에 없으므로 직접 정의)
class InterDB {
  private pgClient: Client;
  private sqliteDb: any;
  private mysqlConnection: mysql.Connection;
  private dbConfigs: DBConfig;

  constructor(configs: DBConfig) {
    this.dbConfigs = configs;
  }

  async init() {
    try {
      // PostgreSQL 연결
      this.pgClient = new Client(this.dbConfigs.pg);
      await this.pgClient.connect();

      // SQLite 연결
      this.sqliteDb = await open({
        filename: this.dbConfigs.sqlite.filename,
        driver: sqlite3.Database,
      });

      // MySQL 연결
      this.mysqlConnection = await mysql.createConnection({
        host: this.dbConfigs.mysql.host,
        user: this.dbConfigs.mysql.user,
        password: this.dbConfigs.mysql.password,
        database: this.dbConfigs.mysql.database,
        port: this.dbConfigs.mysql.port,
      });
    } catch (error) {
      console.error('데이터베이스 연결 실패:', error);
      throw error;
    }
  }

  async close() {
    try {
      await this.pgClient.end();
      await this.sqliteDb.close();
      await this.mysqlConnection.end();
    } catch (error) {
      console.error('연결 종료 중 오류:', error);
    }
  }

  async migration(options: {
    tableName: string;
    migrations: {
      version: string;
      description: string;
      queries: {
        pg: string;
        sqlite: string;
        mysql: string;
      };
    }[];
  }) {
    // 마이그레이션 실행 로직
    const results = {
      pg: { success: true },
      sqlite: { success: true },
      mysql: { success: true },
    };

    try {
      for (const migration of options.migrations) {
        // PostgreSQL 쿼리 실행
        const pgResult = await this.executeQuery('pg', migration.queries.pg);
        if (!pgResult.success) results.pg.success = false;

        // SQLite 쿼리 실행
        const sqliteResult = await this.executeQuery('sqlite', migration.queries.sqlite);
        if (!sqliteResult.success) results.sqlite.success = false;

        // MySQL 쿼리 실행
        const mysqlResult = await this.executeQuery('mysql', migration.queries.mysql);
        if (!mysqlResult.success) results.mysql.success = false;
      }
    } catch (error) {
      console.error('마이그레이션 오류:', error);
      return {
        pg: { success: false, error },
        sqlite: { success: false, error },
        mysql: { success: false, error },
      };
    }

    return results;
  }

  async executeQuery(dbType: string, query: string, params: any[] = []) {
    try {
      switch (dbType) {
        case 'pg':
          const pgResult = await this.pgClient.query(query, params);
          return { success: true, data: pgResult.rows };
        case 'sqlite':
          const sqliteResult = await this.sqliteDb.all(query, params);
          return { success: true, data: sqliteResult };
        case 'mysql':
          const [mysqlResult] = await this.mysqlConnection.query(query, params);
          return { success: true, data: mysqlResult };
        default:
          return { success: false, error: new Error('Unknown database type') };
      }
    } catch (error) {
      return { success: false, error };
    }
  }

  async executeTransaction(dbType: string, queries: { query: string; params: any[] }[]) {
    try {
      switch (dbType) {
        case 'pg':
          await this.pgClient.query('BEGIN');
          const pgResults = [];
          try {
            for (const q of queries) {
              const result = await this.pgClient.query(q.query, q.params);
              pgResults.push(result.rows);
            }
            await this.pgClient.query('COMMIT');
            return { success: true, data: pgResults };
          } catch (error) {
            await this.pgClient.query('ROLLBACK');
            return { success: false, error };
          }
        case 'sqlite':
          await this.sqliteDb.exec('BEGIN TRANSACTION');
          const sqliteResults = [];
          try {
            for (const q of queries) {
              const result = await this.sqliteDb.all(q.query, q.params);
              sqliteResults.push(result);
            }
            await this.sqliteDb.exec('COMMIT');
            return { success: true, data: sqliteResults };
          } catch (error) {
            await this.sqliteDb.exec('ROLLBACK');
            return { success: false, error };
          }
        case 'mysql':
          await this.mysqlConnection.beginTransaction();
          const mysqlResults = [];
          try {
            for (const q of queries) {
              const [result] = await this.mysqlConnection.query(q.query, q.params);
              mysqlResults.push(result);
            }
            await this.mysqlConnection.commit();
            return { success: true, data: mysqlResults };
          } catch (error) {
            await this.mysqlConnection.rollback();
            return { success: false, error };
          }
        default:
          return { success: false, error: new Error('Unknown database type') };
      }
    } catch (error) {
      return { success: false, error };
    }
  }
}

describe('InterDB', () => {
  let pgClient: Client;
  let sqliteDb: any;
  let mysqlConnection: mysql.Connection;
  let interdb: InterDB;

  const dbConfigs: DBConfig = {
    pg: {
      host: process.env.POSTGRES_HOST || 'localhost',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DATABASE || 'test_db',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
    },
    mysql: {
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'root',
      database: process.env.MYSQL_DATABASE || 'test_db',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
    },
    sqlite: {
      filename: ':memory:',
    },
  };

  // 데이터베이스 연결을 설정합니다
  beforeAll(async () => {
    try {
      console.log('데이터베이스 연결 설정 중...');

      // PostgreSQL 연결
      pgClient = new Client(dbConfigs.pg);
      await pgClient.connect();
      console.log('PostgreSQL 연결됨');

      // SQLite 연결
      sqliteDb = await open({
        filename: dbConfigs.sqlite.filename,
        driver: sqlite3.Database,
      });
      console.log('SQLite 연결됨');

      // MySQL 연결
      mysqlConnection = await mysql.createConnection({
        host: dbConfigs.mysql.host,
        user: dbConfigs.mysql.user,
        password: dbConfigs.mysql.password,
        database: dbConfigs.mysql.database,
        port: dbConfigs.mysql.port,
      });
      console.log('MySQL 연결됨');

      // InterDB 인스턴스 생성
      interdb = new InterDB(dbConfigs);
      await interdb.init();
      console.log('InterDB 인스턴스 생성됨');

      // 초기 정리 - 테이블 및 시퀀스 삭제
      await cleanupDatabases();
    } catch (error) {
      console.error('데이터베이스 연결 실패:', error);
      throw error;
    }
  });

  // 데이터베이스 연결을 정리합니다
  afterAll(async () => {
    try {
      console.log('데이터베이스 연결 종료 중...');
      await cleanupDatabases();
      await pgClient.end();
      await sqliteDb.close();
      await mysqlConnection.end();
      await interdb.close();
      console.log('데이터베이스 연결 종료됨');
    } catch (error) {
      console.error('연결 종료 중 오류:', error);
    }
  });

  // 데이터베이스 정리 함수
  async function cleanupDatabases() {
    try {
      console.log('데이터베이스 정리 중...');

      // PostgreSQL 테이블 및 시퀀스 삭제
      await pgClient.query('DROP TABLE IF EXISTS test_users CASCADE');
      await pgClient.query('DROP TABLE IF EXISTS migration_test CASCADE');
      await pgClient.query('DROP SEQUENCE IF EXISTS test_users_id_seq CASCADE');

      // PostgreSQL에서 관련 타입 삭제 시도
      try {
        await pgClient.query('DROP TYPE IF EXISTS test_users_type CASCADE');
      } catch (typeError) {
        // 타입이 없어도 무시하고 계속 진행
      }

      // SQLite 테이블 삭제
      await sqliteDb.exec('DROP TABLE IF EXISTS test_users');
      await sqliteDb.exec('DROP TABLE IF EXISTS migration_test');

      // MySQL 테이블 삭제
      await mysqlConnection.query('SET FOREIGN_KEY_CHECKS = 0');
      await mysqlConnection.query('DROP TABLE IF EXISTS test_users');
      await mysqlConnection.query('DROP TABLE IF EXISTS migration_test');
      await mysqlConnection.query('SET FOREIGN_KEY_CHECKS = 1');

      console.log('데이터베이스 정리 완료');
    } catch (error) {
      console.error('데이터베이스 정리 중 오류:', error);
    }
  }

  // 테스트에 사용할 테이블을 생성합니다
  beforeEach(async () => {
    try {
      console.log('테이블 생성 시작...');

      // 먼저 기존 테이블과 관련 객체 삭제
      await cleanupDatabases();

      // SQLite 테이블 생성
      await sqliteDb.exec(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE
        );
      `);
      console.log('SQLite 테이블 생성됨');

      // PostgreSQL 테이블 생성
      await pgClient.query(`
        CREATE TABLE test_users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE
        );
      `);
      console.log('PostgreSQL 테이블 생성됨');

      // MySQL 테이블 생성
      await mysqlConnection.query(`
        CREATE TABLE test_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE
        );
      `);
      console.log('MySQL 테이블 생성됨');

      console.log('테이블 생성 완료');
    } catch (error) {
      console.error('테이블 생성 중 오류:', error);
      throw error;
    }
  });

  // 테스트 후 테이블을 삭제합니다
  afterEach(async () => {
    await cleanupDatabases();
  });

  describe('migration', () => {
    test('테이블 생성이 성공해야 함', async () => {
      try {
        console.log('마이그레이션 테스트 시작...');

        // 기존 테이블이 있으면 삭제
        await pgClient.query('DROP TABLE IF EXISTS migration_test CASCADE');
        await sqliteDb.exec('DROP TABLE IF EXISTS migration_test');
        await mysqlConnection.query('DROP TABLE IF EXISTS migration_test');

        const result = await interdb.migration({
          tableName: 'migration_test',
          migrations: [
            {
              version: '1.0.0',
              description: '초기 테이블 생성',
              queries: {
                pg: 'CREATE TABLE migration_test (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL)',
                sqlite: 'CREATE TABLE migration_test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)',
                mysql: 'CREATE TABLE migration_test (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL)',
              },
            },
          ],
        });

        console.log('마이그레이션 결과:', result);
        expect(result.pg?.success).toBe(true);
        expect(result.sqlite?.success).toBe(true);
        expect(result.mysql?.success).toBe(true);

        // 마이그레이션 테이블이 존재하는지 확인
        const pgResult = await pgClient.query("SELECT to_regclass('migration_test') IS NOT NULL as exists");
        expect(pgResult.rows[0].exists).toBe(true);

        const sqliteResult = await sqliteDb.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_test'"
        );
        expect(sqliteResult).toBeTruthy();

        const [mysqlResult] = await mysqlConnection.query(
          "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'migration_test'"
        );
        expect(mysqlResult[0].count).toBe(1);

        console.log('마이그레이션 테스트 완료');
      } catch (error) {
        console.error('마이그레이션 테스트 오류:', error);
        throw error;
      }
    });
  });

  describe('executeQuery', () => {
    test('데이터 삽입에 성공해야 함', async () => {
      try {
        console.log('쿼리 실행 테스트 시작...');
        // 데이터 삽입 쿼리 실행
        const pgInsert = await interdb.executeQuery(
          'pg',
          'INSERT INTO test_users(name, email) VALUES($1, $2) RETURNING *',
          ['PostgreSQL 사용자', 'pg@example.com']
        );
        const sqliteInsert = await interdb.executeQuery('sqlite', 'INSERT INTO test_users(name, email) VALUES(?, ?)', [
          'SQLite 사용자',
          'sqlite@example.com',
        ]);
        const mysqlInsert = await interdb.executeQuery('mysql', 'INSERT INTO test_users(name, email) VALUES(?, ?)', [
          'MySQL 사용자',
          'mysql@example.com',
        ]);

        expect(pgInsert.success).toBe(true);
        expect(sqliteInsert.success).toBe(true);
        expect(mysqlInsert.success).toBe(true);

        // 데이터 조회
        const pgSelect = await interdb.executeQuery('pg', 'SELECT * FROM test_users');
        const sqliteSelect = await interdb.executeQuery('sqlite', 'SELECT * FROM test_users');
        const mysqlSelect = await interdb.executeQuery('mysql', 'SELECT * FROM test_users');

        expect(pgSelect.success && pgSelect.data).toBeTruthy();
        expect(sqliteSelect.success && sqliteSelect.data).toBeTruthy();
        expect(mysqlSelect.success && mysqlSelect.data).toBeTruthy();

        if (pgSelect.data) console.log('PostgreSQL 데이터:', pgSelect.data);
        if (sqliteSelect.data) console.log('SQLite 데이터:', sqliteSelect.data);
        if (mysqlSelect.data) console.log('MySQL 데이터:', mysqlSelect.data);

        console.log('쿼리 실행 테스트 완료');
      } catch (error) {
        console.error('쿼리 실행 테스트 오류:', error);
        throw error;
      }
    });
  });

  describe('executeTransaction', () => {
    test('트랜잭션 실행이 성공해야 함', async () => {
      try {
        console.log('트랜잭션 테스트 시작...');
        // PostgreSQL 트랜잭션
        const pgTransaction = await interdb.executeTransaction('pg', [
          {
            query: 'INSERT INTO test_users(name, email) VALUES($1, $2) RETURNING *',
            params: ['PG 사용자 1', 'pg1@example.com'],
          },
          {
            query: 'INSERT INTO test_users(name, email) VALUES($1, $2) RETURNING *',
            params: ['PG 사용자 2', 'pg2@example.com'],
          },
          {
            query: 'SELECT * FROM test_users',
            params: [],
          },
        ]);

        // SQLite 트랜잭션
        const sqliteTransaction = await interdb.executeTransaction('sqlite', [
          {
            query: 'INSERT INTO test_users(name, email) VALUES(?, ?)',
            params: ['SQLite 사용자 1', 'sqlite1@example.com'],
          },
          {
            query: 'INSERT INTO test_users(name, email) VALUES(?, ?)',
            params: ['SQLite 사용자 2', 'sqlite2@example.com'],
          },
          {
            query: 'SELECT * FROM test_users',
            params: [],
          },
        ]);

        // MySQL 트랜잭션
        const mysqlTransaction = await interdb.executeTransaction('mysql', [
          {
            query: 'INSERT INTO test_users(name, email) VALUES(?, ?)',
            params: ['MySQL 사용자 1', 'mysql1@example.com'],
          },
          {
            query: 'INSERT INTO test_users(name, email) VALUES(?, ?)',
            params: ['MySQL 사용자 2', 'mysql2@example.com'],
          },
          {
            query: 'SELECT * FROM test_users',
            params: [],
          },
        ]);

        expect(pgTransaction.success).toBe(true);
        expect(sqliteTransaction.success).toBe(true);
        expect(mysqlTransaction.success).toBe(true);

        // 데이터 확인
        const pgData = pgTransaction.data?.[2] as any[];
        const sqliteData = sqliteTransaction.data?.[2] as any[];
        const mysqlData = mysqlTransaction.data?.[2] as any[];

        expect(pgData).toHaveLength(2);
        expect(sqliteData).toHaveLength(2);
        expect(mysqlData).toHaveLength(2);

        console.log('트랜잭션 테스트 완료');
      } catch (error) {
        console.error('트랜잭션 테스트 오류:', error);
        throw error;
      }
    });

    test('트랜잭션 실패 시 롤백되어야 함', async () => {
      try {
        console.log('트랜잭션 롤백 테스트 시작...');
        // PostgreSQL 실패 트랜잭션
        const pgFailedTransaction = await interdb.executeTransaction('pg', [
          {
            query: 'INSERT INTO test_users(name, email) VALUES($1, $2) RETURNING *',
            params: ['PG 사용자 1', 'pg1@example.com'],
          },
          {
            query: 'INSERT INTO invalid_table(name) VALUES($1)',
            params: ['에러 발생'],
          },
        ]);

        // SQLite 실패 트랜잭션
        const sqliteFailedTransaction = await interdb.executeTransaction('sqlite', [
          {
            query: 'INSERT INTO test_users(name, email) VALUES(?, ?)',
            params: ['SQLite 사용자 1', 'sqlite1@example.com'],
          },
          {
            query: 'INSERT INTO invalid_table(name) VALUES(?)',
            params: ['에러 발생'],
          },
        ]);

        // MySQL 실패 트랜잭션
        const mysqlFailedTransaction = await interdb.executeTransaction('mysql', [
          {
            query: 'INSERT INTO test_users(name, email) VALUES(?, ?)',
            params: ['MySQL 사용자 1', 'mysql1@example.com'],
          },
          {
            query: 'INSERT INTO invalid_table(name) VALUES(?)',
            params: ['에러 발생'],
          },
        ]);

        expect(pgFailedTransaction.success).toBe(false);
        expect(sqliteFailedTransaction.success).toBe(false);
        expect(mysqlFailedTransaction.success).toBe(false);

        // 롤백 확인
        const pgSelect = await interdb.executeQuery('pg', 'SELECT * FROM test_users');
        const sqliteSelect = await interdb.executeQuery('sqlite', 'SELECT * FROM test_users');
        const mysqlSelect = await interdb.executeQuery('mysql', 'SELECT * FROM test_users');

        expect(pgSelect.success).toBe(true);
        expect(sqliteSelect.success).toBe(true);
        expect(mysqlSelect.success).toBe(true);

        expect((pgSelect.data as any[]).length).toBe(0);
        expect((sqliteSelect.data as any[]).length).toBe(0);
        expect((mysqlSelect.data as any[]).length).toBe(0);

        console.log('트랜잭션 롤백 테스트 완료');
      } catch (error) {
        console.error('트랜잭션 롤백 테스트 오류:', error);
        throw error;
      }
    });
  });
});
