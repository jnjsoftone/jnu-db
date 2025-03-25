import dotenv from 'dotenv';
import { jest } from '@jest/globals';

// .env 파일 로드
dotenv.config();

// 테스트 타임아웃 설정
jest.setTimeout(10000);
