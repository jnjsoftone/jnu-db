const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('MySQL 연결 정보:');
console.log({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: parseInt(process.env.MYSQL_PORT || '3306'),
});

async function testMySQLConnection() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
    });

    console.log('MySQL 연결 성공');

    // 테이블 생성 시도
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('DROP TABLE IF EXISTS mysql_test_table');
    await connection.query(`
      CREATE TABLE mysql_test_table (
        id INT PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      )
    `);
    console.log('테이블 생성 성공');

    // 데이터 삽입 시도
    await connection.query('INSERT INTO mysql_test_table (id, name) VALUES (?, ?)', [1, '테스트']);
    console.log('데이터 삽입 성공');

    // 데이터 조회 시도
    const [rows] = await connection.query('SELECT * FROM mysql_test_table');
    console.log('조회 결과:', rows);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } catch (err) {
    console.error('MySQL 작업 실패:', err);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testMySQLConnection();
