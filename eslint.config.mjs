// Phân tích tĩnh (static analysis) cho toàn repo: backend (server/src), test (server/tests, e2e) và frontend (src).
// Chạy: `npm run lint` (in ra màn hình) hoặc `npm run lint:report` (ghi JSON vào test-results/static-analysis/).
// Quy tắc dựa trên bộ "recommended" của ESLint + typescript-eslint; cấu hình này KHÔNG sửa mã sản phẩm.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**', 'dist/**', 'artifacts/**', 'test-results/**', 'docs/**', 'public/**', 'guidelines/**',
      'server/prisma/**', 'server/public/**', 'server/tests/tmp/**', 'e2e/.tmp/**', 'coverage/**',
      // Thành phần UI sinh sẵn (shadcn/ui): không phải mã của nhóm.
      'src/app/components/ui/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      // Mã hiện có dùng `any` ở nhiều controller; mức "warn" để thống kê chứ không chặn.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['server/**/*.{ts,mjs,cjs}', 'e2e/**/*.{ts,mjs,cjs}', '*.config.{ts,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Test: được phép `any` cho mock/phản hồi supertest; vẫn bắt lỗi thật (no-undef, no-unused-vars ở mức warn).
    files: ['server/tests/**/*.ts', 'e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
