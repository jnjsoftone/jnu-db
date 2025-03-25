const { Client } = require('pg');
require('dotenv').config();

// 환경 변수 확인
console.log('PostgreSQL 환경 변수 확인:');
console.log('POSTGRES_HOST:', process.env.POSTGRES_HOST);
console.log('POSTGRES_USER:', process.env.POSTGRES_USER);
console.log('POSTGRES_PASSWORD:', process.env.POSTGRES_PASSWORD);
console.log('POSTGRES_DATABASE:', process.env.POSTGRES_DATABASE);
console.log('POSTGRES_PORT:', process.env.POSTGRES_PORT);

console.log('PostgreSQL 연결 시도 중...');

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  // 연결 타임아웃 설정
  connectionTimeoutMillis: 5000,
});

// 오류 처리 추가
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client
  .connect()
  .then(async () => {
    console.log('PostgreSQL 연결 성공');
    try {
      // 테이블 생성 시도
      await client.query('DROP TABLE IF EXISTS pg_test_table CASCADE');
      console.log('테이블 삭제 성공');

      await client.query(`
        CREATE TABLE pg_test_table (
          id INT PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        )
      `);
      console.log('테이블 생성 성공');

      // 데이터 삽입 시도
      await client.query('INSERT INTO pg_test_table (id, name) VALUES ($1, $2)', [1, '테스트']);
      console.log('데이터 삽입 성공');

      // 데이터 조회 시도
      const { rows } = await client.query('SELECT * FROM pg_test_table');
      console.log('조회 결과:', rows);
    } catch (err) {
      console.error('쿼리 실행 실패:', err);
    } finally {
      client.end();
      console.log('PostgreSQL 연결 종료');
    }
  })
  .catch((err) => {
    console.error('PostgreSQL 연결 실패:', err);
  });
