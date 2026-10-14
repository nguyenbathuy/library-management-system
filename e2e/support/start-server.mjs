// Playwright webServer cho backend E2E:
//   1. Tạo DB SQLite rỗng e2e/.tmp/e2e.db bằng `prisma db push` từ bản sao schema (url tuyệt đối tới file tạm).
//   2. Seed dữ liệu E2E (e2e/fixtures/testData.json): tài khoản 2FA tắt, đầu sách, phiếu mượn mẫu.
//   3. Xác minh PRAGMA database_list trỏ đúng file tạm, rồi chạy server/src/index.ts THẬT (ts-node)
//      với preload thay datasource Prisma + nodemailer. Khi bị dừng: xóa DB tạm.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER = resolve(ROOT, 'server');
const TMP = resolve(ROOT, 'e2e/.tmp');
const DB_FILE = resolve(TMP, 'e2e.db');
const DB_URL = `file:${DB_FILE}`;
const serverRequire = createRequire(resolve(SERVER, 'package.json'));
const data = JSON.parse(readFileSync(resolve(ROOT, 'e2e/fixtures/testData.json'), 'utf8'));

if (DB_FILE === resolve(SERVER, 'prisma/dev.db')) throw new Error('Refusing to use dev.db');

// 1. Schema → DB tạm
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const literal = 'url      = "file:./dev.db"';
const schema = readFileSync(resolve(SERVER, 'prisma/schema.prisma'), 'utf8');
if (!schema.includes(literal)) throw new Error('schema.prisma datasource changed; update e2e/support/start-server.mjs');
writeFileSync(resolve(TMP, 'e2e.schema.prisma'), schema.replace(literal, `url      = "${DB_URL}"`));
execFileSync(resolve(SERVER, 'node_modules/.bin/prisma'), ['db', 'push', '--schema', resolve(TMP, 'e2e.schema.prisma'), '--skip-generate', '--accept-data-loss'], {
  cwd: TMP, stdio: 'inherit', env: { ...process.env, CHECKPOINT_DISABLE: '1' },
});

// 2. Seed
const { PrismaClient } = serverRequire('@prisma/client');
const bcrypt = serverRequire('bcryptjs');
const prisma = new PrismaClient({ datasourceUrl: DB_URL });
const [main] = (await prisma.$queryRawUnsafe('PRAGMA database_list')).filter((row) => row.name === 'main');
if (resolve(main.file) !== DB_FILE) throw new Error(`Isolation gate failed: ${main.file}`);

const hash = await bcrypt.hash(data.password, 10);
const users = {};
for (const [key, account] of Object.entries(data.users)) {
  users[key] = await prisma.user.create({ data: { ...account, password: hash, membershipTier: 'STANDARD', twoFactorEnabled: false } });
}
const category = await prisma.category.create({ data: { name: 'Kiểm thử E2E' } });
const author = await prisma.author.create({ data: { name: 'Nhóm 8 E2E' } });
const items = {};
for (const [key, book] of Object.entries(data.books)) {
  const created = await prisma.book.create({
    data: {
      title: book.title, isbn: book.isbn, categoryId: category.id, authorId: author.id,
      items: { create: Array.from({ length: book.copies }, (_, i) => ({ barcode: `${book.isbn}-${i + 1}`, location: 'Kệ E2E' })) },
    },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  items[key] = created.items;
}
const DAY = 24 * 60 * 60 * 1000;
for (const loan of data.seededLoans) {
  const item = items[loan.book][loan.copy - 1];
  await prisma.loan.create({
    data: { userId: users[loan.user].id, bookItemId: item.id, borrowDate: new Date(Date.now() - DAY), dueDate: new Date(Date.now() + loan.dueInDays * DAY) },
  });
  await prisma.bookItem.update({ where: { id: item.id }, data: { status: 'BORROWED' } });
}
await prisma.$disconnect();
console.log(`[e2e] Seeded ${Object.keys(users).length} users, ${Object.keys(items).length} books, ${data.seededLoans.length} loans into ${DB_FILE}`);

// 3. Backend thật với preload
const child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', '-r', resolve(ROOT, 'e2e/support/server-preload.cjs'), 'src/index.ts'], {
  cwd: SERVER,
  stdio: 'inherit',
  env: {
    ...process.env,
    E2E_DATABASE_URL: DB_URL,
    PORT: '5000',
    JWT_SECRET: 'e2e-test-secret-never-used-in-production',
    SMTP_USER: '',
    SMTP_PASS: '',
    TS_NODE_TRANSPILE_ONLY: 'true',
  },
});
const cleanup = () => rmSync(TMP, { recursive: true, force: true });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { child.kill(signal); });
}
child.on('exit', (code) => { cleanup(); process.exit(code ?? 0); });
