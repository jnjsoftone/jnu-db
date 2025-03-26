// 수정된 스키마 테스트 파일
// jnu-db의 MySQL 및 PostgreSQL 스키마 관리자 사용 예제
const dotenv = require('dotenv');
const path = require('path');
const { MySqlSchemaManager, PostgresSchemaManager } = require('jnu-db');

// .env 파일 로드 - 여러 방법으로 시도
dotenv.config(); // 기본 로드
dotenv.config({ path: '.env' }); // 현재 디렉토리에서 명시적으로 로드
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // 상대 경로로 로드

// 디버깅: 환경 변수 확인
console.log('환경 변수 상태:');
console.log('POSTGRES_HOST:', process.env.POSTGRES_HOST);
console.log('POSTGRES_PORT:', process.env.POSTGRES_PORT);
console.log('POSTGRES_USER:', process.env.POSTGRES_USER);
console.log('POSTGRES_DATABASE:', process.env.POSTGRES_DATABASE);
console.log('POSTGRES_PASSWORD 설정 여부:', !!process.env.POSTGRES_PASSWORD);

// PostgreSQL 테이블 스키마 추출
async function getAllPostgresSchemas() {
  try {
    // PostgreSQL 설정 가져오기 - 하드코딩으로 설정
    const pgConfig = {
      host: '1.231.118.217',
      port: 5433,
      user: 'admin',
      password: 'IlmacPost9)',
      database: 'Bid',
    };

    console.log('PostgreSQL 설정:', {
      host: pgConfig.host,
      port: pgConfig.port,
      user: pgConfig.user,
      database: pgConfig.database,
    });

    // PostgresSchemaManager 인스턴스 생성
    const schemaManager = new PostgresSchemaManager(pgConfig);

    // 모든 테이블 목록 가져오기 (public 스키마의 테이블만)
    const result = await schemaManager.pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const tables = result.rows;
    console.log(`총 ${tables.length}개의 PostgreSQL 테이블이 발견되었습니다.`);

    // 각 테이블에 대한 스키마 추출
    const allSchemas = {};
    for (const table of tables) {
      const tableName = table.table_name;
      console.log(`PostgreSQL 테이블 스키마 추출 중: ${tableName}`);

      // 직접 구현한 쿼리 사용 (regclass 오류 해결)
      try {
        const schema = await extractPostgresSchemaFixed(schemaManager.pool, tableName);
        allSchemas[tableName] = schema;
      } catch (err) {
        console.error(`테이블 ${tableName} 스키마 추출 중 오류:`, err);
        console.error(err.stack); // 스택 트레이스 출력
        allSchemas[tableName] = [];
      }
    }

    // 연결 종료
    await schemaManager.close();

    console.log('PostgreSQL 모든 테이블 스키마 추출 완료');
    return allSchemas;
  } catch (error) {
    console.error('PostgreSQL 스키마 추출 중 오류 발생:', error);
    console.error(error.stack); // 스택 트레이스 출력
    throw error;
  }
}

// PostgreSQL 스키마 추출 함수 - regclass 타입 변환 오류 수정
async function extractPostgresSchemaFixed(pool, tableName) {
  try {
    console.log(`${tableName} 테이블에 대한 스키마 추출 시작...`);
    // 컬럼 기본 정보 조회
    const columnsResult = await pool.query(
      `
      SELECT 
        c.column_name,
        c.data_type,
        c.character_maximum_length AS length,
        c.numeric_precision AS precision,
        c.numeric_scale AS scale,
        (c.is_nullable = 'YES') AS is_nullable,
        c.column_default AS default_value,
        c.ordinal_position
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = $1
      ORDER BY c.ordinal_position
    `,
      [tableName]
    );
    console.log(`${tableName} 테이블에서 컬럼 정보 ${columnsResult.rows.length}개 조회됨`);

    // 기본 키 정보 조회
    const primaryKeysResult = await pool.query(
      `
      SELECT
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
    `,
      [tableName]
    );
    console.log(`${tableName} 테이블에서 기본 키 ${primaryKeysResult.rows.length}개 조회됨`);

    // 유니크 키 정보 조회
    const uniqueKeysResult = await pool.query(
      `
      SELECT
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
    `,
      [tableName]
    );
    console.log(`${tableName} 테이블에서 유니크 키 ${uniqueKeysResult.rows.length}개 조회됨`);

    // 외래 키 정보 조회
    const foreignKeysResult = await pool.query(
      `
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
    `,
      [tableName]
    );
    console.log(`${tableName} 테이블에서 외래 키 ${foreignKeysResult.rows.length}개 조회됨`);

    // 시퀀스 및 자동 증가 컬럼
    const autoIncrementResult = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_default LIKE 'nextval%'
    `,
      [tableName]
    );
    console.log(`${tableName} 테이블에서 자동 증가 컬럼 ${autoIncrementResult.rows.length}개 조회됨`);

    // regclass 오류 해결: 주석 정보는 생략

    // 각 필드 맵핑을 위한 조회 배열
    const primaryKeys = primaryKeysResult.rows.map((row) => row.column_name);
    const uniqueKeys = uniqueKeysResult.rows.map((row) => row.column_name);
    const foreignKeys = foreignKeysResult.rows;
    const autoIncrementColumns = autoIncrementResult.rows.map((row) => row.column_name);

    console.log(
      `테이블 ${tableName}에서 컬럼 ${columnsResult.rows.length}개, 기본키 ${primaryKeys.length}개, 외래키 ${foreignKeys.length}개 찾음`
    );

    // 첫 번째 컬럼 샘플 출력
    if (columnsResult.rows.length > 0) {
      console.log(`첫 번째 컬럼 샘플:`, columnsResult.rows[0]);
    }

    // 최종 스키마 생성
    return columnsResult.rows.map((column) => {
      // 현재 컬럼과 관련된 외래 키 찾기
      const fk = foreignKeys.find((fk) => fk.column_name === column.column_name);

      return {
        table_name: tableName,
        column_name: column.column_name,
        data_type: column.data_type,
        length: column.length ? parseInt(column.length) : undefined,
        precision: column.precision ? parseInt(column.precision) : undefined,
        scale: column.scale ? parseInt(column.scale) : undefined,
        is_nullable: column.is_nullable,
        is_primary: primaryKeys.includes(column.column_name),
        is_unique: uniqueKeys.includes(column.column_name) || primaryKeys.includes(column.column_name),
        is_foreign: !!fk,
        foreign_table: fk ? fk.foreign_table : undefined,
        foreign_column: fk ? fk.foreign_column : undefined,
        default_value: column.default_value,
        auto_increment: autoIncrementColumns.includes(column.column_name),
        description: '',
      };
    });
  } catch (error) {
    console.error('PostgreSQL 스키마 추출 함수 오류:', error);
    throw error; // 오류를 다시 던져 상세 내용 확인
  }
}

// MySQL 테이블 스키마 추출
async function getAllTableSchemas() {
  try {
    // MySQL 설정 가져오기
    const mysqlConfig = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'test_db',
    };

    console.log('MySQL 설정:', {
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      database: mysqlConfig.database,
    });

    // MySqlSchemaManager 인스턴스 생성
    const schemaManager = new MySqlSchemaManager(mysqlConfig);
    await schemaManager.init();

    // 모든 테이블 목록 가져오기
    const [tables] = await schemaManager.connection.execute(
      `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?
    `,
      [mysqlConfig.database]
    );

    console.log(`총 ${tables.length}개의 테이블이 발견되었습니다.`);

    // 각 테이블에 대한 스키마 추출
    const allSchemas = {};
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      console.log(`테이블 스키마 추출 중: ${tableName}`);

      const schema = await schemaManager.extractSchema(tableName);
      allSchemas[tableName] = schema;
    }

    // 연결 종료
    await schemaManager.close();

    console.log('모든 테이블 스키마 추출 완료');
    return allSchemas;
  } catch (error) {
    console.error('스키마 추출 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트가 직접 실행될 때 스키마 추출
if (require.main === module) {
  // 실행할 데이터베이스 지정 (mysql 또는 postgres)
  const target = process.argv[2] || 'postgres'; // 기본값은 postgres

  console.log(`${target} 스키마 추출 시작...`);
  console.log('환경 변수 정보:');
  console.log('POSTGRES_HOST:', process.env.POSTGRES_HOST);
  console.log('POSTGRES_PORT:', process.env.POSTGRES_PORT);
  console.log('POSTGRES_USER:', process.env.POSTGRES_USER);
  console.log('POSTGRES_DATABASE:', process.env.POSTGRES_DATABASE);
  console.log('POSTGRES_PASSWORD 설정 여부:', !!process.env.POSTGRES_PASSWORD);

  const extractFunction = target === 'mysql' ? getAllTableSchemas : getAllPostgresSchemas;

  extractFunction()
    .then((schemas) => {
      // 간략히 테이블 목록만 출력
      console.log('===== 스키마 추출 결과 =====');
      for (const tableName of Object.keys(schemas)) {
        console.log(`- 테이블: ${tableName}, 컬럼 수: ${schemas[tableName].length}`);
      }

      // 첫 번째 테이블의 첫 번째 컬럼 샘플 출력
      const firstTable = Object.keys(schemas)[0];
      if (firstTable && schemas[firstTable].length > 0) {
        console.log('\n===== 샘플 컬럼 데이터 =====');
        console.log(schemas[firstTable][0]);
      }
    })
    .catch((err) => {
      console.error('실행 오류:', err);
      process.exit(1);
    });
}

module.exports = {
  getAllMySqlSchemas: getAllTableSchemas,
  getAllPostgresSchemas,
};
