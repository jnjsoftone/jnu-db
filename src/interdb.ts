import { Database as SQLiteDatabase } from 'sqlite3';
import { Client as PostgresClient } from 'pg';
import { Connection as MySQLConnection } from 'mysql2/promise';
import { executeQuery as executeSQLiteQuery } from './sqlite';
import { executeQuery as executePostgresQuery } from './postgres';
import { executeQuery as executeMySQLQuery } from './mysql';

type DatabaseType = 'sqlite' | 'postgres' | 'mysql';

interface DatabaseConnection {
  type: DatabaseType;
  connection: SQLiteDatabase | PostgresClient | MySQLConnection;
}

interface MigrationOptions {
  sourceDb: DatabaseConnection;
  targetDb: DatabaseConnection;
  tables?: string[];
  batchSize?: number;
}

interface MigrationResult {
  success: boolean;
  tables?: {
    name: string;
    rows: number;
    error?: Error;
  }[];
  error?: Error;
  data?: any;
}

const getTableSchema = async (db: DatabaseConnection, tableName: string): Promise<string[]> => {
  switch (db.type) {
    case 'sqlite': {
      const result = await executeSQLiteQuery(db.connection as SQLiteDatabase, `PRAGMA table_info(${tableName})`);
      return result.success
        ? result.data.filter((col: any) => !col.pk && col.name !== 'created_at').map((col: any) => col.name)
        : [];
    }
    case 'postgres': {
      const result = await executePostgresQuery(
        db.connection as PostgresClient,
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = $1 
         AND column_name != 'created_at' 
         AND column_default IS NULL OR column_default NOT LIKE 'nextval%'`,
        [tableName]
      );
      return result.success ? result.data.map((col: any) => col.column_name) : [];
    }
    case 'mysql': {
      const result = await executeMySQLQuery(db.connection as MySQLConnection, `SHOW COLUMNS FROM ${tableName}`);
      return result.success
        ? result.data
            .filter((col: any) => !col.Key.includes('PRI') && col.Field !== 'created_at')
            .map((col: any) => col.Field)
        : [];
    }
  }
};

const getTableData = async (
  db: DatabaseConnection,
  tableName: string,
  columns: string[],
  offset: number,
  limit: number
): Promise<any[]> => {
  const columnList = columns.join(', ');
  const pagination = db.type === 'postgres' ? 'LIMIT $1 OFFSET $2' : 'LIMIT ? OFFSET ?';
  const params = [limit, offset];

  switch (db.type) {
    case 'sqlite': {
      const result = await executeSQLiteQuery(
        db.connection as SQLiteDatabase,
        `SELECT ${columnList} FROM ${tableName} ${pagination}`,
        params
      );
      return result.success ? result.data : [];
    }
    case 'postgres': {
      const result = await executePostgresQuery(
        db.connection as PostgresClient,
        `SELECT ${columnList} FROM ${tableName} ${pagination}`,
        params
      );
      return result.success ? result.data : [];
    }
    case 'mysql': {
      const result = await executeMySQLQuery(
        db.connection as MySQLConnection,
        `SELECT ${columnList} FROM ${tableName} ${pagination}`,
        params
      );
      return result.success ? result.data : [];
    }
  }
};

const insertTableData = async (
  db: DatabaseConnection,
  tableName: string,
  columns: string[],
  data: any[]
): Promise<boolean> => {
  if (data.length === 0) return true;

  try {
    // 각 행을 개별적으로 삽입
    for (const row of data) {
      const columnList = columns.join(', ');
      const placeholders =
        db.type === 'postgres'
          ? `(${columns.map((_, i) => `$${i + 1}`).join(', ')})`
          : `(${columns.map(() => '?').join(', ')})`;

      const query = `INSERT INTO ${tableName} (${columnList}) VALUES ${placeholders}`;
      const params = columns.map((col) => row[col]);

      let result;
      switch (db.type) {
        case 'sqlite':
          result = await executeSQLiteQuery(db.connection as SQLiteDatabase, query, params);
          break;
        case 'postgres':
          result = await executePostgresQuery(db.connection as PostgresClient, query, params);
          break;
        case 'mysql':
          result = await executeMySQLQuery(db.connection as MySQLConnection, query, params);
          break;
      }

      if (!result.success) {
        console.error(`데이터 삽입 실패: ${JSON.stringify(result.error)}`);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('데이터 삽입 중 오류:', error);
    return false;
  }
};

const migrateTable = async (
  sourceDb: DatabaseConnection,
  targetDb: DatabaseConnection,
  tableName: string,
  batchSize: number = 1000
): Promise<{ rows: number; error?: Error }> => {
  try {
    // 테이블 스키마 가져오기
    const columns = await getTableSchema(sourceDb, tableName);
    if (columns.length === 0) {
      throw new Error(`테이블 ${tableName}의 스키마를 가져올 수 없습니다.`);
    }

    let offset = 0;
    let totalRows = 0;
    let hasError = false;

    while (!hasError) {
      // 데이터 배치 가져오기
      const data = await getTableData(sourceDb, tableName, columns, offset, batchSize);
      if (data.length === 0) break;

      // 데이터 삽입
      const success = await insertTableData(targetDb, tableName, columns, data);
      if (!success) {
        hasError = true;
        throw new Error(`테이블 ${tableName}의 데이터 삽입 중 오류가 발생했습니다.`);
      }

      totalRows += data.length;
      offset += batchSize;
    }

    // 데이터가 실제로 삽입되었는지 확인
    let verifyQuery = '';
    let verifyParams: any[] = [];

    switch (targetDb.type) {
      case 'sqlite':
        verifyQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
        break;
      case 'postgres':
        verifyQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
        break;
      case 'mysql':
        verifyQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
        break;
    }

    const verifyResult = await executeQuery(targetDb, verifyQuery, verifyParams);
    if (!verifyResult.success) {
      throw new Error(`테이블 ${tableName}의 데이터 검증 중 오류가 발생했습니다.`);
    }

    const actualRows = parseInt(verifyResult.data[0].count.toString());
    return { rows: actualRows };
  } catch (error) {
    return { rows: 0, error: error as Error };
  }
};

const migrate = async (
  sourceDb: DatabaseConnection,
  targetDb: DatabaseConnection,
  tableName: string
): Promise<MigrationResult> => {
  try {
    // 테이블 스키마 가져오기
    const columns = await getTableSchema(sourceDb, tableName);
    if (columns.length === 0) {
      throw new Error(`테이블 ${tableName}의 스키마를 가져올 수 없습니다.`);
    }

    // 데이터 가져오기
    const data = await getTableData(sourceDb, tableName, columns, 0, 1000);
    if (data.length === 0) {
      return {
        success: true,
        tables: [{ name: tableName, rows: 0 }],
      };
    }

    // 데이터 삽입
    const success = await insertTableData(targetDb, tableName, columns, data);
    if (!success) {
      throw new Error(`테이블 ${tableName}의 데이터 삽입 중 오류가 발생했습니다.`);
    }

    return {
      success: true,
      tables: [{ name: tableName, rows: data.length }],
      data: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error,
    };
  }
};

const executeQuery = async (db: DatabaseConnection, query: string, params: any[] = []): Promise<any> => {
  switch (db.type) {
    case 'sqlite':
      return await executeSQLiteQuery(db.connection as SQLiteDatabase, query, params);
    case 'postgres':
      return await executePostgresQuery(db.connection as PostgresClient, query, params);
    case 'mysql':
      return await executeMySQLQuery(db.connection as MySQLConnection, query, params);
  }
};

export { migrate, DatabaseType, DatabaseConnection, MigrationOptions, MigrationResult };
