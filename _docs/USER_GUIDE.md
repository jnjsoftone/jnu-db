# 사용자 가이드
## JNU-DB: 다중 데이터베이스 통합 라이브러리

### 📋 목차
1. [시작하기](#시작하기)
2. [설치 및 설정](#설치-및-설정)
3. [SQLite 사용법](#sqlite-사용법)
4. [MySQL 사용법](#mysql-사용법)
5. [PostgreSQL 사용법](#postgresql-사용법)
6. [데이터 마이그레이션](#데이터-마이그레이션)
7. [백업 및 복원](#백업-및-복원)
8. [스키마 관리](#스키마-관리)
9. [고급 사용법](#고급-사용법)
10. [모범 사례](#모범-사례)
11. [문제해결](#문제해결)

---

## 🚀 시작하기

JNU-DB는 다양한 데이터베이스 시스템을 위한 통합 TypeScript 인터페이스를 제공합니다:
- **SQLite**: 로컬 파일 기반 경량 데이터베이스
- **MySQL**: 관계형 데이터베이스 관리 시스템
- **PostgreSQL**: 고급 관계형 데이터베이스
- **MongoDB**: NoSQL 문서 데이터베이스 (계획됨)
- **PocketBase**: 실시간 백엔드 서비스 (계획됨)
- **Prisma**: 현대적 TypeScript ORM (계획됨)

### 빠른 시작
```typescript
import { sqlite, mysql, postgresql } from 'jnu-db';

// SQLite 데이터베이스 연결
const db = new sqlite3.Database('./data/app.db');
await sqlite.executeQuery(db, 'SELECT * FROM users');

// MySQL 연결
const mysqlConnection = await mysql.connect({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'testdb'
});

// 쿼리 실행
const result = await mysql.executeQuery(mysqlConnection, 'SELECT * FROM products');
```

---

## 📦 설치 및 설정

### 설치
```bash
npm install jnu-db
```

### 환경 구성
데이터베이스 설정으로 `.env` 파일을 생성하세요:

```bash
# SQLite 설정
SQLITE_DB_PATH=./data/app.db
SQLITE_MODE=READWRITE_CREATE

# MySQL 설정
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=username
MYSQL_PASSWORD=password
MYSQL_DATABASE=dbname
MYSQL_CONNECTION_LIMIT=10

# PostgreSQL 설정
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=username
POSTGRES_PASSWORD=password
POSTGRES_DATABASE=dbname

# MongoDB 설정 (향후 지원)
MONGODB_URI=mongodb://localhost:27017/dbname

# PocketBase 설정 (향후 지원)
POCKETBASE_URL=http://localhost:8090
POCKETBASE_ADMIN_EMAIL=admin@example.com
POCKETBASE_ADMIN_PASSWORD=password
```

### 디렉토리 구조 준비
```bash
# 데이터 저장 디렉토리 생성
mkdir -p ./data
mkdir -p ./backups
mkdir -p ./migrations
```

### TypeScript 설정
```typescript
// types.d.ts
declare module 'jnu-db' {
  // 더 나은 IDE 지원을 위한 타입 임포트
}
```

---

## 💾 SQLite 사용법

### SQLite 기본 연결
```typescript
import { sqlite } from 'jnu-db';
import sqlite3 from 'sqlite3';

// 데이터베이스 연결
const db = new sqlite3.Database('./data/app.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('SQLite 연결 오류:', err.message);
  } else {
    console.log('SQLite 연결 성공');
  }
});

// 쿼리 실행
const users = await sqlite.executeQuery(db, 'SELECT * FROM users WHERE active = ?', [1]);
if (users.success) {
  console.log('사용자 목록:', users.data);
} else {
  console.error('쿼리 실패:', users.error);
}
```

### SQLite 트랜잭션
```typescript
const transactionQueries = [
  {
    query: 'INSERT INTO users (name, email) VALUES (?, ?)',
    params: ['홍길동', 'hong@example.com']
  },
  {
    query: 'UPDATE accounts SET balance = balance - ? WHERE user_id = ?',
    params: [1000, 1]
  }
];

const result = await sqlite.executeTransaction(db, transactionQueries);
if (result.success) {
  console.log('트랜잭션 성공:', result.data.affectedRows);
} else {
  console.error('트랜잭션 실패:', result.error);
}
```

### SQLite 백업 및 복원
```typescript
// 백업 생성
const backupResult = await sqlite.backup(db, './backups/app_backup.json');
if (backupResult.success) {
  console.log('백업 완료');
} else {
  console.error('백업 실패:', backupResult.error);
}

// 백업 복원
const restoreResult = await sqlite.restore(db, './backups/app_backup.json');
if (restoreResult.success) {
  console.log('복원 완료');
} else {
  console.error('복원 실패:', restoreResult.error);
}
```

---

## 🐬 MySQL 사용법

### MySQL 연결 관리
```typescript
import { mysql } from 'jnu-db';

// 단일 연결
const connection = await mysql.connect({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'testdb',
  port: 3306
});

if (connection) {
  console.log('MySQL 연결 성공');
} else {
  console.error('MySQL 연결 실패');
}

// 연결 풀 생성
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'testdb',
  connectionLimit: 20
});
```

### MySQL 쿼리 실행
```typescript
// 단순 쿼리
const products = await mysql.executeQuery(
  connection, 
  'SELECT * FROM products WHERE category = ?', 
  ['electronics']
);

if (products.success) {
  console.log('제품 목록:', products.data);
} else {
  console.error('쿼리 실패:', products.error);
}

// 복잡한 JOIN 쿼리
const orderDetails = await mysql.executeQuery(connection, `
  SELECT 
    o.id, o.total, u.name, p.title
  FROM orders o
  JOIN users u ON o.user_id = u.id
  JOIN products p ON o.product_id = p.id
  WHERE o.status = ?
`, ['completed']);
```

### MySQL 트랜잭션
```typescript
const orderTransaction = [
  {
    query: 'INSERT INTO orders (user_id, product_id, quantity, total) VALUES (?, ?, ?, ?)',
    params: [1, 100, 2, 50000]
  },
  {
    query: 'UPDATE products SET stock = stock - ? WHERE id = ?',
    params: [2, 100]
  },
  {
    query: 'UPDATE users SET points = points + ? WHERE id = ?',
    params: [500, 1]
  }
];

const result = await mysql.executeTransaction(connection, orderTransaction);
if (result.success) {
  console.log('주문 처리 완료');
} else {
  console.error('주문 처리 실패:', result.error);
}
```

---

## 🐘 PostgreSQL 사용법

### PostgreSQL 연결
```typescript
import { postgresql } from 'jnu-db';

const client = await postgresql.connect({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'password'
});

if (client) {
  console.log('PostgreSQL 연결 성공');
} else {
  console.error('PostgreSQL 연결 실패');
}
```

### PostgreSQL JSON 지원
```typescript
// JSON 데이터 쿼리
const userPreferences = await postgresql.executeQuery(client, `
  SELECT 
    id, 
    name,
    preferences->>'theme' as theme,
    preferences->>'language' as language
  FROM users 
  WHERE preferences ? 'notifications'
`);

// JSON 배열 검색
const taggedPosts = await postgresql.executeQuery(client, `
  SELECT * FROM posts 
  WHERE tags @> '["javascript", "typescript"]'::jsonb
`);
```

### PostgreSQL 고급 기능
```typescript
// 전문 검색 (Full-Text Search)
const searchResults = await postgresql.executeQuery(client, `
  SELECT *, ts_rank(search_vector, query) as rank
  FROM articles, to_tsquery('korean', ?) query
  WHERE search_vector @@ query
  ORDER BY rank DESC
`, ['프로그래밍']);

// 윈도우 함수
const salesAnalysis = await postgresql.executeQuery(client, `
  SELECT 
    product_id,
    month,
    sales,
    LAG(sales, 1) OVER (PARTITION BY product_id ORDER BY month) as prev_month,
    sales - LAG(sales, 1) OVER (PARTITION BY product_id ORDER BY month) as growth
  FROM monthly_sales
  ORDER BY product_id, month
`);
```

---

## 🔄 데이터 마이그레이션

### 기본 마이그레이션
```typescript
import { migrate } from 'jnu-db';

// SQLite에서 MySQL로 마이그레이션
const sourceDb = {
  type: 'sqlite' as const,
  connection: new sqlite3.Database('./data/source.db')
};

const targetDb = {
  type: 'mysql' as const,
  connection: await mysql.connect({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'target_db'
  })
};

const migrationResult = await migrate(sourceDb, targetDb, 'users');
if (migrationResult.success) {
  console.log('마이그레이션 성공:', migrationResult.tables);
} else {
  console.error('마이그레이션 실패:', migrationResult.error);
}
```

### 대용량 데이터 마이그레이션
```typescript
class LargeMigrationManager {
  async migrateLargeTable(
    sourceDb: DatabaseConnection,
    targetDb: DatabaseConnection,
    tableName: string
  ): Promise<void> {
    const batchSize = 10000;
    let offset = 0;
    let totalMigrated = 0;
    
    console.log(`📊 ${tableName} 테이블 마이그레이션 시작`);
    
    while (true) {
      const result = await this.migrateBatch(
        sourceDb, 
        targetDb, 
        tableName, 
        offset, 
        batchSize
      );
      
      if (result.rows === 0) break;
      
      totalMigrated += result.rows;
      offset += batchSize;
      
      console.log(`진행률: ${totalMigrated} 행 완료`);
      
      // 메모리 관리를 위한 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ ${tableName} 마이그레이션 완료: ${totalMigrated} 행`);
  }
  
  private async migrateBatch(
    sourceDb: DatabaseConnection,
    targetDb: DatabaseConnection,
    tableName: string,
    offset: number,
    batchSize: number
  ): Promise<{ rows: number }> {
    // 스키마 가져오기
    const columns = await this.getTableSchema(sourceDb, tableName);
    
    // 데이터 배치 가져오기
    const data = await this.getTableData(sourceDb, tableName, columns, offset, batchSize);
    
    if (data.length === 0) {
      return { rows: 0 };
    }
    
    // 데이터 삽입
    const success = await this.insertTableData(targetDb, tableName, columns, data);
    
    if (!success) {
      throw new Error(`배치 삽입 실패: ${tableName}, offset: ${offset}`);
    }
    
    return { rows: data.length };
  }
}
```

### 스키마 자동 변환
```typescript
class SchemaConverter {
  convertSqliteToMysql(sqliteSchema: string): string {
    return sqliteSchema
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INT AUTO_INCREMENT PRIMARY KEY')
      .replace(/TEXT/g, 'VARCHAR(255)')
      .replace(/REAL/g, 'DECIMAL(10,2)')
      .replace(/BLOB/g, 'LONGBLOB');
  }
  
  convertMysqlToPostgres(mysqlSchema: string): string {
    return mysqlSchema
      .replace(/AUTO_INCREMENT/g, 'SERIAL')
      .replace(/VARCHAR\((\d+)\)/g, 'TEXT')
      .replace(/LONGBLOB/g, 'BYTEA')
      .replace(/ENGINE=InnoDB/g, '');
  }
  
  generateCreateTable(schema: TableSchema[]): string {
    const columns = schema.map(col => {
      let definition = `${col.column_name} ${col.data_type}`;
      
      if (col.length) {
        definition += `(${col.length})`;
      }
      
      if (!col.is_nullable) {
        definition += ' NOT NULL';
      }
      
      if (col.auto_increment) {
        definition += ' AUTO_INCREMENT';
      }
      
      if (col.default_value) {
        definition += ` DEFAULT ${col.default_value}`;
      }
      
      return definition;
    }).join(',\n  ');
    
    const primaryKeys = schema.filter(col => col.is_primary)
      .map(col => col.column_name);
    
    let sql = `CREATE TABLE ${schema[0].table_name} (\n  ${columns}`;
    
    if (primaryKeys.length > 0) {
      sql += `,\n  PRIMARY KEY (${primaryKeys.join(', ')})`;
    }
    
    sql += '\n);';
    return sql;
  }
}
```

---

## 🗂️ 백업 및 복원

### 데이터베이스 백업
```typescript
class DatabaseBackupManager {
  async createFullBackup(
    connection: DatabaseConnection,
    backupPath: string
  ): Promise<void> {
    console.log('📦 전체 백업 시작...');
    
    switch (connection.type) {
      case 'sqlite':
        await sqlite.backup(connection.connection, backupPath);
        break;
      case 'mysql':
        await mysql.backup(connection.connection, backupPath);
        break;
      case 'postgres':
        await postgresql.backup(connection.connection, backupPath);
        break;
    }
    
    console.log(`✅ 백업 완료: ${backupPath}`);
  }
  
  async createIncrementalBackup(
    connection: DatabaseConnection,
    lastBackupTime: Date,
    backupPath: string
  ): Promise<void> {
    // 변경된 데이터만 백업 (향후 구현)
    const changedTables = await this.getChangedTables(connection, lastBackupTime);
    
    for (const tableName of changedTables) {
      await this.backupTable(connection, tableName, `${backupPath}/${tableName}.json`);
    }
  }
  
  private async getChangedTables(
    connection: DatabaseConnection, 
    since: Date
  ): Promise<string[]> {
    // 변경된 테이블 감지 로직
    const query = `
      SELECT DISTINCT table_name 
      FROM information_schema.tables 
      WHERE update_time > ?
    `;
    
    const result = await this.executeQuery(connection, query, [since]);
    return result.success ? result.data.map(row => row.table_name) : [];
  }
}
```

### 스케줄된 백업
```typescript
class ScheduledBackupService {
  private backupInterval: NodeJS.Timeout | null = null;
  
  startBackupSchedule(connection: DatabaseConnection, intervalHours: number = 24): void {
    this.backupInterval = setInterval(async () => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `./backups/auto_backup_${timestamp}.json`;
        
        await this.performBackup(connection, backupPath);
        
        // 오래된 백업 정리 (30일 이상)
        await this.cleanupOldBackups('./backups', 30);
        
      } catch (error) {
        console.error('스케줄된 백업 실패:', error);
      }
    }, intervalHours * 60 * 60 * 1000);
    
    console.log(`📅 백업 스케줄 시작: ${intervalHours}시간마다`);
  }
  
  stopBackupSchedule(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      console.log('📅 백업 스케줄 중지');
    }
  }
  
  private async cleanupOldBackups(backupDir: string, maxDays: number): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const files = await fs.readdir(backupDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDays);
    
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        console.log(`🗑️ 오래된 백업 삭제: ${file}`);
      }
    }
  }
}
```

---

## 📋 스키마 관리

### 스키마 생성 및 관리
```typescript
import { MySqlSchemaManager, PostgresSchemaManager, SqliteSchemaManager } from 'jnu-db';

// MySQL 스키마 관리
const mysqlSchemaManager = new MySqlSchemaManager(connection);

// 테이블 스키마 정의
const userTableSchema = [
  {
    table_name: 'users',
    column_name: 'id',
    data_type: 'INT',
    is_nullable: false,
    is_primary: true,
    auto_increment: true,
    description: '사용자 고유 ID'
  },
  {
    table_name: 'users',
    column_name: 'email',
    data_type: 'VARCHAR',
    length: 255,
    is_nullable: false,
    is_unique: true,
    description: '사용자 이메일'
  },
  {
    table_name: 'users',
    column_name: 'name',
    data_type: 'VARCHAR',
    length: 100,
    is_nullable: false,
    description: '사용자 이름'
  },
  {
    table_name: 'users',
    column_name: 'created_at',
    data_type: 'TIMESTAMP',
    is_nullable: false,
    default_value: 'CURRENT_TIMESTAMP',
    description: '생성 시간'
  }
];

// 테이블 생성
const created = await mysqlSchemaManager.createTable(userTableSchema);
if (created) {
  console.log('✅ users 테이블 생성 완료');
}
```

### 스키마 마이그레이션
```typescript
class SchemaMigrationManager {
  async migrateSchema(
    fromDb: DatabaseConnection,
    toDb: DatabaseConnection,
    tableName: string
  ): Promise<void> {
    // 소스 스키마 분석
    const sourceSchema = await this.analyzeSchema(fromDb, tableName);
    
    // 타겟 DB 형식으로 변환
    const targetSchema = await this.convertSchema(sourceSchema, fromDb.type, toDb.type);
    
    // 타겟 테이블 생성
    const createTableSQL = this.generateCreateTableSQL(targetSchema, toDb.type);
    await this.executeQuery(toDb, createTableSQL);
    
    console.log(`📋 스키마 마이그레이션 완료: ${tableName}`);
  }
  
  private async analyzeSchema(
    db: DatabaseConnection, 
    tableName: string
  ): Promise<ColumnInfo[]> {
    let query = '';
    
    switch (db.type) {
      case 'sqlite':
        query = `PRAGMA table_info(${tableName})`;
        break;
      case 'mysql':
        query = `DESCRIBE ${tableName}`;
        break;
      case 'postgres':
        query = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = '${tableName}'
        `;
        break;
    }
    
    const result = await this.executeQuery(db, query);
    return result.success ? result.data : [];
  }
}
```

---

## 🛠️ 고급 사용법

### 다중 데이터베이스 동기화
```typescript
class MultiDatabaseSyncManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  
  addDatabase(name: string, connection: DatabaseConnection): void {
    this.connections.set(name, connection);
  }
  
  async syncTable(tableName: string, primaryDb: string): Promise<void> {
    const primary = this.connections.get(primaryDb);
    if (!primary) {
      throw new Error(`주 데이터베이스 '${primaryDb}'를 찾을 수 없습니다`);
    }
    
    // 주 데이터베이스에서 최신 데이터 가져오기
    const sourceData = await this.getTableData(primary, tableName);
    
    // 다른 모든 데이터베이스에 동기화
    for (const [name, db] of this.connections) {
      if (name !== primaryDb) {
        await this.syncTableToDatabase(sourceData, db, tableName);
        console.log(`✅ ${name}에 ${tableName} 동기화 완료`);
      }
    }
  }
  
  private async syncTableToDatabase(
    data: any[],
    targetDb: DatabaseConnection,
    tableName: string
  ): Promise<void> {
    // 기존 데이터 삭제
    await this.executeQuery(targetDb, `DELETE FROM ${tableName}`);
    
    // 새 데이터 삽입
    const columns = Object.keys(data[0] || {});
    await this.insertTableData(targetDb, tableName, columns, data);
  }
}
```

### 데이터베이스 성능 모니터링
```typescript
class DatabasePerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  
  async monitorQuery<T>(
    connection: DatabaseConnection,
    query: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const result = await this.executeQuery(connection, query, params);
    const duration = Date.now() - startTime;
    
    // 성능 메트릭 기록
    this.recordMetric(connection.type, {
      query,
      duration,
      success: result.success,
      timestamp: new Date()
    });
    
    // 느린 쿼리 경고
    if (duration > 1000) {
      console.warn(`⚠️ 느린 쿼리 감지 (${duration}ms): ${query.substring(0, 100)}...`);
    }
    
    return result;
  }
  
  getPerformanceReport(dbType: string): PerformanceReport {
    const metrics = this.metrics.get(dbType) || [];
    
    return {
      total_queries: metrics.length,
      average_duration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
      slow_queries: metrics.filter(m => m.duration > 1000).length,
      error_rate: metrics.filter(m => !m.success).length / metrics.length * 100
    };
  }
  
  private recordMetric(dbType: string, metric: PerformanceMetric): void {
    if (!this.metrics.has(dbType)) {
      this.metrics.set(dbType, []);
    }
    
    this.metrics.get(dbType)!.push(metric);
    
    // 메트릭은 최대 1000개까지만 유지
    if (this.metrics.get(dbType)!.length > 1000) {
      this.metrics.get(dbType)!.shift();
    }
  }
}
```

---

## ✅ 모범 사례

### 연결 관리
```typescript
class DatabaseConnectionManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  
  async getConnection(name: string): Promise<DatabaseConnection> {
    if (this.connections.has(name)) {
      return this.connections.get(name)!;
    }
    
    // 새 연결 생성
    const config = this.loadConfig(name);
    const connection = await this.createConnection(config);
    
    this.connections.set(name, connection);
    return connection;
  }
  
  async closeAllConnections(): Promise<void> {
    for (const [name, connection] of this.connections) {
      await this.closeConnection(connection);
      console.log(`🔌 ${name} 연결 종료`);
    }
    
    this.connections.clear();
  }
  
  // 프로세스 종료 시 정리
  setupGracefulShutdown(): void {
    process.on('SIGINT', async () => {
      console.log('📴 프로세스 종료 중...');
      await this.closeAllConnections();
      process.exit(0);
    });
  }
}
```

### 오류 처리 및 재시도
```typescript
class RobustDatabaseOperations {
  async executeWithRetry<T>(
    connection: DatabaseConnection,
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`시도 ${attempt}/${maxRetries} 실패:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 지수 백오프
          console.log(`⏳ ${delay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`${maxRetries}번의 시도 후 작업 실패: ${lastError.message}`);
  }
  
  async safeExecuteQuery<T>(
    connection: DatabaseConnection,
    query: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    return await this.executeWithRetry(connection, async () => {
      const result = await this.executeQuery(connection, query, params);
      
      if (!result.success) {
        throw result.error || new Error('쿼리 실행 실패');
      }
      
      return result;
    });
  }
}
```

### 데이터 검증
```typescript
class DataValidator {
  validateTableData(data: any[], schema: TableSchema[]): ValidationResult {
    const errors: ValidationError[] = [];
    
    data.forEach((row, rowIndex) => {
      schema.forEach(column => {
        const value = row[column.column_name];
        
        // 필수 필드 검사
        if (!column.is_nullable && (value === null || value === undefined)) {
          errors.push({
            row: rowIndex,
            column: column.column_name,
            error: 'required_field_missing',
            message: `필수 필드 '${column.column_name}'가 누락되었습니다`
          });
        }
        
        // 데이터 타입 검사
        if (value !== null && !this.validateDataType(value, column.data_type)) {
          errors.push({
            row: rowIndex,
            column: column.column_name,
            error: 'invalid_data_type',
            message: `잘못된 데이터 타입: 기대값 ${column.data_type}, 실제값 ${typeof value}`
          });
        }
        
        // 길이 제한 검사
        if (column.length && typeof value === 'string' && value.length > column.length) {
          errors.push({
            row: rowIndex,
            column: column.column_name,
            error: 'length_exceeded',
            message: `문자열 길이 초과: 최대 ${column.length}, 실제 ${value.length}`
          });
        }
      });
    });
    
    return {
      valid: errors.length === 0,
      errors,
      total_rows: data.length,
      valid_rows: data.length - errors.length
    };
  }
  
  private validateDataType(value: any, dataType: string): boolean {
    const normalizedType = dataType.toLowerCase();
    
    switch (normalizedType) {
      case 'int':
      case 'integer':
        return Number.isInteger(value);
      case 'varchar':
      case 'text':
        return typeof value === 'string';
      case 'decimal':
      case 'real':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return true; // 알 수 없는 타입은 통과
    }
  }
}
```

---

## 🔧 문제해결

### 일반적인 문제

#### 연결 실패
```typescript
async function troubleshootConnection(config: any, dbType: string) {
  console.log(`🔍 ${dbType} 연결 문제 진단 중...`);
  
  // 1. 네트워크 연결 확인
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    if (dbType !== 'sqlite') {
      await execAsync(`ping -c 1 ${config.host}`);
      console.log('✅ 네트워크 연결 정상');
    }
  } catch (error) {
    console.error('❌ 네트워크 연결 실패:', error.message);
    return;
  }
  
  // 2. 포트 확인
  if (config.port && dbType !== 'sqlite') {
    try {
      const net = await import('net');
      const socket = new net.Socket();
      
      await new Promise((resolve, reject) => {
        socket.setTimeout(5000);
        socket.connect(config.port, config.host, () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', reject);
      });
      
      console.log('✅ 포트 연결 정상');
    } catch (error) {
      console.error(`❌ 포트 ${config.port} 연결 실패:`, error.message);
    }
  }
  
  // 3. 인증 확인
  try {
    const connection = await this.createTestConnection(config, dbType);
    await this.closeConnection(connection);
    console.log('✅ 인증 정보 정상');
  } catch (error) {
    console.error('❌ 인증 실패:', error.message);
  }
}
```

#### 쿼리 최적화
```typescript
class QueryOptimizer {
  analyzeSlowQuery(query: string, duration: number): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    // SELECT * 사용 감지
    if (query.includes('SELECT *')) {
      suggestions.push({
        type: 'performance',
        message: 'SELECT * 대신 필요한 컬럼만 지정하세요',
        impact: 'medium'
      });
    }
    
    // JOIN 없이 WHERE IN 사용 감지
    if (query.includes('WHERE') && query.includes('IN') && !query.includes('JOIN')) {
      suggestions.push({
        type: 'performance',
        message: 'WHERE IN 대신 JOIN을 고려해보세요',
        impact: 'high'
      });
    }
    
    // ORDER BY 없는 LIMIT 감지
    if (query.includes('LIMIT') && !query.includes('ORDER BY')) {
      suggestions.push({
        type: 'correctness',
        message: 'LIMIT 사용 시 ORDER BY를 함께 사용하세요',
        impact: 'high'
      });
    }
    
    return suggestions;
  }
  
  generateOptimizedQuery(originalQuery: string): string {
    return originalQuery
      .replace(/SELECT \*/g, 'SELECT id, name, email') // 예시 최적화
      .replace(/WHERE (.+) IN \((.+)\)/g, 'JOIN ($2) AS temp ON $1 = temp.value'); // 예시 최적화
  }
}
```

#### 메모리 사용량 최적화
```typescript
async function optimizeMemoryUsage() {
  // 1. 연결 풀 크기 조정
  if (process.memoryUsage().heapUsed > 100 * 1024 * 1024) { // 100MB
    console.warn('⚠️ 높은 메모리 사용량 감지, 연결 풀 크기 축소');
    // 연결 풀 크기 축소 로직
  }
  
  // 2. 가비지 컬렉션 강제 실행
  if (global.gc) {
    global.gc();
    console.log('🧹 가비지 컬렉션 실행');
  }
  
  // 3. 캐시 정리
  await this.clearExpiredCache();
  
  // 4. 메모리 사용량 보고
  const usage = process.memoryUsage();
  console.log('💾 메모리 사용량:', {
    heap_used: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heap_total: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB'
  });
}
```

---

*최종 업데이트: 2025-08-30*  
*버전: 1.0*