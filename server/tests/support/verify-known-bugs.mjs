// Chứng minh mỗi ca `test.fails` (KNOWN BUG / NEW FINDING) thất bại ĐÚNG lý do (assertion nghiệp vụ),
// không phải do mock chưa cấu hình hay lỗi harness.
// Cách làm: tạo bản sao tạm cạnh file gốc với `test.fails(` → `test(` (và `test.fails.each(` → `test.each(`), chạy Vitest chỉ trên các bản sao,
// in thông điệp lỗi thật của từng ca, rồi xóa bản sao. File gốc không bị sửa.
// Dùng: node server/tests/support/verify-known-bugs.mjs <vitest-config> <test-file>...
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const [config, ...files] = process.argv.slice(2);
if (!config || files.length === 0) {
  console.error('usage: verify-known-bugs.mjs <vitest-config> <test-file>...');
  process.exit(2);
}
const copies = files.map((file) => {
  // Prefix (not suffix) keeps include patterns such as **/*.property.test.ts matching.
  const copy = join(dirname(file), `knownbug-verify.${basename(file)}`);
  writeFileSync(copy, readFileSync(file, 'utf8').replaceAll('test.fails.each(', 'test.each(').replaceAll('test.fails(', 'test('));
  return copy;
});
let status = 0;
try {
  execFileSync('npx', ['vitest', 'run', '--config', config, '--reporter', 'verbose', ...copies], {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
} catch (error) {
  status = error.status ?? 1; // expected: the known-bug cases now fail
} finally {
  for (const copy of copies) rmSync(copy, { force: true });
}
console.log(`\n[verify-known-bugs] vitest exit code with test.fails disabled: ${status}`);
