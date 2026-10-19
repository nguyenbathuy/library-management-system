import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Ghi hash dev.db trước lượt E2E; global-teardown so sánh lại (bằng chứng không ghi vào DB thật).
// dev.db không được commit: trên bản clone mới file này có thể chưa tồn tại → ghi nhận "absent".
export default function globalSetup() {
  mkdirSync('test-results/e2e', { recursive: true });
  const file = 'server/prisma/dev.db';
  const sha256 = existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : 'absent';
  writeFileSync('test-results/e2e/.devdb-before', sha256);
}
