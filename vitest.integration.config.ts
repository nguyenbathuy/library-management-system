import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Integration/API runner: supertest → Express routers → controllers → Prisma → disposable SQLite
// under server/tests/tmp (never server/prisma/dev.db). Includes the API fuzz property (P5).
const runDirectory = resolve(process.env.LMS_IT_RUN_DIR ?? 'artifacts/qa/integration/latest');
mkdirSync(runDirectory, { recursive: true });

export default defineConfig({
  test: {
    name: 'library-integration',
    environment: 'node',
    include: ['server/tests/integration/**/*.test.ts', 'server/tests/property/api/**/*.test.ts'],
    globalSetup: ['server/tests/setup/integrationGlobal.ts'],
    setupFiles: ['server/tests/setup/integrationDb.ts'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    testTimeout: 120000,
    hookTimeout: 60000,
    retry: 0,
    env: {
      JWT_SECRET: 'integration-test-secret-never-used-for-real-tokens',
      LMS_IT_RUN_DIR: runDirectory,
      TZ: 'Asia/Ho_Chi_Minh',
      CHECKPOINT_DISABLE: '1',
    },
    reporters: ['verbose', 'json'],
    outputFile: { json: resolve(runDirectory, 'vitest-results.json') },
    coverage: {
      provider: 'v8',
      include: [
        'server/src/controllers/**',
        'server/src/middleware/**',
        'server/src/services/**',
        'server/src/utils/**',
        'server/src/routes/**',
      ],
      exclude: ['**/node_modules/**', 'server/tests/**'],
      reporter: ['text', 'html', 'json-summary', 'json', 'lcov'],
      reportsDirectory: resolve(runDirectory, 'coverage'),
      reportOnFailure: true,
    },
  },
});
