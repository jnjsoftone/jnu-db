import PocketBase from 'pocketbase';
import { saveJson, loadJson } from 'jnu-abc';

interface PocketBaseConfig {
  url: string;
  email?: string;
  password?: string;
}

interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const connect = async (config: PocketBaseConfig): Promise<PocketBase | null> => {
  try {
    const client = new PocketBase(config.url);

    if (config.email && config.password) {
      await client.admins.authWithPassword(config.email, config.password);
    }

    return client;
  } catch (error) {
    console.error('PocketBase 연결 오류:', error);
    return null;
  }
};

const disconnect = async (client: PocketBase): Promise<void> => {
  try {
    client.authStore.clear();
  } catch (error) {
    console.error('PocketBase 연결 해제 오류:', error);
  }
};

const executeQuery = async <T>(client: PocketBase, collection: string, query: any = {}): Promise<QueryResult<T[]>> => {
  try {
    const result = await client.collection(collection).getList(1, 50, query);
    return { success: true, data: result.items as T[] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const executeTransaction = async <T>(
  client: PocketBase,
  operations: {
    collection: string;
    operation: 'create' | 'update' | 'delete';
    data?: any;
    id?: string;
  }[]
): Promise<QueryResult<T[]>> => {
  try {
    const results: T[] = [];

    for (const op of operations) {
      const collection = client.collection(op.collection);
      let result;

      switch (op.operation) {
        case 'create':
          result = await collection.create(op.data);
          break;
        case 'update':
          if (!op.id) throw new Error('ID가 필요합니다');
          result = await collection.update(op.id, op.data);
          break;
        case 'delete':
          if (!op.id) throw new Error('ID가 필요합니다');
          result = await collection.delete(op.id);
          break;
      }

      if (result) {
        results.push(result as T);
      }
    }

    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const backup = async (client: PocketBase, backupPath: string): Promise<QueryResult<void>> => {
  try {
    const collections = await client.collections.getList(1, 50);
    const backupData: Record<string, any[]> = {};

    for (const collection of collections.items) {
      const result = await client.collection(collection.id).getList(1, 50);
      backupData[collection.id] = result.items;
    }

    await saveJson(backupPath, backupData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const restore = async (client: PocketBase, backupPath: string): Promise<QueryResult<void>> => {
  try {
    const backupData = await loadJson(backupPath);

    for (const [collectionId, data] of Object.entries(backupData)) {
      if (Array.isArray(data) && data.length > 0) {
        const collection = client.collection(collectionId);
        for (const item of data) {
          await collection.create(item);
        }
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

export { connect, disconnect, executeQuery, executeTransaction, backup, restore };
