import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { saveJson, loadJson } from 'jnu-abc';
import fs from 'fs';
import path from 'path';

interface SqliteConfig {
  filename: string;
}

interface QueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
}

interface TransactionQuery {
  query: string;
  params?: any[];
}

const executeQuery = async <T = any>(connection: Database, query: string, params?: any[]): Promise<QueryResult<T>> => {
  return new Promise((resolve) => {
    connection.all(query, params, (err, rows) => {
      if (err) {
        resolve({
          success: false,
          error: err,
        });
      } else {
        resolve({
          success: true,
          data: rows as T,
        });
      }
    });
  });
};

const executeTransaction = async (connection: Database, queries: TransactionQuery[]): Promise<QueryResult> => {
  return new Promise((resolve) => {
    let affectedRows = 0;

    const runQuery = (query: string, params?: any[]): Promise<number> => {
      return new Promise((resolveQuery, rejectQuery) => {
        connection.run(query, params, function (err) {
          if (err) {
            rejectQuery(err);
          } else {
            resolveQuery(this.changes || 0);
          }
        });
      });
    };

    const executeQueries = async () => {
      try {
        // 트랜잭션 시작
        await runQuery('BEGIN TRANSACTION');

        // 각 쿼리 실행
        for (const { query, params } of queries) {
          const changes = await runQuery(query, params);
          affectedRows += changes;
        }

        // 모든 쿼리가 성공적으로 실행되었다면 커밋
        await runQuery('COMMIT');

        resolve({
          success: true,
          data: { affectedRows },
        });
      } catch (error) {
        // 오류 발생 시 롤백
        try {
          await runQuery('ROLLBACK');
        } catch (rollbackError) {
          console.error('롤백 중 오류:', rollbackError);
        }

        resolve({
          success: false,
          error: error as Error,
        });
      }
    };

    connection.serialize(() => {
      executeQueries();
    });
  });
};

const backup = async (connection: Database, backupPath: string): Promise<QueryResult> => {
  try {
    // 백업 디렉토리 생성
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 테이블 목록 조회
    const tablesResult = await executeQuery<{ name: string }[]>(
      connection,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );

    if (!tablesResult.success) {
      throw tablesResult.error;
    }

    const backupData: Record<string, any[]> = {};

    // 각 테이블의 데이터 백업
    for (const { name } of tablesResult.data || []) {
      const result = await executeQuery(connection, `SELECT * FROM ${name}`);
      if (result.success && result.data) {
        backupData[name] = result.data;
      }
    }

    // JSON 파일로 저장
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    return {
      success: true,
    };
  } catch (error) {
    console.error('백업 실행 중 오류:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
};

const restore = async (connection: Database, backupPath: string): Promise<QueryResult> => {
  try {
    // 백업 파일이 존재하는지 확인
    if (!fs.existsSync(backupPath)) {
      console.error('백업 파일을 찾을 수 없습니다:', backupPath);
      return {
        success: false,
        error: new Error('백업 파일을 찾을 수 없습니다.'),
      };
    }

    // 백업 데이터 로드
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

    // 트랜잭션 시작
    await executeQuery(connection, 'BEGIN TRANSACTION');

    try {
      // 각 테이블의 데이터 복원
      for (const [tableName, data] of Object.entries(backupData)) {
        if (Array.isArray(data) && data.length > 0) {
          const columns = Object.keys(data[0]);
          const placeholders = columns.map(() => '?').join(',');
          const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

          for (const row of data) {
            await executeQuery(connection, query, Object.values(row));
          }
        }
      }

      await executeQuery(connection, 'COMMIT');
      return {
        success: true,
      };
    } catch (error) {
      await executeQuery(connection, 'ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('복원 실행 중 오류:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
};

export { executeQuery, executeTransaction, backup, restore };
