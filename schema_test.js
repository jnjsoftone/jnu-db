const dotenv = require('dotenv');
const path = require('path');
const { MySqlSchemaManager, PostgresSchemaManager } = require('jnu-db');

// .env 파일 로드
// dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: '../.env' });

// const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
// console.log(MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE);

// MySQL 테이블 스키마 추출
async function getAllMySqlSchemas() {
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

// MySQL 테이블 복사 생성
async function createMySqlTableCopies() {
  try {
    // 모든 스키마 추출
    console.log('MySQL 테이블 스키마 추출 시작...');
    const schemas = await getAllMySqlSchemas();
    console.log('MySQL 테이블 스키마 추출 완료. 복사본 생성 시작...');

    // MySQL 설정 가져오기
    const mysqlConfig = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'test_db',
    };

    console.log('MySQL 복사본 설정:', {
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      database: mysqlConfig.database,
    });

    // MySqlSchemaManager 인스턴스 생성
    const schemaManager = new MySqlSchemaManager(mysqlConfig);
    await schemaManager.init();

    // 각 테이블에 대해 복사본 생성
    const results = {};
    console.log(`복사할 테이블 수: ${Object.keys(schemas).length}`);

    for (const tableName in schemas) {
      const schema = schemas[tableName];
      const copyTableName = `${tableName}_copy`;

      console.log(`\n테이블 복사본 생성 중: ${copyTableName}`);

      try {
        // 기존 테이블이 있으면 삭제
        try {
          console.log(`- 기존 테이블 삭제 시도: ${copyTableName}`);
          await schemaManager.connection.execute(`DROP TABLE IF EXISTS ${copyTableName}`);
          console.log(`- 기존 테이블 삭제됨: ${copyTableName}`);
        } catch (dropErr) {
          console.error(`- 테이블 삭제 중 오류: ${copyTableName}`, dropErr);
        }

        // 스키마를 복사본 테이블명으로 수정
        console.log(`- 스키마 수정 중...`);
        const modifiedSchema = schema.map((column) => ({
          ...column,
          table_name: copyTableName,
        }));

        // 새 테이블 생성
        console.log(`- 테이블 생성 시작: ${copyTableName}`);
        await schemaManager.createTable(modifiedSchema);
        console.log(`- 테이블 구조 생성 완료: ${copyTableName}`);

        // 원본 테이블에서 데이터 복사 (필요시)
        // await schemaManager.connection.execute(`INSERT INTO ${copyTableName} SELECT * FROM ${tableName}`);

        console.log(`- 테이블 복사본 생성 완료: ${copyTableName}`);
        results[copyTableName] = '성공';
      } catch (err) {
        console.error(`- 테이블 복사본 생성 중 오류: ${copyTableName}`, err);
        results[copyTableName] = `실패: ${err.message}`;
      }
    }

    // 연결 종료
    await schemaManager.close();

    console.log('모든 MySQL 테이블 복사본 생성 완료');
    return results;
  } catch (error) {
    console.error('MySQL 테이블 복사본 생성 중 오류 발생:', error);
    throw error;
  }
}

// PostgreSQL 테이블 스키마 추출
async function getAllPostgresSchemas() {
  try {
    // PostgreSQL 설정 가져오기 (하드코딩)
    const pgConfig = {
      host: '1.231.118.217', // 하드코딩된 호스트
      port: 5433, // 하드코딩된 포트
      user: 'admin', // 하드코딩된 사용자명
      password: 'IlmacPost9)', // 하드코딩된 비밀번호
      database: 'test_db', // 하드코딩된 데이터베이스
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

// PostgreSQL 테이블 복사 생성
async function createPostgresTableCopies() {
  try {
    // 모든 스키마 추출
    console.log('PostgreSQL 테이블 스키마 추출 시작...');
    const schemas = await getAllPostgresSchemas();
    console.log('PostgreSQL 테이블 스키마 추출 완료. 복사본 생성 시작...');

    // PostgreSQL 설정 가져오기 (하드코딩)
    const pgConfig = {
      host: '1.231.118.217', // 하드코딩된 호스트
      port: 5433, // 하드코딩된 포트
      user: 'admin', // 하드코딩된 사용자명
      password: 'IlmacPost9)', // 하드코딩된 비밀번호
      database: 'test_db', // 하드코딩된 데이터베이스
    };

    console.log('PostgreSQL 복사본 설정:', {
      host: pgConfig.host,
      port: pgConfig.port,
      user: pgConfig.user,
      database: pgConfig.database,
    });

    // PostgresSchemaManager 인스턴스 생성
    const schemaManager = new PostgresSchemaManager(pgConfig);

    // 각 테이블에 대해 복사본 생성
    const results = {};
    console.log(`복사할 테이블 수: ${Object.keys(schemas).length}`);

    for (const tableName in schemas) {
      const schema = schemas[tableName];
      const copyTableName = `${tableName}_copy`;

      console.log(`\nPostgreSQL 테이블 복사본 생성 중: ${copyTableName}`);

      try {
        // 기존 테이블이 있으면 삭제
        try {
          console.log(`- 기존 PostgreSQL 테이블 삭제 시도: ${copyTableName}`);
          await schemaManager.pool.query(`DROP TABLE IF EXISTS ${copyTableName} CASCADE`);
          console.log(`- 기존 PostgreSQL 테이블 삭제됨: ${copyTableName}`);
        } catch (dropErr) {
          console.error(`- PostgreSQL 테이블 삭제 중 오류: ${copyTableName}`, dropErr);
        }

        // 스키마를 복사본 테이블명으로 수정
        console.log(`- PostgreSQL 스키마 수정 중...`);
        const modifiedSchema = schema.map((column) => ({
          ...column,
          table_name: copyTableName,
        }));

        // 새 테이블 생성
        console.log(`- PostgreSQL 테이블 생성 시작: ${copyTableName}`);
        await schemaManager.createTable(modifiedSchema);
        console.log(`- PostgreSQL 테이블 구조 생성 완료: ${copyTableName}`);

        // 원본 테이블에서 데이터 복사 (필요시)
        // await schemaManager.pool.query(`INSERT INTO ${copyTableName} SELECT * FROM ${tableName}`);

        console.log(`- PostgreSQL 테이블 복사본 생성 완료: ${copyTableName}`);
        results[copyTableName] = '성공';
      } catch (err) {
        console.error(`- PostgreSQL 테이블 복사본 생성 중 오류: ${copyTableName}`, err);
        results[copyTableName] = `실패: ${err.message}`;
      }
    }

    // 연결 종료
    await schemaManager.close();

    console.log('모든 PostgreSQL 테이블 복사본 생성 완료');
    return results;
  } catch (error) {
    console.error('PostgreSQL 테이블 복사본 생성 중 오류 발생:', error);
    throw error;
  }
}

// 스크립트가 직접 실행될 때 스키마 추출
if (require.main === module) {
  // 실행할 데이터베이스 지정 (mysql 또는 postgres)
  const target = process.argv[2] || 'postgres'; // 기본값은 postgres
  const action = process.argv[3] || 'extract'; // 기본값은 extract (extract 또는 create)

  console.log(`${target} ${action === 'create' ? '테이블 복사본 생성' : '스키마 추출'} 시작...`);

  let targetFunction;
  if (target === 'mysql') {
    targetFunction = action === 'create' ? createMySqlTableCopies : getAllMySqlSchemas;
  } else {
    targetFunction = action === 'create' ? createPostgresTableCopies : getAllPostgresSchemas;
  }

  targetFunction()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error('실행 오류:', err);
      process.exit(1);
    });
}

module.exports = {
  getAllMySqlSchemas,
  getAllPostgresSchemas,
  createMySqlTableCopies,
  createPostgresTableCopies,
};
