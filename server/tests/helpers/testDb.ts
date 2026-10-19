/**
 * Cơ sở dữ liệu SQLite cách ly cho kiểm thử tích hợp.
 *
 * schema.prisma ghi cứng `url = "file:./dev.db"`, nên đặt DATABASE_URL KHÔNG đổi được kết nối.
 * Cách cách ly ở đây:
 *   1. createTemplateDatabase(): sao chép schema.prisma sang server/tests/tmp/ với url tuyệt đối tới
 *      một file mới, rồi `prisma db push --skip-generate` để tạo bảng (chỉ cấu trúc, KHÔNG có dữ liệu
 *      thật, KHÔNG đọc/ghi server/prisma/dev.db).
 *   2. cloneDatabase(): mỗi file test nhận một bản sao riêng của template.
 *   3. Setup file thay PrismaClient bằng lớp con truyền `datasourceUrl` = DB tạm; nếu biến môi trường
 *      chưa có thì ném lỗi thay vì rơi về dev.db. assertIsolated() kiểm tra PRAGMA database_list.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SERVER_DIR = resolve(__dirname, '../..');
export const TMP_DIR = resolve(SERVER_DIR, 'tests/tmp');
export const PRODUCTION_DB = resolve(SERVER_DIR, 'prisma/dev.db');
const PRISMA_BIN = resolve(SERVER_DIR, 'node_modules/.bin/prisma');

export const toUrl = (file: string) => `file:${file}`;

export function assertNotProductionDb(file: string) {
  if (resolve(file) === PRODUCTION_DB) throw new Error(`Refusing to use the production database ${PRODUCTION_DB}`);
  if (!resolve(file).startsWith(TMP_DIR)) throw new Error(`Test database must live under ${TMP_DIR}: ${file}`);
}

/** Tạo DB rỗng có đủ bảng theo schema.prisma hiện tại. Trả về đường dẫn file. */
export function createTemplateDatabase(name = 'template'): string {
  mkdirSync(TMP_DIR, { recursive: true });
  const dbFile = resolve(TMP_DIR, `${name}.db`);
  assertNotProductionDb(dbFile);
  rmSync(dbFile, { force: true });
  const schema = readFileSync(resolve(SERVER_DIR, 'prisma/schema.prisma'), 'utf8');
  const literal = 'url      = "file:./dev.db"';
  if (!schema.includes(literal)) throw new Error('schema.prisma datasource changed; update testDb.ts isolation logic.');
  const schemaFile = resolve(TMP_DIR, `${name}.schema.prisma`);
  writeFileSync(schemaFile, schema.replace(literal, `url      = "${toUrl(dbFile)}"`));
  execFileSync(PRISMA_BIN, ['db', 'push', '--schema', schemaFile, '--skip-generate', '--accept-data-loss'], {
    cwd: TMP_DIR,
    env: { ...process.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: 'pipe',
  });
  if (!existsSync(dbFile)) throw new Error(`prisma db push did not create ${dbFile}`);
  return dbFile;
}

export function cloneDatabase(template: string, name: string): string {
  const file = resolve(TMP_DIR, `${name}.db`);
  assertNotProductionDb(file);
  copyFileSync(template, file);
  return file;
}

export function removeDatabase(file: string) {
  assertNotProductionDb(file);
  for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(`${file}${suffix}`, { force: true });
}

/** Xác minh kết nối Prisma thực sự trỏ vào file DB tạm (không phải dev.db). */
export async function assertIsolated(prisma: { $queryRawUnsafe: (sql: string) => Promise<unknown> }, expectedFile: string) {
  const rows = (await prisma.$queryRawUnsafe('PRAGMA database_list')) as Array<{ name: string; file: string }>;
  const main = rows.find((row) => row.name === 'main');
  if (!main || resolve(main.file) !== resolve(expectedFile)) {
    throw new Error(`Isolation gate failed: connected to ${main?.file}, expected ${expectedFile}`);
  }
  assertNotProductionDb(main.file);
  return main.file;
}
