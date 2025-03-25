import { PrismaClient } from '@prisma/client';
import { saveJson, loadJson } from 'jnu-abc';

interface PrismaConfig {
  datasource: {
    url: string;
  };
}

interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const connect = async (config: PrismaConfig): Promise<PrismaClient | null> => {
  try {
    const client = new PrismaClient({
      datasources: {
        db: {
          url: config.datasource.url,
        },
      },
    });
    await client.$connect();
    return client;
  } catch (error) {
    console.error('Prisma 연결 오류:', error);
    return null;
  }
};

const disconnect = async (client: PrismaClient): Promise<void> => {
  try {
    await client.$disconnect();
  } catch (error) {
    console.error('Prisma 연결 해제 오류:', error);
  }
};

const executeQuery = async <T>(
  client: PrismaClient,
  model: string,
  operation: string,
  args: any = {}
): Promise<QueryResult<T>> => {
  try {
    const result = await (client as any)[model][operation](args);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const executeTransaction = async <T>(
  client: PrismaClient,
  operations: {
    model: string;
    operation: string;
    args: any;
  }[]
): Promise<QueryResult<T[]>> => {
  try {
    const results = await client.$transaction(operations.map((op) => (client as any)[op.model][op.operation](op.args)));
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const backup = async (client: PrismaClient, backupPath: string): Promise<QueryResult<void>> => {
  try {
    const models = Object.keys(client).filter(
      (key) => typeof (client as any)[key] === 'object' && (client as any)[key].findMany !== undefined
    );

    const backupData: Record<string, any[]> = {};

    for (const model of models) {
      const data = await (client as any)[model].findMany();
      backupData[model] = data;
    }

    await saveJson(backupPath, backupData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const restore = async (client: PrismaClient, backupPath: string): Promise<QueryResult<void>> => {
  try {
    const backupData = await loadJson(backupPath);

    await client.$transaction(
      Object.entries(backupData).map(([model, data]) => {
        if (Array.isArray(data) && data.length > 0) {
          return (client as any)[model].createMany({
            data,
            skipDuplicates: true,
          });
        }
      })
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

export { connect, disconnect, executeQuery, executeTransaction, backup, restore };
