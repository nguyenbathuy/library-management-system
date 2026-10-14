import { defineConfig, devices } from '@playwright/test';

// E2E chạy trên hệ thống thật: Vite (5173) + backend Express thật (5000) với DB SQLite tạm e2e/.tmp/e2e.db.
// Không dùng `npm run dev` vì lệnh đó nối vào server/prisma/dev.db. Các spec chia sẻ một server/DB nên
// chạy tuần tự (workers: 1) và không retry (retry sẽ chạy lại trên dữ liệu đã bị ca trước thay đổi).
export default defineConfig({
  testDir: 'e2e/specs',
  outputDir: 'test-results/e2e/artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test-results/e2e/playwright-report' }],
    ['json', { outputFile: 'test-results/e2e/playwright-results.json' }],
  ],
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // retries = 0 nên 'on-first-retry' sẽ không bao giờ ghi; giữ trace cho mọi ca thất bại.
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'node e2e/support/start-server.mjs',
      url: 'http://localhost:5000/',
      reuseExistingServer: false, // không bao giờ dùng lại server dev đang nối dev.db
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
