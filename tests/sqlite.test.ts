import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import sqlite3 from 'sqlite3';
import { executeQuery, executeTransaction, backup, restore } from '../src/sqlite';
import path from 'path';
import fs from 'fs';

describe('SQLite 유틸리티 테스트', () => {
  let db: sqlite3.Database;
  let connection: any;

  beforeAll(async () => {
    // SQLite 데이터베이스 파일 경로
    const dbPath = path.join(__dirname, 'test.db');

    // 기존 테스트 DB 파일이 있다면 삭제
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // 데이터베이스 연결
    db = new sqlite3.Database(dbPath);
    connection = db;
  });

  afterAll(async () => {
    // 데이터베이스 연결 종료
    db.close();
  });

  beforeEach(async () => {
    // 테스트 테이블 생성
    await new Promise<void>((resolve, reject) => {
      db.run(
        `
        CREATE TABLE IF NOT EXISTS test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });

  afterEach(async () => {
    // 테스트 테이블 삭제
    await new Promise<void>((resolve, reject) => {
      db.run('DROP TABLE IF EXISTS test_users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('executeQuery', () => {
    test('데이터 삽입이 성공해야 함', async () => {
      const result = await executeQuery(connection, 'INSERT INTO test_users (name, email) VALUES (?, ?)', [
        '테스트 사용자',
        'test@example.com',
      ]);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('데이터 조회가 성공해야 함', async () => {
      // 테스트 데이터 삽입
      await new Promise<void>((resolve, reject) => {
        db.run('INSERT INTO test_users (name, email) VALUES (?, ?)', ['테스트 사용자', 'test@example.com'], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const result = await executeQuery(connection, 'SELECT * FROM test_users WHERE email = ?', ['test@example.com']);

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
          query: 'INSERT INTO test_users (name, email) VALUES (?, ?)',
          params: ['사용자1', 'user1@example.com'],
        },
        {
          query: 'INSERT INTO test_users (name, email) VALUES (?, ?)',
          params: ['사용자2', 'user2@example.com'],
        },
      ];

      const result = await executeTransaction(connection, queries);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.affectedRows).toBe(2);

      // 데이터 확인
      const { data } = await executeQuery(connection, 'SELECT * FROM test_users');
      expect(data).toHaveLength(2);
    });

    test('트랜잭션 실패 시 롤백되어야 함', async () => {
      const queries = [
        {
          query: 'INSERT INTO test_users (name, email) VALUES (?, ?)',
          params: ['사용자1', 'user1@example.com'],
        },
        {
          query: 'INSERT INTO test_users (name, email) VALUES (?, ?)',
          params: ['사용자1', 'user1@example.com'], // 중복된 이메일로 실패 유도
        },
      ];

      const result = await executeTransaction(connection, queries);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // 롤백 확인
      const { data } = await executeQuery(connection, 'SELECT * FROM test_users');
      expect(data).toHaveLength(0);
    });
  });

  describe('backup and restore', () => {
    test('백업과 복원이 성공적으로 실행되어야 함', async () => {
      // 테스트 데이터 삽입
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO test_users (name, email) VALUES (?, ?), (?, ?)',
          ['사용자1', 'user1@example.com', '사용자2', 'user2@example.com'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

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
      const { data } = await executeQuery(connection, 'SELECT * FROM test_users');
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('사용자1');
      expect(data[1].name).toBe('사용자2');

      // 백업 파일 삭제
      fs.unlinkSync(backupPath);
    });
  });
});
