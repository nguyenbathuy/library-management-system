import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

export default function globalTeardown() {
  const file = 'server/prisma/dev.db';
  const before = readFileSync('test-results/e2e/.devdb-before', 'utf8');
  const after = existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : 'absent';
  rmSync('test-results/e2e/.devdb-before', { force: true });
  writeFileSync('test-results/e2e/db-preservation.json', `${JSON.stringify({
    file, sha256Before: before, sha256After: after, unchanged: before === after,
    note: 'Hash không đổi chứng minh không ghi vào dev.db; không chứng minh không có thao tác đọc. "absent" nghĩa là dev.db chưa tồn tại (bản clone mới).',
  }, null, 2)}\n`);
  if (before !== after) throw new Error('server/prisma/dev.db changed during the E2E run');
}
