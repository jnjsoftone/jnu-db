/* eslint-disable */
import type { Config } from 'jest';
import { defaults } from 'ts-jest/presets';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/tests/'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
        diagnostics: {
          warnOnly: true,
          ignoreCodes: [
            'TS2345', // Argument of type 'X' is not assignable to parameter of type 'Y'
            'TS2322', // Type 'X' is not assignable to type 'Y'
            'TS2339', // Property 'X' does not exist on type 'Y'
            'TS2769', // No overload matches this call
            'TS2554', // Expected 0-1 arguments, but got 2
            'TS2571', // Object is of type 'unknown'
          ],
        },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testRegex: '(/tests/.*\\.(test|spec))\\.(ts|tsx|js)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

export default config;
