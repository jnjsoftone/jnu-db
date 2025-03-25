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
  rows?: T[];
  data?: T;
  error?: Error;
}

interface TransactionQuery {
  query: string;
  params?: any[];
}

interface BackupResult {
  success: boolean;
  tables?: string[];
  error?: Error;
}

interface TransactionResult {
  success: boolean;
  data?: any[];
  error?: Error;
}

const executeQuery = async (connection: any, query: string, params: any[] = []): Promise<QueryResult> => {
  try {
    const result = await connection.query(query, params);
    return {
      success: true,
      rows: result.rows,
      data: result.rows,
      error: undefined,
    };
  } catch (error) {
    console.error('쿼리 실행 실패:', error);
    return {
      success: false,
      rows: undefined,
      data: undefined,
      error:
        error instanceof Error
          ? error
          : new Error(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'),
    };
  }
};

const executeTransaction = async (connection: any, queries: TransactionQuery[]): Promise<TransactionResult> => {
  try {
    // 트랜잭션 시작
    await connection.query('BEGIN');

    const results: any[] = [];

    try {
      // 각 쿼리 실행
      for (const query of queries) {
        const result = await connection.query(query.query, query.params || []);
        results.push(result.rows);
      }

      // 모든 쿼리가 성공하면 커밋
      await connection.query('COMMIT');

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      // 오류 발생 시 롤백
      await connection.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    return {
      success: false,
      error: error as Error,
    };
  }
};

const backup = async (connection: Client, backupPath: string): Promise<BackupResult> => {
  try {
    // 테이블이 존재하는지 확인
    const { rows } = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );

    if (rows.length === 0) {
      throw new Error('백업할 테이블이 없습니다.');
    }

    // 테이블 데이터 가져오기
    const tables: Record<string, any[]> = {};
    for (const { table_name } of rows) {
      const { rows: tableData } = await connection.query(`SELECT * FROM ${table_name}`);
      tables[table_name] = tableData;
    }

    // JSON 파일로 저장
    await fs.promises.writeFile(backupPath, JSON.stringify(tables, null, 2));

    return {
      success: true,
      tables: Object.keys(tables),
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
