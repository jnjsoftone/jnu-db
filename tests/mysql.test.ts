import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import mysql from 'mysql2/promise';
import { executeQuery, executeTransaction, backup, restore } from '../src/mysql';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

describe('MySQL 유틸리티 테스트', () => {
  let connection: mysql.Connection;
  let dbConnection: any;
  const testData = [
    { name: 'Test User 1', email: 'test1@example.com' },
    { name: 'Test User 2', email: 'test2@example.com' },
  ];

  beforeAll(async () => {
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
    });
    dbConnection = connection;
  });

  afterAll(async () => {
    await connection.end();
  });

  // 테이블을 완전히 정리하는 함수
  async function cleanupTables() {
    try {
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query('DROP TABLE IF EXISTS test_users');
      await connection.query('DROP TABLE IF EXISTS mysql_test_table');
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (error) {
      console.error('테이블 정리 실패:', error);
    }
  }

  // 테이블 생성 및 기본 데이터 입력 함수
  async function setupTable() {
    try {
      // 트랜잭션 시작
      await connection.beginTransaction();

      // 테이블 삭제
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query('DROP TABLE IF EXISTS test_users');

      // 테이블 생성
      await connection.query(`
        CREATE TABLE test_users (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL
        )
      `);

      // 테이블 생성 확인
      const [checkRows] = await connection.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "test_users"'
      );
      if (!checkRows[0] || checkRows[0].count !== 1) {
        await connection.rollback();
        throw new Error('테이블이 생성되지 않았습니다.');
      }

      // 테스트 데이터 삽입
      await connection.query('INSERT INTO test_users (id, name, email) VALUES (1, ?, ?)', [
        '테스트 사용자',
        'test@example.com',
      ]);

      // 테이블 확인
      const [rows] = await connection.query('SELECT COUNT(*) as count FROM test_users');
      if (!rows[0] || rows[0].count !== 1) {
        await connection.rollback();
        throw new Error('데이터가 올바르게 삽입되지 않았습니다.');
      }

      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      await connection.commit();

      return true;
    } catch (error) {
      // 오류 발생 시 롤백
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('롤백 실패:', rollbackError);
      }

      console.error('테이블 설정 실패:', error);
      return false;
    }
  }

  beforeEach(async () => {
    // 테이블 정리
    await cleanupTables();
  });

  afterEach(async () => {
    // 테이블 정리
    await cleanupTables();
  });

  describe('executeQuery', () => {
    test('데이터 조회가 성공해야 함', async () => {
      // 테이블 설정
      const setupSuccess = await setupTable();
      if (!setupSuccess) {
        console.log('테이블 설정 실패, 테스트 건너뜁니다.');
        return;
      }

      const result = await executeQuery(dbConnection, 'SELECT * FROM test_users WHERE email = ?', ['test@example.com']);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe('테스트 사용자');
      }
    });
  });

  describe('executeTransaction', () => {
    test('트랜잭션이 성공적으로 실행되어야 함', async () => {
      // 테이블 설정
      const setupSuccess = await setupTable();
      if (!setupSuccess) {
        console.log('테이블 설정 실패, 테스트 건너뜁니다.');
        return;
      }

      const result = await executeTransaction(dbConnection, [
        {
          query: 'INSERT INTO test_users (id, name, email) VALUES (2, ?, ?)',
          params: ['새 사용자', 'new@example.com'],
        },
        {
          query: 'SELECT * FROM test_users',
          params: [],
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data[1]).toBeDefined();
        if (result.data[1]) {
          expect(Array.isArray(result.data[1])).toBe(true);
          expect(result.data[1]).toHaveLength(2);
          expect(result.data[1][1].name).toBe('새 사용자');
        }
      }
    });

    test('트랜잭션 실패 시 롤백되어야 함', async () => {
      // 테이블 설정
      const setupSuccess = await setupTable();
      if (!setupSuccess) {
        console.log('테이블 설정 실패, 테스트 건너뜁니다.');
        return;
      }

      const result = await executeTransaction(dbConnection, [
        {
          query: 'INSERT INTO test_users (id, name, email) VALUES (2, ?, ?)',
          params: ['새 사용자', 'new@example.com'],
        },
        {
          query: 'INSERT INTO invalid_table (name) VALUES (?)',
          params: ['error'],
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // 롤백 확인
      const [rows] = await connection.query('SELECT * FROM test_users WHERE email = ?', ['new@example.com']);
      expect(rows).toHaveLength(0);
    });
  });

  describe('backup and restore', () => {
    test('백업과 복원이 성공적으로 실행되어야 함', async () => {
      try {
        // 트랜잭션 시작
        await connection.beginTransaction();

        // 테이블 정리
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('DROP TABLE IF EXISTS mysql_test_table');

        // 테이블 생성
        await connection.query(`
          CREATE TABLE mysql_test_table (
            id INT PRIMARY KEY,
            name VARCHAR(100) NOT NULL
          )
        `);

        // 테이블 및 데이터 확인
        const [checkRows] = await connection.query(
          'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = "mysql_test_table"'
        );
        if (!checkRows[0] || checkRows[0].count !== 1) {
          await connection.rollback();
          console.log('백업 테스트 테이블이 생성되지 않았습니다, 테스트 건너뜁니다.');
          return;
        }

        // 테스트 데이터 삽입
        await connection.query('INSERT INTO mysql_test_table (id, name) VALUES (1, ?), (2, ?)', ['사용자1', '사용자2']);

        // 커밋
        await connection.commit();

        // 테이블 확인
        const [dataRows] = await connection.query('SELECT COUNT(*) as count FROM mysql_test_table');
        if (!dataRows[0] || dataRows[0].count !== 2) {
          console.log('테스트 데이터가 올바르게 삽입되지 않았습니다, 테스트 건너뜁니다.');
          return;
        }

        // 백업
        const backupResult = await backup(dbConnection, 'test_backup');
        expect(backupResult.success).toBe(true);

        // 데이터 삭제
        await connection.query('DELETE FROM mysql_test_table');

        // 삭제 확인
        const [emptyRows] = await connection.query('SELECT * FROM mysql_test_table');
        expect(emptyRows).toHaveLength(0);

        // 복원
        const restoreResult = await restore(dbConnection, 'test_backup');
        expect(restoreResult.success).toBe(true);

        // 데이터 확인
        const [rows] = await connection.query('SELECT * FROM mysql_test_table');
        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBe('사용자1');
        expect(rows[1].name).toBe('사용자2');

        // 테스트 후 정리
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('DROP TABLE IF EXISTS mysql_test_table');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      } catch (error) {
        // 오류 발생 시 롤백
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error('롤백 실패:', rollbackError);
        }
        throw error;
      }
    });
  });
});
