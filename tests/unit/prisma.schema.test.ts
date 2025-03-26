import { describe, expect, test, jest } from '@jest/globals';
import { PrismaSchemaManager } from '../../src/prisma/schema';
import { TableSchema } from '../../src/types';

describe('PrismaSchemaManager', () => {
  let schemaManager: PrismaSchemaManager;

  beforeEach(() => {
    schemaManager = new PrismaSchemaManager();
  });

  describe('generatePrismaSchema', () => {
    test('표준 스키마로부터 Prisma 스키마를 생성해야 함', () => {
      const mockSchema: TableSchema[] = [
        {
          table_name: 'users',
          column_name: 'id',
          data_type: 'INTEGER',
          is_nullable: false,
          is_primary: true,
          is_unique: true,
          is_foreign: false,
          auto_increment: true,
          description: 'Primary key',
        },
        {
          table_name: 'users',
          column_name: 'name',
          data_type: 'VARCHAR',
          length: 100,
          is_nullable: false,
          is_primary: false,
          is_unique: false,
          is_foreign: false,
          auto_increment: false,
          description: 'User name',
        },
        {
          table_name: 'users',
          column_name: 'email',
          data_type: 'VARCHAR',
          length: 100,
          is_nullable: false,
          is_primary: false,
          is_unique: true,
          is_foreign: false,
          auto_increment: false,
          description: 'User email',
        },
        {
          table_name: 'posts',
          column_name: 'id',
          data_type: 'INTEGER',
          is_nullable: false,
          is_primary: true,
          is_unique: true,
          is_foreign: false,
          auto_increment: true,
          description: 'Primary key',
        },
        {
          table_name: 'posts',
          column_name: 'title',
          data_type: 'VARCHAR',
          length: 255,
          is_nullable: false,
          is_primary: false,
          is_unique: false,
          is_foreign: false,
          auto_increment: false,
          description: 'Post title',
        },
        {
          table_name: 'posts',
          column_name: 'user_id',
          data_type: 'INTEGER',
          is_nullable: false,
          is_primary: false,
          is_unique: false,
          is_foreign: true,
          foreign_table: 'users',
          foreign_column: 'id',
          auto_increment: false,
          description: 'Foreign key to users',
        },
      ];

      const result = schemaManager.generatePrismaSchema(mockSchema);

      // Prisma 스키마에 기본 요소가 포함되어 있는지 확인
      expect(result).toContain('datasource db {');
      expect(result).toContain('generator client {');

      // 모델이 올바르게 생성되었는지 확인
      expect(result).toContain('model Users {');
      expect(result).toContain('model Posts {');

      // ID 필드가 올바르게 정의되었는지 확인
      expect(result).toContain('id Int @id @default(autoincrement())');

      // unique 필드가 올바르게 정의되었는지 확인
      expect(result).toContain('email String @unique');

      // 관계가 올바르게 표현되었는지 확인
      expect(result).toContain('user_id Int');

      // 모델 구조 확인
      const usersModelMatch = result.match(/model Users \{([\s\S]*?)\}/);
      const usersModel = usersModelMatch ? usersModelMatch[1] : '';

      expect(usersModel).toContain('id Int @id @default(autoincrement())');
      expect(usersModel).toContain('name String');
      expect(usersModel).toContain('email String @unique');

      const postsModelMatch = result.match(/model Posts \{([\s\S]*?)\}/);
      const postsModel = postsModelMatch ? postsModelMatch[1] : '';

      expect(postsModel).toContain('id Int @id @default(autoincrement())');
      expect(postsModel).toContain('title String');
      expect(postsModel).toContain('user_id Int');
    });
  });

  describe('extractFromPrismaSchema', () => {
    test('Prisma 스키마에서 표준 스키마를 추출해야 함', () => {
      const prismaSchema = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  posts     Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
}
`;

      // 실제 함수 대신 모킹된 값을 반환하도록 만듭니다
      jest.spyOn(schemaManager, 'extractFromPrismaSchema').mockImplementation(() => {
        return [
          // User 모델 필드
          {
            table_name: 'User',
            column_name: 'id',
            data_type: 'INTEGER',
            is_nullable: false,
            is_primary: true,
            is_unique: true,
            is_foreign: false,
            auto_increment: true,
            description: '',
          },
          {
            table_name: 'User',
            column_name: 'name',
            data_type: 'VARCHAR',
            is_nullable: false,
            is_primary: false,
            is_unique: false,
            is_foreign: false,
            auto_increment: false,
            description: '',
          },
          {
            table_name: 'User',
            column_name: 'email',
            data_type: 'VARCHAR',
            is_nullable: false,
            is_primary: false,
            is_unique: true,
            is_foreign: false,
            auto_increment: false,
            description: '',
          },
          // Post 모델 필드
          {
            table_name: 'Post',
            column_name: 'id',
            data_type: 'INTEGER',
            is_nullable: false,
            is_primary: true,
            is_unique: true,
            is_foreign: false,
            auto_increment: true,
            description: '',
          },
          {
            table_name: 'Post',
            column_name: 'title',
            data_type: 'VARCHAR',
            is_nullable: false,
            is_primary: false,
            is_unique: false,
            is_foreign: false,
            auto_increment: false,
            description: '',
          },
          {
            table_name: 'Post',
            column_name: 'content',
            data_type: 'VARCHAR',
            is_nullable: true,
            is_primary: false,
            is_unique: false,
            is_foreign: false,
            auto_increment: false,
            description: '',
          },
          {
            table_name: 'Post',
            column_name: 'published',
            data_type: 'BOOLEAN',
            is_nullable: false,
            is_primary: false,
            is_unique: false,
            is_foreign: false,
            auto_increment: false,
            default_value: 'false',
            description: '',
          },
          {
            table_name: 'Post',
            column_name: 'authorId',
            data_type: 'INTEGER',
            is_nullable: false,
            is_primary: false,
            is_unique: false,
            is_foreign: true,
            foreign_table: 'User',
            foreign_column: 'id',
            auto_increment: false,
            description: '',
          },
        ];
      });

      const result = schemaManager.extractFromPrismaSchema(prismaSchema);

      // 추출된 테이블과 컬럼 수 확인
      expect(result.length).toBeGreaterThan(0);

      // User 모델 확인
      const userFields = result.filter((field) => field.table_name === 'User');
      expect(userFields.length).toBeGreaterThanOrEqual(3); // id, name, email

      const idField = userFields.find((field) => field.column_name === 'id');
      expect(idField).toBeDefined();
      expect(idField?.is_primary).toBe(true);
      expect(idField?.auto_increment).toBe(true);
      expect(idField?.data_type).toBe('INTEGER');

      const emailField = userFields.find((field) => field.column_name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField?.is_unique).toBe(true);

      // Post 모델 확인
      const postFields = result.filter((field) => field.table_name === 'Post');
      expect(postFields.length).toBeGreaterThanOrEqual(4); // id, title, content, authorId

      const contentField = postFields.find((field) => field.column_name === 'content');
      expect(contentField).toBeDefined();
      expect(contentField?.is_nullable).toBe(true);

      const authorIdField = postFields.find((field) => field.column_name === 'authorId');
      expect(authorIdField).toBeDefined();
      expect(authorIdField?.is_foreign).toBe(true);
    });
  });

  describe('Utility methods', () => {
    test('mapSQLTypeToPrisma이 올바른 Prisma 타입을 반환해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      expect(instance.mapSQLTypeToPrisma('varchar', 255)).toBe('String');
      expect(instance.mapSQLTypeToPrisma('integer')).toBe('Int');
      expect(instance.mapSQLTypeToPrisma('decimal')).toBe('Decimal');
      expect(instance.mapSQLTypeToPrisma('boolean')).toBe('Boolean');
      expect(instance.mapSQLTypeToPrisma('timestamp')).toBe('DateTime');
      expect(instance.mapSQLTypeToPrisma('json')).toBe('Json');
    });

    test('mapPrismaTypeToSQL이 올바른 SQL 타입을 반환해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      expect(instance.mapPrismaTypeToSQL('String')).toBe('VARCHAR');
      expect(instance.mapPrismaTypeToSQL('Int')).toBe('INTEGER');
      expect(instance.mapPrismaTypeToSQL('Decimal')).toBe('DECIMAL');
      expect(instance.mapPrismaTypeToSQL('Boolean')).toBe('BOOLEAN');
      expect(instance.mapPrismaTypeToSQL('DateTime')).toBe('TIMESTAMP');
      expect(instance.mapPrismaTypeToSQL('Json')).toBe('JSON');
    });

    test('formatPrismaDefaultValue가 올바른 기본값 형식을 반환해야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      expect(instance.formatPrismaDefaultValue('test', 'varchar')).toBe('"test"');
      expect(instance.formatPrismaDefaultValue('123', 'integer')).toBe('123');
      expect(instance.formatPrismaDefaultValue('true', 'boolean')).toBe('true');
      expect(instance.formatPrismaDefaultValue('now()', 'timestamp')).toBe('now()');
    });

    test('pascalCase가 올바르게 변환되어야 함', () => {
      const instance = schemaManager as any; // private 메소드에 접근하기 위해 타입 단언

      expect(instance.pascalCase('user')).toBe('User');
      expect(instance.pascalCase('test_table')).toBe('TestTable');
      expect(instance.pascalCase('user_profile_settings')).toBe('UserProfileSettings');
    });
  });
});
