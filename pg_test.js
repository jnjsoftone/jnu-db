const { Client } = require('pg');
require('dotenv').config();

console.log('PostgreSQL 연결 정보:');
console.log({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
});

client
  .connect()
  .then(async () => {
    console.log('PostgreSQL 연결 성공');
    try {
      // 테이블 생성 시도
      await client.query('DROP TABLE IF EXISTS pg_test_table CASCADE');
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
    }
  })
  .catch((err) => {
    console.error('PostgreSQL 연결 실패:', err);
  });
