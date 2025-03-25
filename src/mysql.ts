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

const createPool = (config: MySqlConfig): Pool => {
  return mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    port: config.port || 3306,
    connectionLimit: config.connectionLimit || 10,
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

const executeQuery = async <T = any>(
  connection: mysql.Connection,
  query: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  try {
    const [rows] = await connection.execute(query, params);
    return {
      success: true,
      data: rows as T,
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error,
    };
  }
};

const executeTransaction = async (connection: mysql.Connection, queries: TransactionQuery[]): Promise<QueryResult> => {
  try {
    await connection.beginTransaction();
    let affectedRows = 0;

    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      affectedRows += (result as any).affectedRows || 0;
    }

    await connection.commit();
    return {
      success: true,
      data: { affectedRows },
    };
  } catch (error) {
    await connection.rollback();
    return {
      success: false,
      error: error as Error,
    };
  }
};

const backup = async (connection: mysql.Connection, backupPath: string): Promise<QueryResult> => {
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

const restore = async (connection: mysql.Connection, backupPath: string): Promise<QueryResult> => {
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

export { executeQuery, executeTransaction, backup, restore };
