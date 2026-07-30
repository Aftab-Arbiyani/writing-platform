/**
 * NestJS ESLint preset: base + Node globals + decorator-pattern relaxations.
 * Every relaxation below exists because of Nest's decorator/DI programming
 * model — do not copy them into non-Nest packages.
 */
import globals from 'globals';
import base from './base.mjs';

export default [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Relaxed: Nest `@Module()` classes are intentionally empty shells that
      // exist only to carry decorator metadata — not the anti-pattern this
      // rule targets.
      '@typescript-eslint/no-extraneous-class': 'off',
      // Relaxed: `emitDecoratorMetadata` requires runtime (value) imports for
      // constructor-injected classes; forcing `import type` erases the token
      // and silently breaks Nest dependency injection.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
