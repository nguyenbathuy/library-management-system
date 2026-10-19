/**
 * Mục tiêu: kiểm thử tích hợp API thống kê Dashboard (/api/analytics/*) qua HTTP thật trên SQLite tạm, đối chiếu số liệu
 *   trả về với dữ liệu đã dựng trong DB.
 * Kỹ thuật: hộp đen mức API với bộ dữ liệu có đáp án tính tay; phân tích giá trị biên (đầu/cuối năm, limit).
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): DASH-01 (thẻ thống kê, biểu đồ, sách nổi bật, hoạt động gần đây).
 * test.fails: NEW FINDING FIND-14 (biểu đồ xu hướng bỏ sót phiếu mượn trong ngày 31/12: điều kiện `lte: new Date("YYYY-12-31")`
 *   là 00:00 UTC).
 * Ranh giới: không kiểm thử việc "số độc giả hoạt động khớp tab Quản lý độc giả" (so sánh hai màn hình, cần E2E) và không
 *   kiểm thử biểu đồ/PDF (frontend, DEF-003).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../helpers/app';
import { bearer, createBook, createLoan, createUser, DAY, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let r1: Awaited<ReturnType<typeof createUser>>;
let r2: Awaited<ReturnType<typeof createUser>>;
let bookA: Awaited<ReturnType<typeof createBook>>;
let bookB: Awaited<ReturnType<typeof createBook>>;

const get = (url: string, as?: { id: number; email: string; role: string }) => {
  const req = request(app).get(url);
  return as ? req.set(bearer(as)) : req;
};

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN', name: 'Thủ thư' });
  r1 = await createUser({ email: 'r1@it.local', name: 'Độc giả 1' });
  r2 = await createUser({ email: 'r2@it.local', name: 'Độc giả 2' });
  bookA = await createBook('ANA-IT-A', 4, 'Sách A');
  bookB = await createBook('ANA-IT-B', 4, 'Sách B');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Xác thực', () => {
  test.each(['stats', 'borrow-trends', 'top-books', 'recent-activity'])('IT-ANA-01 GET /analytics/%s không token → 401', async (endpoint) => {
    expect((await get(`/api/analytics/${endpoint}`)).status).toBe(401);
  });
});

describe('GET /api/analytics/stats (DASH-01)', () => {
  test('IT-ANA-02 số liệu khớp dữ liệu dựng: 2 đầu sách, 3 phiếu chưa trả (1 quá hạn), 2 người đang mượn', async () => {
    await createLoan(r1.id, bookA.items[0].id); // đang mượn, còn hạn
    await createLoan(r1.id, bookA.items[1].id, { dueDate: new Date(Date.now() - 3 * DAY), status: 'OVERDUE' }); // quá hạn
    await createLoan(r2.id, bookB.items[0].id); // đang mượn
    await createLoan(r2.id, bookB.items[1].id, { returnDate: new Date(), status: 'COMPLETED' }); // đã trả, không tính
    const res = await get('/api/analytics/stats', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalBooks: 2, totalBorrowed: 3, activeUsers: 2, overdueBooks: 1 });
  });

  test('IT-ANA-03 người đã trả hết sách không tính là "độc giả đang mượn"; DB trống → toàn số 0', async () => {
    await createLoan(r1.id, bookA.items[0].id, { returnDate: new Date(), status: 'COMPLETED' });
    expect((await get('/api/analytics/stats', admin)).body).toMatchObject({ totalBorrowed: 0, activeUsers: 0, overdueBooks: 0 });
    await resetDatabase();
    admin = await createUser({ email: 'admin2@it.local', role: 'ADMIN' });
    expect((await get('/api/analytics/stats', admin)).body).toEqual({ totalBooks: 0, totalBorrowed: 0, activeUsers: 0, overdueBooks: 0 });
  });

  test('IT-ANA-04 phiếu quá hạn đã trả không tính vào "quá hạn"', async () => {
    await createLoan(r1.id, bookA.items[0].id, { dueDate: new Date(Date.now() - 9 * DAY), returnDate: new Date(), status: 'COMPLETED' });
    expect((await get('/api/analytics/stats', admin)).body.overdueBooks).toBe(0);
  });
});

describe('GET /api/analytics/borrow-trends', () => {
  const mk = (iso: string, idx: number, user = r1) => createLoan(user.id, (idx < 4 ? bookA : bookB).items[idx % 4].id, { borrowDate: new Date(iso), returnDate: new Date(iso), status: 'COMPLETED' });

  test('IT-ANA-05 trả đủ 12 tháng; đếm theo tháng mượn; chỉ tính đúng năm được hỏi', async () => {
    await mk('2026-01-15T05:00:00Z', 0);
    await mk('2026-03-10T05:00:00Z', 1);
    await mk('2026-03-20T05:00:00Z', 2);
    await mk('2026-07-05T05:00:00Z', 3);
    await mk('2025-06-10T05:00:00Z', 4); // năm khác
    const res = await get('/api/analytics/borrow-trends?year=2026', admin);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
    expect(res.body.map((m: any) => m.count)).toEqual([1, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect((await get('/api/analytics/borrow-trends?year=2025', admin)).body[5].count).toBe(1);
  });

  test('IT-ANA-06 không có year / year không hợp lệ → dùng năm hiện tại', async () => {
    const thisYear = new Date().getFullYear();
    await mk(`${thisYear}-02-10T05:00:00Z`, 0);
    expect((await get('/api/analytics/borrow-trends', admin)).body[1].count).toBe(1);
    expect((await get('/api/analytics/borrow-trends?year=abc', admin)).body[1].count).toBe(1);
  });

  // NEW FINDING FIND-14 — phiếu mượn lúc 10:00 ngày 31/12 (giờ VN) = 03:00Z, sau mốc `lte: 2026-12-31T00:00Z` nên bị bỏ sót.
  test.fails('IT-ANA-07 (FIND-14) phiếu mượn ngày 31/12 phải được tính vào tháng 12 của năm đó', async () => {
    await mk('2026-12-31T03:00:00Z', 0);
    const res = await get('/api/analytics/borrow-trends?year=2026', admin);
    expect(res.body[11].count).toBe(1);
  });
});

describe('GET /api/analytics/top-books', () => {
  beforeEach(async () => {
    // Sách A: 3 lượt (kể cả đã trả); Sách B: 1 lượt.
    await createLoan(r1.id, bookA.items[0].id, { returnDate: new Date(), status: 'COMPLETED' });
    await createLoan(r2.id, bookA.items[1].id, { returnDate: new Date(), status: 'COMPLETED' });
    await createLoan(r1.id, bookA.items[2].id);
    await createLoan(r2.id, bookB.items[0].id);
  });

  test('IT-ANA-08 xếp giảm dần theo lượt mượn (tính cả phiếu đã trả), kèm tác giả/thể loại', async () => {
    const res = await get('/api/analytics/top-books', admin);
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => [b.title, b.borrowCount])).toEqual([['Sách A', 3], ['Sách B', 1]]);
    expect(res.body[0]).toMatchObject({ isbn: 'ANA-IT-A', author: 'Nhóm 8', category: 'Kiểm thử' });
  });

  test('IT-ANA-09 limit giới hạn số kết quả; limit không hợp lệ/0 → mặc định 5', async () => {
    expect((await get('/api/analytics/top-books?limit=1', admin)).body).toHaveLength(1);
    expect((await get('/api/analytics/top-books?limit=abc', admin)).body).toHaveLength(2);
    expect((await get('/api/analytics/top-books?limit=0', admin)).body).toHaveLength(2);
  });
});

describe('GET /api/analytics/recent-activity', () => {
  test('IT-ANA-10 phiếu mới nhất trước; chưa trả = "borrowed", đã trả = "returned"; tên người/sách đúng', async () => {
    await createLoan(r1.id, bookA.items[0].id, { borrowDate: new Date('2026-05-01T05:00:00Z'), returnDate: new Date('2026-05-03T05:00:00Z'), status: 'COMPLETED' });
    await createLoan(r2.id, bookB.items[0].id, { borrowDate: new Date('2026-06-01T05:00:00Z') });
    const res = await get('/api/analytics/recent-activity', admin);
    expect(res.status).toBe(200);
    expect(res.body.map((a: any) => [a.userName, a.bookTitle, a.action])).toEqual([
      ['Độc giả 2', 'Sách B', 'borrowed'], ['Độc giả 1', 'Sách A', 'returned'],
    ]);
    expect(new Date(res.body[1].date).toISOString()).toBe('2026-05-03T05:00:00.000Z');
  });

  test('IT-ANA-11 limit giới hạn số hoạt động (mặc định 10)', async () => {
    for (let i = 0; i < 4; i++) await createLoan(r1.id, bookA.items[i].id, { borrowDate: new Date(2026, 0, i + 1) });
    for (let i = 0; i < 4; i++) await createLoan(r2.id, bookB.items[i].id, { borrowDate: new Date(2026, 1, i + 1) });
    expect((await get('/api/analytics/recent-activity', admin)).body).toHaveLength(8);
    expect((await get('/api/analytics/recent-activity?limit=3', admin)).body).toHaveLength(3);
  });
});
