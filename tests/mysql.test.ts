import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { executeQuery, executeTransaction, backup, restore } from '../src/mysql';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

describe('MySQL 유틸리티 테스트', () => {
  let connection: mysql.Connection;
  const testData = [
    { name: 'Test User 1', email: 'test1@example.com' },
    { name: 'Test User 2', email: 'test2@example.com' },
  ];

  beforeEach(async () => {
    try {
      // 테스트 데이터베이스 연결
      connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        connectTimeout: 10000, // 연결 타임아웃 10초로 설정
      });

      // 외래 키 제약 조건 비활성화
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

      // 테이블 초기화
      await connection.execute('DROP TABLE IF EXISTS test_users');
      await connection.execute(`
        CREATE TABLE test_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL
        )
      `);

      // 외래 키 제약 조건 다시 활성화
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    } catch (error) {
      console.error('데이터베이스 연결 실패:', error);
      throw error;
    }
  });

  afterEach(async () => {
    if (connection) {
      // 외래 키 제약 조건 비활성화
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
      // 테이블 삭제
      await connection.execute('DROP TABLE IF EXISTS test_users');
      // 외래 키 제약 조건 다시 활성화
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      await connection.end();
    }
  });

  describe('executeQuery', () => {
    it('데이터 삽입이 성공해야 함', async () => {
      const result = await executeQuery(connection, 'INSERT INTO test_users (name, email) VALUES (?, ?)', [
        testData[0].name,
        testData[0].email,
      ]);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.affectedRows).toBe(1);
    });

    it('데이터 조회가 성공해야 함', async () => {
      // 먼저 테스트 데이터 삽입
      await executeQuery(connection, 'INSERT INTO test_users (name, email) VALUES (?, ?)', [
        testData[0].name,
        testData[0].email,
      ]);

      const result = await executeQuery(connection, 'SELECT * FROM test_users WHERE name = ?', [testData[0].name]);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].name).toBe(testData[0].name);
    });
  });

  describe('executeTransaction', () => {
    it('트랜잭션이 성공적으로 실행되어야 함', async () => {
      const queries = [
        { query: 'INSERT INTO test_users (name, email) VALUES (?, ?)', params: [testData[0].name, testData[0].email] },
        { query: 'INSERT INTO test_users (name, email) VALUES (?, ?)', params: [testData[1].name, testData[1].email] },
      ];

      const result = await executeTransaction(connection, queries);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.affectedRows).toBe(2);
    });

    it('트랜잭션 실패 시 롤백되어야 함', async () => {
      const queries = [
        { query: 'INSERT INTO test_users (name, email) VALUES (?, ?)', params: [testData[0].name, testData[0].email] },
        { query: 'INSERT INTO test_users (name, email) VALUES (?, ?)', params: [testData[1].name, testData[1].email] },
        { query: 'INSERT INTO invalid_table (name) VALUES (?)', params: ['error'] }, // 잘못된 쿼리
      ];

      const result = await executeTransaction(connection, queries);
      expect(result.success).toBe(false);

      // 롤백 확인
      const checkResult = await executeQuery(connection, 'SELECT * FROM test_users');
      expect(checkResult.data?.length).toBe(0);
    });
  });

  describe('backup and restore', () => {
    it('백업과 복원이 성공적으로 실행되어야 함', async () => {
      // 테스트 데이터 삽입
      await executeQuery(connection, 'INSERT INTO test_users (name, email) VALUES (?, ?)', [
        testData[0].name,
        testData[0].email,
      ]);

      // 백업 실행
      const backupPath = path.join(__dirname, 'backup.sql');
      const backupResult = await backup(connection, backupPath);
      expect(backupResult.success).toBe(true);

      // 데이터 삭제
      await executeQuery(connection, 'DELETE FROM test_users');

      // 복원 실행
      const restoreResult = await restore(connection, backupPath);
      expect(restoreResult.success).toBe(true);

      // 복원된 데이터 확인
      const checkResult = await executeQuery(connection, 'SELECT * FROM test_users');
      expect(checkResult.data?.length).toBe(1);
      expect(checkResult.data?.[0].name).toBe(testData[0].name);

      // 백업 파일 삭제
      fs.unlinkSync(backupPath);
    });
  });
});
