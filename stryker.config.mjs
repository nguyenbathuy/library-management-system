// Mutation testing (Stryker) cho hai module trọng tâm: quy tắc phạt/hạn trả và xác thực.
// Chạy: npm run test:mutation  — dùng runner unit (vitest.backend.config.ts, scope mặc định "all").
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.backend.config.ts' },
  mutate: ['server/src/utils/loanRules.ts', 'server/src/controllers/authController.ts'],
  coverageAnalysis: 'perTest',
  concurrency: 4,
  timeoutMS: 20000,
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'test-results/mutation/mutation-report.html' },
  jsonReporter: { fileName: 'test-results/mutation/mutation-report.json' },
  tempDirName: '.stryker-tmp',
  ignorePatterns: ['docs', 'test-results', 'dist', 'e2e', 'public', 'guidelines', 'server/public', 'server/prisma/backups', 'artifacts', 'playwright-report'],
};
