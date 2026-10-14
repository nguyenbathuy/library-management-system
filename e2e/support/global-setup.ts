import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Ghi hash dev.db trước lượt E2E; global-teardown so sánh lại (bằng chứng không ghi vào DB thật).
export default function globalSetup() {
  mkdirSync('test-results/e2e', { recursive: true });
  const sha256 = createHash('sha256').update(readFileSync('server/prisma/dev.db')).digest('hex');
  writeFileSync('test-results/e2e/.devdb-before', sha256);
}
