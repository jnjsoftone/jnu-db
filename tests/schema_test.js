// jnu-db의 MySQL 및 PostgreSQL 스키마 관리자 사용 예제
const dotenv = require('dotenv');
const path = require('path');
const { MySqlSchemaManager, PostgresSchemaManager } = require('jnu-db');

// .env 파일 로드
// dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: '../.env' });

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

// PostgreSQL 테이블 스키마 추출
async function getAllPostgresSchemas() {
  try {
    // PostgreSQL 설정 가져오기
    const pgConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      database: process.env.POSTGRES_DATABASE || 'postgres',
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

      try {
        // schemaManager.extractSchema 메서드 사용
        const schema = await schemaManager.extractSchema(tableName);
        allSchemas[tableName] = schema;
      } catch (err) {
        console.error(`테이블 ${tableName} 스키마 추출 중 오류:`, err);
        allSchemas[tableName] = [];
      }
    }

    // 연결 종료
    await schemaManager.close();

    console.log('PostgreSQL 모든 테이블 스키마 추출 완료');
    return allSchemas;
  } catch (error) {
    console.error('PostgreSQL 스키마 추출 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트가 직접 실행될 때 스키마 추출
if (require.main === module) {
  // 실행할 데이터베이스 지정 (mysql 또는 postgres)
  const target = process.argv[2] || 'postgres'; // 기본값은 postgres

  console.log(`${target} 스키마 추출 시작...`);

  const extractFunction = target === 'mysql' ? getAllTableSchemas : getAllPostgresSchemas;

  extractFunction()
    .then((schemas) => {
      console.log(JSON.stringify(schemas, null, 2));
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
