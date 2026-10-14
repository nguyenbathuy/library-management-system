import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit-level backend runner (no real database, no network). Integration/API tests use
// vitest.integration.config.ts; browser E2E uses playwright.config.ts.
const AUTH_TESTS = 'server/tests/unit/auth/**/*.test.ts';
const MEMBER_TESTS = 'server/tests/unit/member/**/*.test.ts';
const LOAN_TESTS = 'server/tests/unit/loan/**/*.test.ts';
const PROPERTY_TESTS = 'server/tests/property/**/*.property.test.ts';

// Coverage denominators per scope. `authentication`, `member` and `whitebox` keep the
// three-file scope used by the Chapter 4 baseline; `all` uses the module-wide scope.
const AUTH_SOURCES = [
  'server/src/controllers/authController.ts',
  'server/src/middleware/auth.ts',
  'server/src/routes/authRoutes.ts',
];
const LOAN_SOURCES = ['server/src/utils/loanRules.ts', 'server/src/controllers/loanController.ts'];
const ALL_SOURCES = [
  'server/src/controllers/**',
  'server/src/middleware/**',
  'server/src/services/**',
  'server/src/utils/**',
];

const scopes = {
  all: { include: [AUTH_TESTS, MEMBER_TESTS, LOAN_TESTS, PROPERTY_TESTS], coverage: ALL_SOURCES },
  whitebox: { include: [AUTH_TESTS, MEMBER_TESTS], coverage: AUTH_SOURCES },
  authentication: { include: [AUTH_TESTS], coverage: AUTH_SOURCES },
  member: { include: [MEMBER_TESTS], coverage: AUTH_SOURCES },
  loan: { include: [LOAN_TESTS], coverage: LOAN_SOURCES },
  property: { include: [PROPERTY_TESTS], coverage: ['server/src/utils/loanRules.ts'] },
};
const requestedScope = process.env.LMS_WB_SCOPE ?? 'all';
if (!Object.hasOwn(scopes, requestedScope)) {
  throw new Error(`Unknown LMS_WB_SCOPE: ${requestedScope}. Use ${Object.keys(scopes).join(', ')}.`);
}
const scope = requestedScope as keyof typeof scopes;
const runDirectory = resolve(
  process.env.LMS_WB_RUN_DIR ?? `artifacts/qa/whitebox/${scope}/latest`,
);
mkdirSync(runDirectory, { recursive: true });

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@prisma\/client$/,
        replacement: fileURLToPath(
          new URL('./server/tests/mocks/prismaGuard.ts', import.meta.url),
        ),
      },
    ],
  },
  test: {
    name: `library-backend-${scope}`,
    environment: 'node',
    include: scopes[scope].include,
    setupFiles: ['server/tests/setup/isolation.ts'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    testTimeout: 20000,
    hookTimeout: 10000,
    retry: 0,
    env: {
      LMS_WB_SCOPE: scope,
      JWT_SECRET: 'unit-test-secret-never-used-for-real-tokens',
      LMS_WB_RUN_DIR: runDirectory,
      // Fixed timezone so calendar arithmetic (setDate) is reproducible on any machine/CI.
      TZ: 'Asia/Ho_Chi_Minh',
    },
    reporters: ['verbose', 'json'],
    outputFile: { json: resolve(runDirectory, 'vitest-results.json') },
    coverage: {
      provider: 'v8',
      include: scopes[scope].coverage,
      exclude: ['**/node_modules/**', 'server/tests/**'],
      reporter: ['text', 'html', 'json-summary', 'json', 'lcov'],
      reportsDirectory: resolve(runDirectory, 'coverage'),
      reportOnFailure: true,
    },
  },
});
