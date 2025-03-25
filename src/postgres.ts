import { Client, QueryResult as PgQueryResult } from 'pg';
import { saveJson, loadJson } from 'jnu-abc';
import fs from 'fs';
import path from 'path';

interface PostgresConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
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

const executeQuery = async <T = any>(connection: Client, query: string, params?: any[]): Promise<QueryResult<T>> => {
  try {
    const result = await connection.query(query, params);
    return {
      success: true,
      data: result.rows as T,
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error,
    };
  }
};

const executeTransaction = async (connection: Client, queries: TransactionQuery[]): Promise<QueryResult> => {
  try {
    await connection.query('BEGIN');
    let affectedRows = 0;

    for (const { query, params } of queries) {
      const result = await connection.query(query, params);
      affectedRows += result.rowCount || 0;
    }

    await connection.query('COMMIT');
    return {
      success: true,
      data: { affectedRows },
    };
  } catch (error) {
    await connection.query('ROLLBACK');
    return {
      success: false,
      error: error as Error,
    };
  }
};

const backup = async (connection: Client, backupPath: string): Promise<QueryResult> => {
  try {
    // 백업 디렉토리 생성
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 테이블 목록 조회
    const { rows: tables } = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const backupData: Record<string, any[]> = {};

    // 각 테이블의 데이터 백업
    for (const { table_name } of tables) {
      const { rows } = await connection.query(`SELECT * FROM ${table_name}`);
      backupData[table_name] = rows;
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

const restore = async (connection: Client, backupPath: string): Promise<QueryResult> => {
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
    await connection.query('BEGIN');

    try {
      // 각 테이블의 데이터 복원
      for (const [tableName, data] of Object.entries(backupData)) {
        if (Array.isArray(data) && data.length > 0) {
          const columns = Object.keys(data[0]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
          const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

          for (const row of data) {
            await connection.query(query, Object.values(row));
          }
        }
      }

      await connection.query('COMMIT');
      return {
        success: true,
      };
    } catch (error) {
      await connection.query('ROLLBACK');
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
