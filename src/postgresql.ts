import { Pool, PoolClient, QueryResult } from 'pg';
import { saveJson, loadJson } from 'jnu-abc';

interface PostgresConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
  max?: number;
}

interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const createPool = (config: PostgresConfig): Pool => {
  return new Pool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    port: config.port || 5432,
    max: config.max || 20,
  });
};

const connect = async (config: PostgresConfig): Promise<PoolClient | null> => {
  try {
    const pool = createPool(config);
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('PostgreSQL 연결 오류:', error);
    return null;
  }
};

const disconnect = async (client: PoolClient): Promise<void> => {
  try {
    await client.release();
  } catch (error) {
    console.error('PostgreSQL 연결 해제 오류:', error);
  }
};

const executeQuery = async <T>(client: PoolClient, query: string, params: any[] = []): Promise<QueryResult<T[]>> => {
  try {
    const result = await client.query<T>(query, params);
    return { success: true, data: result.rows };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const executeTransaction = async <T>(
  client: PoolClient,
  queries: { query: string; params?: any[] }[]
): Promise<QueryResult<T[]>> => {
  try {
    const results: T[] = [];
    await client.query('BEGIN');

    for (const { query, params = [] } of queries) {
      const result = await client.query<T>(query, params);
      results.push(...result.rows);
    }

    await client.query('COMMIT');
    return { success: true, data: results };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const backup = async (client: PoolClient, backupPath: string): Promise<QueryResult<void>> => {
  try {
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const backupData: Record<string, any[]> = {};

    for (const { table_name } of tables.rows) {
      const result = await client.query(`SELECT * FROM ${table_name}`);
      backupData[table_name] = result.rows;
    }

    await saveJson(backupPath, backupData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const restore = async (client: PoolClient, backupPath: string): Promise<QueryResult<void>> => {
  try {
    const backupData = await loadJson(backupPath);

    await client.query('BEGIN');

    for (const [tableName, data] of Object.entries(backupData)) {
      if (Array.isArray(data) && data.length > 0) {
        const columns = Object.keys(data[0]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
        const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;

        for (const row of data) {
          await client.query(query, Object.values(row));
        }
      }
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

export { createPool, connect, disconnect, executeQuery, executeTransaction, backup, restore };
