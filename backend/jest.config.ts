import type { Config } from 'jest';

/**
 * Unit-test configuration (e2e config arrives with Phase 1 modules).
 *
 * `passWithNoTests: true` (mirrored by the package.json `test` script's
 * `--passWithNoTests` flag) keeps CI green until the first .spec.ts lands —
 * the foundation deliberately ships no tests because it ships no logic.
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
  },
  passWithNoTests: true,
  clearMocks: true,
};

export default config;
