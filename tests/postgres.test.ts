import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Client } from 'pg';
import { executeQuery, executeTransaction, backup, restore } from '../src/postgres';
import path from 'path';
import fs from 'fs';

describe('PostgreSQL 유틸리티 테스트', () => {
  let client: typeof Client;
  let connection: any;

  beforeAll(async () => {
    // PostgreSQL 클라이언트 설정
    client = new Client({
      host: process.env.POSTGRES_HOST,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
    });

    // 연결
    await client.connect();
    connection = client;
  });

  afterAll(async () => {
    // 연결 종료
    await client.end();
  });

  beforeEach(async () => {
    // 테스트 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterEach(async () => {
    // 테스트 테이블 삭제
    await client.query('DROP TABLE IF EXISTS test_users CASCADE');
  });

  describe('executeQuery', () => {
    test('데이터 삽입이 성공해야 함', async () => {
      const result = await executeQuery(
        connection,
        'INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING *',
        ['테스트 사용자', 'test@example.com']
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data[0].name).toBe('테스트 사용자');
      expect(result.data[0].email).toBe('test@example.com');
    });

    test('데이터 조회가 성공해야 함', async () => {
      // 테스트 데이터 삽입
      await client.query('INSERT INTO test_users (name, email) VALUES ($1, $2)', ['테스트 사용자', 'test@example.com']);

      const result = await executeQuery(connection, 'SELECT * FROM test_users WHERE email = $1', ['test@example.com']);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data[0].name).toBe('테스트 사용자');
      expect(result.data[0].email).toBe('test@example.com');
    });
  });

  describe('executeTransaction', () => {
    test('트랜잭션이 성공적으로 실행되어야 함', async () => {
      const queries = [
        {
          query: 'INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING *',
          params: ['사용자1', 'user1@example.com'],
        },
        {
          query: 'INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING *',
          params: ['사용자2', 'user2@example.com'],
        },
      ];

      const result = await executeTransaction(connection, queries);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.affectedRows).toBe(2);

      // 데이터 확인
      const { rows } = await client.query('SELECT * FROM test_users');
      expect(rows).toHaveLength(2);
    });

    test('트랜잭션 실패 시 롤백되어야 함', async () => {
      const queries = [
        {
          query: 'INSERT INTO test_users (name, email) VALUES ($1, $2)',
          params: ['사용자1', 'user1@example.com'],
        },
        {
          query: 'INSERT INTO test_users (name, email) VALUES ($1, $2)',
          params: ['사용자1', 'user1@example.com'], // 중복된 이메일로 실패 유도
        },
      ];

      const result = await executeTransaction(connection, queries);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // 롤백 확인
      const { rows } = await client.query('SELECT * FROM test_users');
      expect(rows).toHaveLength(0);
    });
  });

  describe('backup and restore', () => {
    test('백업과 복원이 성공적으로 실행되어야 함', async () => {
      // 테스트 데이터 삽입
      await client.query('INSERT INTO test_users (name, email) VALUES ($1, $2), ($3, $4)', [
        '사용자1',
        'user1@example.com',
        '사용자2',
        'user2@example.com',
      ]);

      // 백업 실행
      const backupPath = path.join(__dirname, 'backup.json');
      const backupResult = await backup(connection, backupPath);
      expect(backupResult.success).toBe(true);

      // 데이터 삭제
      await executeQuery(connection, 'DELETE FROM test_users');

      // 복원 실행
      const restoreResult = await restore(connection, backupPath);
      expect(restoreResult.success).toBe(true);

      // 복원된 데이터 확인
      const { rows } = await client.query('SELECT * FROM test_users');
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('사용자1');
      expect(rows[1].name).toBe('사용자2');

      // 백업 파일 삭제
      fs.unlinkSync(backupPath);
    });
  });
});
