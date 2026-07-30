import type { Config } from 'jest';

/**
 * Unit/integration test configuration (e2e uses test/jest-e2e.json).
 *
 * `passWithNoTests: true` keeps CI green even if a package has no specs yet.
 *
 * `@qalam/*` packages ship ESM-only dist; Jest's CommonJS runtime can't require
 * them, so we map them to source and let ts-jest compile them (the `.js`
 * specifier strip resolves the packages' ESM-style `./x.js` imports to `.ts`).
 * This also means tests exercise the current package source, no rebuild needed.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // Keep in sync with the "@/*" path alias in tsconfig.json.
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@qalam/shared$': '<rootDir>/../packages/shared/src/index.ts',
    '^@qalam/utils$': '<rootDir>/../packages/utils/src/index.ts',
    // Resolve ESM-style ".js" specifiers inside mapped package source to ".ts".
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  passWithNoTests: true,
  clearMocks: true,
};

export default config;
