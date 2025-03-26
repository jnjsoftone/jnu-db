import { MongoClient, Db, Collection, Document, OptionalUnlessRequiredId, Filter, WithId } from 'mongodb';
import { saveJson, loadJson } from 'jnu-abc';

interface MongoConfig {
  url: string;
  dbName: string;
}

interface QueryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const connect = async (config: MongoConfig): Promise<{ client: MongoClient; db: Db } | null> => {
  try {
    const client = new MongoClient(config.url);
    await client.connect();
    const db = client.db(config.dbName);
    return { client, db };
  } catch (error) {
    console.error('MongoDB 연결 오류:', error);
    return null;
  }
};

const disconnect = async (client: MongoClient): Promise<void> => {
  try {
    await client.close();
  } catch (error) {
    console.error('MongoDB 연결 해제 오류:', error);
  }
};

const executeQuery = async <T extends Document>(
  db: Db,
  collectionName: string,
  query: Filter<T>,
  options: any = {}
): Promise<QueryResult<T[]>> => {
  try {
    const collection = db.collection<T>(collectionName);
    const result = await collection.find(query, options).toArray();
    return { success: true, data: result as T[] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const executeTransaction = async <T extends Document>(
  db: Db,
  client: MongoClient,
  operations: {
    collection: string;
    operation: 'insert' | 'update' | 'delete';
    query: Document;
    update?: Document;
    options?: any;
  }[]
): Promise<QueryResult<any[]>> => {
  const session = client.startSession();
  try {
    const results: any[] = [];
    await session.withTransaction(async () => {
      for (const op of operations) {
        const collection = db.collection<T>(op.collection);
        let result;

        switch (op.operation) {
          case 'insert':
            result = await collection.insertOne(op.query as OptionalUnlessRequiredId<T>, { session });
            break;
          case 'update':
            result = await collection.updateOne(op.query as Filter<T>, op.update!, { session });
            break;
          case 'delete':
            result = await collection.deleteOne(op.query as Filter<T>, { session });
            break;
        }

        if (result) {
          results.push(result);
        }
      }
    });
    return { success: true, data: results };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  } finally {
    await session.endSession();
  }
};

const backup = async (db: Db, backupPath: string): Promise<QueryResult<void>> => {
  try {
    const collections = await db.listCollections().toArray();
    const backupData: Record<string, any[]> = {};

    for (const collection of collections) {
      const collectionName = collection.name;
      const data = await db.collection(collectionName).find({}).toArray();
      backupData[collectionName] = data;
    }

    await saveJson(backupPath, backupData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
};

const restore = async (db: Db, client: MongoClient, backupPath: string): Promise<QueryResult<void>> => {
  const session = client.startSession();
  try {
    const backupData = await loadJson(backupPath);

    await session.withTransaction(async () => {
      for (const [collectionName, data] of Object.entries(backupData)) {
        if (Array.isArray(data) && data.length > 0) {
          const collection = db.collection(collectionName);
          await collection.insertMany(data, { session });
        }
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  } finally {
    await session.endSession();
  }
};

export { connect, disconnect, executeQuery, executeTransaction, backup, restore };
