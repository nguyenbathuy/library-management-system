// Dữ liệu E2E dùng chung giữa launcher (e2e/support/start-server.mjs) và các spec.
// Toàn bộ được seed vào DB SQLite tạm e2e/.tmp/e2e.db (không phải server/prisma/dev.db), 2FA tắt.
import { readFileSync } from 'node:fs';

type Account = { email: string; name: string; role: 'ADMIN' | 'USER' };
type BookSeed = { isbn: string; title: string; copies: number };

const data = JSON.parse(readFileSync(new URL('./testData.json', import.meta.url), 'utf8')) as {
  password: string;
  users: Record<'admin' | 'user' | 'renew' | 'password' | 'reserver', Account>;
  books: Record<'borrow' | 'loaned' | 'renew' | 'soldout' | 'inventory', BookSeed>;
};

export const PASSWORD = data.password;
export const USERS = data.users;
export const BOOKS = data.books;
export const barcodeOf = (book: BookSeed, copy: number) => `${book.isbn}-${copy}`;

// Playwright `test.fail(SHOW_KNOWN_BUGS ? false : true, ...)`: đặt E2E_SHOW_KNOWN_BUGS=1 để xem lỗi thật.
export const EXPECT_KNOWN_BUG = process.env.E2E_SHOW_KNOWN_BUGS !== '1';
