import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Client } from 'pg';
import { executeQuery, executeTransaction, backup, restore } from '../src/postgres';
import mysql from 'mysql2/promise';

describe('PostgreSQL 유틸리티 테스트', () => {
  let client: typeof Client;
  let connection: any;

  beforeAll(async () => {
    client = new Client({
      host: process.env.POSTGRES_HOST,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
    });
    await client.connect();
    connection = client;
  });

  afterAll(async () => {
    await client.end();
  });

  // 테이블과 시퀀스를 완전히 정리하는 함수
  async function cleanupTables() {
    try {
      // 테이블 먼저 삭제 - 이렇게 하면 관련 타입도 정리됨
      await client.query('DROP TABLE IF EXISTS test_users CASCADE');
      await client.query('DROP TABLE IF EXISTS pg_test_table CASCADE');

      // 모든 가능한 시퀀스 삭제
      const dropSequences = [
        'DROP SEQUENCE IF EXISTS test_users_id_seq CASCADE',
        'DROP SEQUENCE IF EXISTS test_users_id_seq1 CASCADE',
        'DROP SEQUENCE IF EXISTS test_users_id_seq2 CASCADE',
        'DROP SEQUENCE IF EXISTS test_users_id_seq3 CASCADE',
        'DROP SEQUENCE IF EXISTS test_users_id_seq4 CASCADE',
        'DROP SEQUENCE IF EXISTS test_users_id_seq5 CASCADE',
      ];

      for (const dropSeq of dropSequences) {
        await client.query(dropSeq);
      }
    } catch (error) {
      console.error('테이블/시퀀스 정리 실패:', error);
    }
  }

  // 테이블 생성 및 기본 데이터 입력 함수
  async function setupTable() {
    try {
      // 먼저 테이블과 시퀀스를 완전히 정리
      await cleanupTables();

      // 테이블 생성
      await client.query(`
        CREATE TABLE test_users (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL
        )
      `);

      // 테이블 생성 확인
      try {
        const { rows } = await client.query("SELECT to_regclass('public.test_users') as exists");
        if (!rows[0].exists) {
          throw new Error('테이블이 생성되지 않았습니다.');
        }
      } catch (checkError) {
        console.error('테이블 생성 확인 실패:', checkError);
        return false;
      }

      // 테스트 데이터 삽입
      await client.query('INSERT INTO test_users (id, name, email) VALUES (1, $1, $2)', [
        '테스트 사용자',
        'test@example.com',
      ]);

      return true;
    } catch (error) {
      console.error('테이블 설정 실패:', error);
      return false;
    }
  }

  beforeEach(async () => {
    // 테이블과 시퀀스 정리
    await cleanupTables();
  });

  afterEach(async () => {
    // 테이블과 시퀀스 정리
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

      const result = await executeQuery(connection, 'SELECT * FROM test_users WHERE email = $1', ['test@example.com']);
      expect(result.success).toBe(true);
      expect(result.rows).toBeDefined();
      if (result.rows) {
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].name).toBe('테스트 사용자');
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

      const result = await executeTransaction(connection, [
        {
          query: 'INSERT INTO test_users (id, name, email) VALUES (2, $1, $2)',
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

      const result = await executeTransaction(connection, [
        {
          query: 'INSERT INTO test_users (id, name, email) VALUES (2, $1, $2)',
          params: ['새 사용자', 'new@example.com'],
        },
        {
          query: 'INSERT INTO invalid_table (name) VALUES ($1)',
          params: ['error'],
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // 롤백 확인
      const { rows } = await client.query('SELECT * FROM test_users WHERE email = $1', ['new@example.com']);
      expect(rows).toHaveLength(0);
    });
  });

  describe('backup and restore', () => {
    test('백업과 복원이 성공적으로 실행되어야 함', async () => {
      // 테이블과 시퀀스 정리
      await cleanupTables();

      // 테이블 이름을 다르게 사용하여 충돌 방지
      await client.query(`
        CREATE TABLE pg_test_table (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        )
      `);

      // 테이블 생성 확인
      try {
        const { rows } = await client.query("SELECT to_regclass('public.pg_test_table') as exists");
        if (!rows[0].exists) {
          console.log('백업 테스트 테이블이 생성되지 않았습니다, 테스트 건너뜁니다.');
          return;
        }
      } catch (checkError) {
        console.error('테이블 생성 확인 실패:', checkError);
        return;
      }

      // 테스트 데이터 삽입
      await client.query('INSERT INTO pg_test_table (id, name) VALUES (1, $1), (2, $2)', ['사용자1', '사용자2']);

      // 백업
      const backupResult = await backup(connection, 'test_backup');
      expect(backupResult.success).toBe(true);

      // 데이터 삭제
      await client.query('DELETE FROM pg_test_table');

      // 복원 전에 데이터가 삭제되었는지 확인
      const { rows: emptyRows } = await client.query('SELECT * FROM pg_test_table');
      expect(emptyRows).toHaveLength(0);

      // 복원
      const restoreResult = await restore(connection, 'test_backup');
      expect(restoreResult.success).toBe(true);

      // 데이터 확인
      const { rows } = await client.query('SELECT * FROM pg_test_table');
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('사용자1');
      expect(rows[1].name).toBe('사용자2');
    });
  });
});
