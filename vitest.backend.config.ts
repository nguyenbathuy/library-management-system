import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const testIncludes = {
  all: ['server/tests/unit/auth/**/*.test.ts', 'server/tests/unit/member/**/*.test.ts'],
  authentication: ['server/tests/unit/auth/**/*.test.ts'],
  member: ['server/tests/unit/member/**/*.test.ts'],
};
const requestedScope = process.env.LMS_WB_SCOPE ?? 'all';
if (!Object.hasOwn(testIncludes, requestedScope)) {
  throw new Error(`Unknown LMS_WB_SCOPE: ${requestedScope}. Use all, authentication, or member.`);
}
const scope = requestedScope as keyof typeof testIncludes;
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
    name: `library-whitebox-${scope}`,
    environment: 'node',
    include: testIncludes[scope],
    setupFiles: ['server/tests/setup/isolation.ts'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    testTimeout: 5000,
    hookTimeout: 10000,
    retry: 0,
    env: {
      LMS_WB_SCOPE: scope,
      JWT_SECRET: 'unit-test-secret-never-used-for-real-tokens',
      LMS_WB_RUN_DIR: runDirectory,
    },
    reporters: ['verbose', 'json'],
    outputFile: { json: resolve(runDirectory, 'vitest-results.json') },
    coverage: {
      provider: 'v8',
      include: [
        'server/src/controllers/authController.ts',
        'server/src/middleware/auth.ts',
        'server/src/routes/authRoutes.ts',
      ],
      exclude: ['**/node_modules/**', 'server/tests/**'],
      reporter: ['text', 'html', 'json-summary', 'json', 'lcov'],
      reportsDirectory: resolve(runDirectory, 'coverage'),
      reportOnFailure: true,
    },
  },
});
