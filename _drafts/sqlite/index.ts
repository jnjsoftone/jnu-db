import sqlite3 from 'sqlite3';
import { saveFile } from 'jnu-abc';
const BATCH_SIZE = 1000;

const _eqQueryFromObj = (data: any) => {
  if (!data || Object.keys(data).length === 0) {
    return { where: '', params: [] };
  }

  const conditions = Object.entries(data).map(([key, value]) => `${key} = ?`);
  const where = conditions.join(' AND ');
  const params = Object.values(data);

  return { where, params };
};

const _parseFilter = (filter: any) => {
  if (!filter) return { where: '', params: [] };

  if (typeof filter === 'string') {
    // 쉼표로 구분된 필드를 AND 조건으로 변환
    if (filter.includes(',')) {
      const fields = filter.split(',').map((field) => field.trim());
      const where = fields.map((field) => `${field} = ?`).join(' AND ');
      return { where, params: fields.map(() => '') };
    }

    // PocketBase 스타일의 필터 문자열 파싱
    const conditions = filter.split('&&').map((condition) => condition.trim());
    const parsedConditions = conditions.map((condition) => {
      const operators: any = {
        '=': '=',
        '!=': '!=',
        '>': '>',
        '>=': '>=',
        '<': '<',
        '<=': '<=',
        '~': 'LIKE',
        '!~': 'NOT LIKE',
      };

      let [field, op, value] = condition.split(/\s*(=|!=|>=|<=|>|<|~|!~)\s*/);

      if (value === undefined) {
        console.warn(`Warning: undefined value for field ${field}`);
        value = '';
      }

      value = value.replace(/^["']|["']$/g, '');

      if (op === '~' || op === '!~') {
        value = `%${value}%`;
      }

      return {
        field,
        operator: operators[op] || '=',
        value,
      };
    });

    const where = parsedConditions.map(({ field, operator }) => `${field} ${operator} ?`).join(' AND ');
    const params = parsedConditions.map(({ value }) => value);

    return { where, params };
  } else if (typeof filter === 'object') {
    const entries = Object.entries(filter);
    const where = entries.map(([key]) => `${key} = ?`).join(' AND ');
    const params = entries.map(([_, value]) => value ?? '');
    return { where, params };
  }

  return { where: '', params: [] };
};

interface SchemaProperty {
  type: string;
  format?: string;
  default?: any;
}

const _queryCreateTableFromSchema = (schema: any) => {
  return `CREATE TABLE IF NOT EXISTS ${schema.title} (
    ${Object.entries(schema.properties)
      .map(([key, prop]) => {
        let field = `${key} `;
        const typedProp = prop as SchemaProperty;

        // 데이터 타입 매핑
        if (typedProp.type === 'integer') {
          field += key === 'id' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INTEGER';
        } else if (typedProp.type === 'string') {
          if (typedProp.format === 'date-time') {
            field += 'DATETIME';
            if (typedProp.default === 'CURRENT_TIMESTAMP') {
              field += ' DEFAULT CURRENT_TIMESTAMP';
            }
          } else {
            field += 'TEXT';
          }
        } else if (typedProp.type === 'boolean') {
          field += 'BOOLEAN';
          if (typedProp.default !== undefined) {
            field += ` DEFAULT ${typedProp.default ? 1 : 0}`;
          }
        }

        // NOT NULL 제약조건 추가
        if (schema.required.includes(key)) {
          field += ' NOT NULL';
        }

        return field;
      })
      .join(',\n  ')}
  );`;
};

// * Sqlite Class
class Sqlite {
  dbName: string;
  dbPath: string;
  db: sqlite3.Database;

  constructor(dbName = 'youtube', dbDir: string = '.') {
    this.dbName = dbName;
    this.dbPath = `${dbDir}/${dbName}.db`;
    this._createDatabase(); // 데이터베이스 생성 함수 호출
    this.db = new sqlite3.Database(this.dbPath, (err: any) => {
      if (err) {
        console.error('Database opening error: ', err);
      }
    });
  }

  // 데이터베이스 파일이 존재하지 않으면 생성
  _createDatabase() {
    saveFile(this.dbPath, '');
  }

  _runQuery(query: string, params: any[] = []) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(query, params, function (this: sqlite3.RunResult, err: any) {
          if (err) {
            console.error(`=======Error running query: ${query} >> ${err.message}`);
            reject(err);
          } else {
            resolve(this);
          }
        });
      });
    });
  }

  runQuery(query: string, params: any[] = []) {
    return this._runQuery(query, params).finally(() => {
      // this.db.close()
    });
  }

  createTableFromSchema(schema: any) {
    const query = _queryCreateTableFromSchema(schema);
    return this.runQuery(query);
  }

  delete(tableName: string) {
    return this.runQuery(`DROP TABLE IF EXISTS ${tableName}`);
  }

  async findOne(tableName: string, filter: any) {
    try {
      const { where, params } = _parseFilter(filter);
      const query = `SELECT * FROM ${tableName}${where ? ` WHERE ${where}` : ''} LIMIT 1`;

      const result = new Promise((resolve, reject) => {
        this.db.get(query, params, (err: any, row: any) => {
          if (err) {
            console.error('Error finding record:', err);
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
      // this.db.close()
      return result;
    } catch (error) {
      console.error('Find operation failed:', error);
      throw error;
    }
  }

  async find(tableName: string, options: any = {}) {
    try {
      const { filter, sort, limit } = options;
      const { where, params } = _parseFilter(filter);

      let query = `SELECT * FROM ${tableName}`;
      if (where) query += ` WHERE ${where}`;
      if (sort) query += ` ORDER BY ${sort}`;
      if (limit) query += ` LIMIT ${limit}`;

      const result = new Promise((resolve, reject) => {
        this.db.all(query, params, (err: any, rows: any) => {
          if (err) {
            console.error('Error finding records:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
      // this.db.close()
      return result;
    } catch (error) {
      console.error('Find operation failed:', error);
      throw error;
    }
  }

  async _insertOne(tableName: string, data: any) {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data)
      .map(() => '?')
      .join(', ');
    const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    return this._runQuery(query, Object.values(data));
  }

  async insertOne(tableName: string, data: any) {
    const results = await this._insertOne(tableName, data);
    // this.db.close()
    return results;
  }

  async _insert(tableName: string, dataArray: any[]) {
    const columns = Object.keys(dataArray[0]).join(', ');
    const placeholders = Object.keys(dataArray[0])
      .map(() => '?')
      .join(', ');
    const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    return Promise.all(dataArray.map((data) => this._runQuery(query, Object.values(data))));
  }

  async insert(tableName: string, dataArray: any[]) {
    const results = await this._insert(tableName, dataArray);
    // this.db.close()
    return results;
  }

  async _updateOne(tableName: string, data: any, filter: any) {
    const setFields = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ');
    const { where, params: whereParams } = _parseFilter(filter);
    const query = `UPDATE ${tableName} SET ${setFields} WHERE ${where}`;
    return this._runQuery(query, [...Object.values(data), ...whereParams]);
  }

  async updateOne(tableName: string, data: any, filter: any) {
    const results = await this._updateOne(tableName, data, filter);
    // this.db.close()
    return results;
  }

  async _update(tableName: string, dataArray: any[], filter: any) {
    const setFields = Object.keys(dataArray[0])
      .map((key) => `${key} = ?`)
      .join(', ');
    const { where, params: whereParams } = _parseFilter(filter);
    const query = `UPDATE ${tableName} SET ${setFields} WHERE ${where}`;
    return Promise.all(dataArray.map((data) => this._runQuery(query, [...Object.values(data), ...whereParams])));
  }

  async update(tableName: string, dataArray: any[], filter: any) {
    const results = await this._update(tableName, dataArray, filter);
    // this.db.close()
    return results;
  }

  async existsRow(tableName: string, data: any) {
    try {
      const { where, params } = _eqQueryFromObj(data);
      const query = `SELECT EXISTS(SELECT 1 FROM ${tableName} WHERE ${where}) as exists_flag`;

      return new Promise((resolve, reject) => {
        this.db.get(query, params, (err: any, row: any) => {
          if (err) {
            console.error('Error checking existence:', err);
            reject(err);
          } else {
            resolve(row.exists_flag === 1);
          }
        });
      });
    } catch (error) {
      console.error('Exists check failed:', error);
      throw error;
    }
  }

  async _upsertOne(tableName: string, data: any, uniqueFields = '') {
    if (!data || Object.keys(data).length === 0) {
      console.error('Data is empty');
      return;
    }

    const keys = uniqueFields.split(',').map((key) => key.trim());
    const whereObj = keys.reduce((acc: { [key: string]: any }, key) => {
      acc[key] = data[key];
      return acc;
    }, {});

    if (uniqueFields == '') {
      return this._insertOne(tableName, data);
    }

    const hasRow = await this.existsRow(tableName, whereObj);
    // uniqueFields의 모든 key가 data에 있는지 확인
    const missingFields = keys.filter((field) => !(field in data));
    if (missingFields.length > 0) {
      console.error(`Missing required unique fields: ${missingFields.join(', ')}`);
      return;
    }

    if (hasRow) {
      console.log('update');
      const setFields = Object.keys(data)
        .map((key) => `${key} = ?`)
        .join(', ');
      const { where, params } = _eqQueryFromObj(whereObj);
      const query = `UPDATE ${tableName} SET ${setFields} WHERE ${where}`;
      console.log(query, [...Object.values(data), ...params]);
      return this._runQuery(query, [...Object.values(data), ...params]);
    } else {
      console.log('insert');
      return this._insertOne(tableName, data);
    }
  }

  async upsertOne(tableName: string, data: any, uniqueFields = '') {
    const results = await this._upsertOne(tableName, data, uniqueFields);
    // this.db.close()
    return results;
  }

  async upsert(tableName: string, dataArray: any[], uniqueFields: string, batchSize = BATCH_SIZE) {
    // 데이터 배열을 batchSize 크기의 청크로 나누기
    const chunks = [];
    for (let i = 0; i < dataArray.length; i += batchSize) {
      chunks.push(dataArray.slice(i, i + batchSize));
    }

    // 각 청크를 순차적으로 처리
    const results = [];
    for (const chunk of chunks) {
      console.log(`Processing batch of ${chunk.length} items...`);
      const batchResults = await Promise.all(chunk.map((data) => this._upsertOne(tableName, data, uniqueFields)));
      results.push(...batchResults);
    }

    // this.db.close()

    return results;
  }

  // close 메서드 추가
  close() {
    if (this.db) {
      this.db.close((err: any) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed.');
        }
      });
    }
  }
}

export { Sqlite };

// * * 사용 예시
// const data = { id: 1, name: 'John Doe' };
// console.log(_eqQueryFromObj(data));

// const dbName = 'youtube';
// const sqlite = new Sqlite(dbName);

// sqlite.createTableFromSchema(getSchema('subscriptions','youtube'));

// const schemas = getAllSchemas(dbName);
// // console.log(schemas);
// for (const schema of schemas) {
//   sqlite.createTableFromSchema(schema);
// }

// sqlite.createTableFromSchema(yourSchema); // 테이블 생성
// sqlite.findOne('BankAccounts', 1).then(console.log); // 특정 레코드 찾기
// sqlite.find('BankAccounts').then(console.log); // 모든 레코드 찾기
// sqlite.insertOne('BankAccounts', { accNum: '123456', userName: 'John Doe', ... }); // 단일 레코드 삽입
// sqlite.insert('BankAccounts', [{ accNum: '123456', userName: 'John Doe', ... }, { accNum: '654321', userName: 'Jane Doe', ... }]); // 다중 레코드 삽입
// sqlite.upsertOne('BankAccounts', { id: 1, accNum: '123456', userName: 'John Doe', ... }); // 단일 레코드 upsert
// sqlite.upsert('BankAccounts', [{ id: 1, accNum: '123456', userName: 'John Doe', ... }, { id: 2, accNum: '654321', userName: 'Jane Doe', ... }]); // 다중 레코드 upsert

// // * upsert
// const tableName = 'subscriptions';
// const data = {
//   userId: 'mooninlearn',
//   channelId: 'UCcfz-8gGDYJfaRHYD7kkQpw______',
//   subscriptionId: 'mooninlearn_UCcfz-8gGDYJfaRHYD7kkQpw__',
// };
// // const uniqueFields = 'userId,channelId';
// const uniqueFields = 'subscriptionId';

// // console.log(await sqlite.existsRow(tableName, data));

// await sqlite.upsertOne(tableName, data, uniqueFields);
