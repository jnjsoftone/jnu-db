// CSV 형식의 테이블 정보를 위한 인터페이스
export interface TableSchema {
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

// 데이터베이스 설정 인터페이스
export interface DBConfig {
  pg: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
  mysql: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
  sqlite: {
    filename: string;
  };
}

// 테이블 생성을 위한 설정 인터페이스
export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}
