# 기술 요구사항 정의서
## JNU-DB: 다중 데이터베이스 통합 라이브러리

### 📋 문서 정보
- **문서 유형**: 기술 요구사항 정의서 (TRD)
- **버전**: 1.0
- **최종 업데이트**: 2025-08-30
- **대상 독자**: 개발자, 아키텍트, DevOps 엔지니어

---

## 1. 시스템 아키텍처

### 1.1 전체 시스템 구조
```
JNU-DB Library
├── Connection Management Layer
│   ├── SQLite File Connection
│   ├── MySQL Pool Connection
│   ├── PostgreSQL Client Connection
│   ├── MongoDB Connection
│   ├── PocketBase Client
│   └── Prisma Client
├── Query Execution Layer
│   ├── SQL Query Engine
│   ├── NoSQL Query Engine
│   ├── ORM Query Engine
│   └── Transaction Manager
├── Data Migration Layer
│   ├── Schema Mapper
│   ├── Data Transformer
│   ├── Batch Processor
│   └── Integrity Validator
├── Schema Management Layer
│   ├── Schema Generator
│   ├── Migration Scripts
│   ├── Version Control
│   └── Validation Engine
└── Utility Layer
    ├── Backup System
    ├── Restore System
    ├── Configuration Manager
    └── Error Handler
```

### 1.2 모듈 설계

#### SQLite 통합 모듈 (`src/sqlite.ts`)
- **목적**: SQLite 파일 기반 데이터베이스 관리
- **책임**: 파일 연결, 쿼리 실행, 백업/복원
- **의존성**: sqlite3 패키지

#### MySQL 통합 모듈 (`src/mysql.ts`)
- **목적**: MySQL 관계형 데이터베이스 관리
- **책임**: 연결 풀, 트랜잭션, 스키마 관리
- **의존성**: mysql2 패키지

#### PostgreSQL 통합 모듈 (`src/postgresql.ts`)
- **목적**: PostgreSQL 고급 관계형 데이터베이스 관리
- **책임**: 클라이언트 연결, 고급 쿼리, JSON 지원
- **의존성**: pg 패키지

---

## 2. 데이터베이스별 통합 세부사항

### 2.1 SQLite 통합 아키텍처

#### 연결 관리
```typescript
interface SqliteConfig {
  filename: string;
  mode?: number;
  verbose?: boolean;
}

const createConnection = (config: SqliteConfig): Database => {
  return new sqlite3.Database(config.filename, config.mode || sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
};
```

#### 쿼리 실행 패턴
```typescript
const executeQuery = async <T>(
  connection: Database, 
  query: string, 
  params?: any[]
): Promise<QueryResult<T>> => {
  return new Promise((resolve) => {
    connection.all(query, params, (err, rows) => {
      if (err) {
        resolve({ success: false, error: err });
      } else {
        resolve({ success: true, data: rows as T });
      }
    });
  });
};
```

### 2.2 MySQL 통합 아키텍처

#### 연결 풀 관리
```typescript
interface MySqlConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
  connectionLimit?: number;
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
```

#### 트랜잭션 시스템
```typescript
const executeTransaction = async (
  connection: Connection, 
  queries: TransactionQuery[]
): Promise<TransactionResult> => {
  await connection.beginTransaction();
  
  try {
    const results = [];
    for (const query of queries) {
      const [result] = await connection.execute(query.query, query.params || []);
      results.push(result);
    }
    
    await connection.commit();
    return { success: true, data: results };
  } catch (error) {
    await connection.rollback();
    return { success: false, error: error as Error };
  }
};
```

### 2.3 PostgreSQL 통합 아키텍처

#### 클라이언트 연결
```typescript
interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

const connect = async (config: PostgresConfig): Promise<Client> => {
  const client = new Client(config);
  await client.connect();
  return client;
};
```

---

## 3. 데이터 마이그레이션 시스템

### 3.1 마이그레이션 아키텍처

#### 데이터베이스 간 마이그레이션 흐름
```
Source DB Schema Analysis
    ↓
Target DB Schema Mapping
    ↓
Data Type Conversion Rules
    ↓
Batch Data Extraction
    ↓
Data Transformation
    ↓
Target DB Data Insertion
    ↓
Integrity Validation
```

#### 마이그레이션 엔진
```typescript
interface MigrationOptions {
  sourceDb: DatabaseConnection;
  targetDb: DatabaseConnection;
  tables?: string[];
  batchSize?: number;
  transformRules?: TransformRule[];
}

interface DatabaseConnection {
  type: 'sqlite' | 'postgres' | 'mysql';
  connection: SQLiteDatabase | PostgresClient | MySQLConnection;
}
```

### 3.2 스키마 매핑 시스템

#### 데이터 타입 변환
```typescript
const typeMapping = {
  sqlite_to_mysql: {
    'INTEGER': 'INT',
    'TEXT': 'VARCHAR(255)',
    'REAL': 'DECIMAL(10,2)',
    'BLOB': 'LONGBLOB'
  },
  mysql_to_postgres: {
    'INT': 'INTEGER',
    'VARCHAR': 'TEXT',
    'DECIMAL': 'NUMERIC',
    'LONGBLOB': 'BYTEA'
  },
  postgres_to_sqlite: {
    'INTEGER': 'INTEGER',
    'TEXT': 'TEXT',
    'NUMERIC': 'REAL',
    'BYTEA': 'BLOB'
  }
};
```

### 3.3 배치 처리 시스템
```typescript
const migrateTable = async (
  sourceDb: DatabaseConnection,
  targetDb: DatabaseConnection,
  tableName: string,
  batchSize: number = 1000
): Promise<{ rows: number; error?: Error }> => {
  const columns = await getTableSchema(sourceDb, tableName);
  let offset = 0;
  let totalRows = 0;
  
  while (true) {
    const data = await getTableData(sourceDb, tableName, columns, offset, batchSize);
    if (data.length === 0) break;
    
    const success = await insertTableData(targetDb, tableName, columns, data);
    if (!success) {
      throw new Error(`테이블 ${tableName}의 데이터 삽입 중 오류`);
    }
    
    totalRows += data.length;
    offset += batchSize;
  }
  
  return { rows: totalRows };
};
```

---

## 4. 스키마 관리 시스템

### 4.1 스키마 관리 아키텍처

#### 스키마 메니저 인터페이스
```typescript
interface SchemaManager {
  generateSchema(tableName: string): Promise<string>;
  createTable(schema: TableSchema[]): Promise<boolean>;
  dropTable(tableName: string): Promise<boolean>;
  alterTable(tableName: string, changes: SchemaChange[]): Promise<boolean>;
  validateSchema(schema: TableSchema[]): Promise<ValidationResult>;
}
```

#### 테이블 스키마 정의
```typescript
interface TableSchema {
  table_name: string;
  column_name: string;
  data_type: string;
  length?: number;
  precision?: number;
  scale?: number;
  is_nullable: boolean;
  is_primary: boolean;
  is_unique: boolean;
  is_foreign: boolean;
  foreign_table?: string;
  foreign_column?: string;
  default_value?: string;
  auto_increment: boolean;
  description: string;
  validation?: string;
  example?: string;
}
```

### 4.2 스키마 생성 엔진

#### SQLite 스키마 생성
```sql
CREATE TABLE IF NOT EXISTS {table_name} (
  {column_name} {data_type} {constraints},
  PRIMARY KEY ({primary_columns}),
  FOREIGN KEY ({foreign_column}) REFERENCES {foreign_table}({foreign_column})
);
```

#### MySQL 스키마 생성
```sql
CREATE TABLE IF NOT EXISTS {table_name} (
  {column_name} {data_type}({length}) {null_constraint} {auto_increment},
  PRIMARY KEY ({primary_columns}),
  FOREIGN KEY ({foreign_column}) REFERENCES {foreign_table}({foreign_column})
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### PostgreSQL 스키마 생성
```sql
CREATE TABLE IF NOT EXISTS {table_name} (
  {column_name} {data_type} {constraints},
  PRIMARY KEY ({primary_columns}),
  FOREIGN KEY ({foreign_column}) REFERENCES {foreign_table}({foreign_column})
);
```

---

## 5. 백업 및 복원 시스템

### 5.1 백업 아키텍처

#### 백업 전략
- **풀 백업**: 전체 데이터베이스 백업
- **테이블 백업**: 특정 테이블만 백업
- **증분 백업**: 변경된 데이터만 백업 (향후)
- **스트리밍 백업**: 대용량 데이터 스트림 처리

#### 백업 형식
```typescript
interface BackupFormat {
  json: {
    structure: 'flat' | 'nested';
    compression: boolean;
    metadata: boolean;
  };
  sql: {
    includeSchema: boolean;
    includeData: boolean;
    compatibility: 'mysql' | 'postgres' | 'sqlite';
  };
}
```

### 5.2 복원 시스템

#### 복원 검증
```typescript
const validateRestore = async (
  connection: DatabaseConnection,
  originalData: any,
  restoredData: any
): Promise<boolean> => {
  // 데이터 무결성 검사
  const originalHash = generateDataHash(originalData);
  const restoredHash = generateDataHash(restoredData);
  
  return originalHash === restoredHash;
};
```

---

## 6. 성능 최적화

### 6.1 연결 풀 최적화

#### MySQL 연결 풀 설정
```typescript
const optimizedPoolConfig = {
  connectionLimit: 100,
  idleTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4'
};
```

#### PostgreSQL 연결 최적화
```typescript
const postgresConfig = {
  max: 50,                    // 최대 연결 수
  idleTimeoutMillis: 30000,   // 유휴 시간 제한
  connectionTimeoutMillis: 2000,  // 연결 시간 제한
  statement_timeout: 30000,   // 쿼리 시간 제한
};
```

### 6.2 쿼리 최적화

#### 배치 처리 최적화
```typescript
const batchInsert = async (
  connection: DatabaseConnection,
  tableName: string,
  data: any[],
  batchSize: number = 1000
): Promise<boolean> => {
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const success = await insertBatch(connection, tableName, batch);
    if (!success) return false;
  }
  
  return true;
};
```

### 6.3 메모리 관리
- **스트리밍**: 대용량 데이터 스트림 처리
- **페이지네이션**: 메모리 효율적인 데이터 로딩
- **가비지 컬렉션**: 사용 후 연결 정리
- **캐싱**: 자주 사용하는 스키마 정보 캐시

---

## 7. 오류 처리 및 복구

### 7.1 오류 분류 시스템
```typescript
enum DatabaseErrorType {
  CONNECTION = 'connection',
  QUERY = 'query',
  TRANSACTION = 'transaction',
  MIGRATION = 'migration',
  SCHEMA = 'schema',
  BACKUP = 'backup'
}

interface DatabaseError {
  type: DatabaseErrorType;
  database: string;
  message: string;
  code?: string | number;
  retryable: boolean;
  context?: {
    table?: string;
    query?: string;
    operation?: string;
  };
  originalError?: Error;
}
```

### 7.2 복구 전략

#### 연결 복구
- **자동 재연결**: 연결 실패 시 지수 백오프 재시도
- **헬스 체크**: 주기적 연결 상태 확인
- **풀 복구**: 연결 풀 자동 재생성

#### 트랜잭션 복구
- **롤백**: 트랜잭션 실패 시 자동 롤백
- **체크포인트**: 중간 저장점 지원
- **재시도**: 일시적 실패에 대한 자동 재시도

---

## 8. 보안 및 컴플라이언스

### 8.1 데이터 보안
```typescript
interface SecurityConfig {
  encryption: {
    at_rest: boolean;
    in_transit: boolean;
    algorithm: string;
  };
  access_control: {
    rbac: boolean;
    audit_logging: boolean;
    session_timeout: number;
  };
  compliance: {
    gdpr: boolean;
    hipaa: boolean;
    pci_dss: boolean;
  };
}
```

### 8.2 감사 시스템
```typescript
interface AuditLog {
  timestamp: string;
  user_id?: string;
  operation: string;
  table_name?: string;
  affected_rows: number;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}
```

---

## 9. 환경 구성 및 설정

### 9.1 환경 변수 관리
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

# PostgreSQL 설정
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=username
POSTGRES_PASSWORD=password
POSTGRES_DATABASE=dbname

# MongoDB 설정
MONGODB_URI=mongodb://localhost:27017/dbname

# PocketBase 설정
POCKETBASE_URL=http://localhost:8090
POCKETBASE_ADMIN_EMAIL=admin@example.com
POCKETBASE_ADMIN_PASSWORD=password

# Prisma 설정
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
```

### 9.2 설정 검증
```typescript
const validateConfig = (config: DBConfig): boolean => {
  const requiredFields = {
    mysql: ['host', 'user', 'password', 'database'],
    postgres: ['host', 'user', 'password', 'database'],
    sqlite: ['filename']
  };
  
  for (const [dbType, fields] of Object.entries(requiredFields)) {
    if (config[dbType]) {
      for (const field of fields) {
        if (!config[dbType][field]) {
          throw new Error(`${dbType}.${field} 설정이 누락되었습니다`);
        }
      }
    }
  }
  
  return true;
};
```

---

## 10. 모니터링 및 로깅

### 10.1 성능 메트릭
```typescript
interface PerformanceMetrics {
  query_metrics: {
    total_queries: number;
    average_response_time: number;
    slow_queries: number;
    failed_queries: number;
  };
  connection_metrics: {
    active_connections: number;
    peak_connections: number;
    connection_failures: number;
    pool_utilization: number;
  };
  migration_metrics: {
    rows_migrated: number;
    migration_speed: number;
    error_rate: number;
    rollback_count: number;
  };
}
```

### 10.2 헬스 체크 시스템
```typescript
const healthCheck = async (connections: DatabaseConnection[]): Promise<HealthReport> => {
  const results = await Promise.allSettled(
    connections.map(async (db) => {
      const startTime = Date.now();
      const result = await executeQuery(db, 'SELECT 1 as test');
      const responseTime = Date.now() - startTime;
      
      return {
        database: db.type,
        status: result.success ? 'healthy' : 'unhealthy',
        response_time: responseTime,
        error: result.error?.message
      };
    })
  );
  
  return {
    overall_status: results.every(r => r.status === 'fulfilled') ? 'healthy' : 'degraded',
    databases: results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean)
  };
};
```

---

## 11. 데이터 품질 및 검증

### 11.1 데이터 검증 시스템
```typescript
interface ValidationRule {
  column: string;
  type: 'required' | 'format' | 'range' | 'unique';
  constraint: any;
  message: string;
}

const validateData = async (
  data: any[],
  rules: ValidationRule[]
): Promise<ValidationResult> => {
  const errors: ValidationError[] = [];
  
  data.forEach((row, index) => {
    rules.forEach(rule => {
      const value = row[rule.column];
      
      switch (rule.type) {
        case 'required':
          if (!value) {
            errors.push({
              row: index,
              column: rule.column,
              message: rule.message,
              value
            });
          }
          break;
        case 'format':
          if (value && !rule.constraint.test(value)) {
            errors.push({
              row: index,
              column: rule.column,
              message: rule.message,
              value
            });
          }
          break;
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors,
    total_rows: data.length,
    valid_rows: data.length - errors.length
  };
};
```

### 11.2 무결성 검증
```typescript
const verifyMigration = async (
  sourceDb: DatabaseConnection,
  targetDb: DatabaseConnection,
  tableName: string
): Promise<IntegrityReport> => {
  // 행 수 비교
  const sourceCount = await getRowCount(sourceDb, tableName);
  const targetCount = await getRowCount(targetDb, tableName);
  
  // 체크섬 비교
  const sourceChecksum = await calculateChecksum(sourceDb, tableName);
  const targetChecksum = await calculateChecksum(targetDb, tableName);
  
  return {
    table_name: tableName,
    row_count_match: sourceCount === targetCount,
    checksum_match: sourceChecksum === targetChecksum,
    source_rows: sourceCount,
    target_rows: targetCount,
    integrity_score: (sourceCount === targetCount && sourceChecksum === targetChecksum) ? 1.0 : 0.0
  };
};
```

---

## 12. 배포 및 운영

### 12.1 빌드 시스템
- **컴파일러**: SWC (고속 TypeScript 컴파일)
- **출력 형식**: CommonJS, ES Modules, TypeScript 선언 파일
- **번들 크기**: 최적화된 크기 (<2MB)
- **의존성**: 각 데이터베이스 드라이버는 선택적 의존성

### 12.2 배포 전략
```bash
# 빌드 및 테스트
npm run build
npm run test:coverage

# 데이터베이스 설정 테스트
npm run setup:db

# 패키지 배포
npm publish
```

### 12.3 운영 모니터링
- **연결 상태**: 실시간 데이터베이스 연결 상태 모니터링
- **성능 추적**: 쿼리 성능 및 마이그레이션 속도 메트릭
- **오류 알림**: 연결 실패 및 쿼리 오류 즉시 알림
- **용량 관리**: 데이터베이스 저장 공간 모니터링

---

*문서 버전: 1.0*  
*최종 업데이트: 2025-08-30*  
*다음 검토: 2025-09-30*