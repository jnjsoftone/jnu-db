import mysql from 'mysql2/promise';
import { Connection, Pool, RowDataPacket } from 'mysql2/promise';
import { saveJson, loadJson } from 'jnu-abc';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface MySqlConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
  connectionLimit?: number;
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

interface TransactionResult {
  success: boolean;
  data?: any[];
  error?: Error;
}

const createPool = (config: MySqlConfig): Pool => {
  return mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    port: config.port || 3306,
    waitForConnections: true,
    connectionLimit: config.connectionLimit || 10,
    queueLimit: 0,
  });
};

const connect = async (config: MySqlConfig): Promise<Connection | null> => {
  try {
    const connection = await mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
      port: config.port || 3306,
    });
    return connection;
  } catch (error) {
    console.error('MySQL 연결 오류:', error);
    return null;
  }
};

const disconnect = async (connection: Connection): Promise<void> => {
  try {
    await connection.end();
  } catch (error) {
    console.error('MySQL 연결 해제 오류:', error);
  }
};

const executeQuery = async (connection: Connection, query: string, params: any[] = []): Promise<QueryResult> => {
  try {
    const [result] = await connection.execute(query, params);
    return {
      success: true,
      data: result,
      error: undefined,
    };
  } catch (error) {
    console.error('쿼리 실행 실패:', error);
    return {
      success: false,
      data: undefined,
      error:
        error instanceof Error
          ? error
          : new Error(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'),
    };
  }
};

const executeTransaction = async (connection: Connection, queries: TransactionQuery[]): Promise<TransactionResult> => {
  try {
    // 트랜잭션 시작
    await connection.beginTransaction();

    const results: any[] = [];

    try {
      // 각 쿼리 실행
      for (const query of queries) {
        const [result] = await connection.execute(query.query, query.params || []);
        results.push(result);
      }

      // 모든 쿼리가 성공하면 커밋
      await connection.commit();

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      // 오류 발생 시 롤백
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    return {
      success: false,
      error: error as Error,
    };
  }
};

const backup = async (connection: Connection, backupPath: string): Promise<QueryResult> => {
  try {
    // 백업 디렉토리 생성
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 테이블 목록 조회
    const [tables] = await connection.execute<RowDataPacket[]>('SHOW TABLES');
    const backupData: Record<string, any[]> = {};

    // 각 테이블의 데이터 백업
    for (const table of tables) {
      const tableName = Object.values(table)[0] as string;
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT * FROM ${tableName}`);
      backupData[tableName] = rows;
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

const restore = async (connection: Connection, backupPath: string): Promise<QueryResult> => {
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
    await connection.beginTransaction();

    try {
      // 각 테이블의 데이터 복원
      for (const [tableName, data] of Object.entries(backupData)) {
        if (Array.isArray(data) && data.length > 0) {
          const columns = Object.keys(data[0]);
          const placeholders = columns.map(() => '?').join(',');
          const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

          for (const row of data) {
            await connection.execute(query, Object.values(row));
          }
        }
      }

      await connection.commit();
      return {
        success: true,
      };
    } catch (error) {
      await connection.rollback();
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

export { createPool, executeQuery, executeTransaction, backup, restore };
