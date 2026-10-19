/**
 * Mục tiêu: kiểm thử đơn vị analyticsController (Dashboard): getStats, getBorrowTrends, getTopBooks, getRecentActivity.
 * Kỹ thuật: hộp trắng phủ nhánh + phân tích giá trị biên (limit, năm, tháng 1/12) + phân vùng tương đương
 *   (phiếu có/không có thông tin sách, đã trả/đang mượn). Prisma được mock TRƯỚC khi import controller.
 * Ranh giới: chỉ chứng minh logic gom nhóm/định dạng của controller; KHÔNG chứng minh truy vấn SQLite thật
 *   (xem tests/integration/analytics.api.test.ts). Việc "số độc giả hoạt động khớp tab Quản lý độc giả" (DASH-01)
 *   cần đối chiếu với giao diện và không kiểm thử được ở mức này.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): DASH-01 (thẻ thống kê, biểu đồ, sách nổi bật, hoạt động gần đây).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { callHandler, resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    book: d('count'),
    user: d('count'),
    loan: d('count', 'findMany'),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { prisma, PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }) };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));

import { PrismaClient } from '@prisma/client';
import { getBorrowTrends, getRecentActivity, getStats, getTopBooks } from '../../../src/controllers/analyticsController';

const NOW = new Date('2026-10-14T09:00:00Z');
const USER = { userId: 1, email: 'admin@test.local', role: 'ADMIN' };

const bookOf = (id: number, title = `Sách ${id}`) => ({
  id, title, isbn: `ISBN-${id}`, coverImage: `c${id}.png`, author: { name: `Tác giả ${id}` }, category: { name: `Loại ${id}` },
});
const loanOf = (bookId: number | null, overrides: Record<string, unknown> = {}) => ({
  id: Math.floor(Math.random() * 1e6),
  borrowDate: new Date('2026-03-15T10:00:00+07:00'),
  returnDate: null,
  user: { name: 'Độc giả', email: 'r@test.local' },
  bookItem: bookId === null ? null : { book: bookOf(bookId) },
  ...overrides,
});

beforeAll(() => {
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetMocks([
    mocks.prisma.book.count, mocks.prisma.user.count, ...Object.values(mocks.prisma.loan),
    mocks.prisma.$connect, mocks.prisma.$disconnect,
  ]);
});

afterAll(() => {
  vi.useRealTimers();
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

describe('getStats', () => {
  test('UT-ANA-01 trả 4 chỉ số và truy vấn đúng điều kiện (đang mượn = returnDate null; quá hạn = dueDate < now)', async () => {
    mocks.prisma.book.count.mockResolvedValue(32);
    mocks.prisma.loan.count.mockResolvedValueOnce(40).mockResolvedValueOnce(5);
    mocks.prisma.user.count.mockResolvedValue(3);
    const res = await callHandler(getStats, { user: USER });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ totalBooks: 32, activeUsers: 3, totalBorrowed: 40, overdueBooks: 5 });
    expect(mocks.prisma.loan.count.mock.calls[0][0]).toEqual({ where: { returnDate: null } });
    expect(mocks.prisma.loan.count.mock.calls[1][0]).toEqual({ where: { returnDate: null, dueDate: { lt: NOW } } });
    expect(mocks.prisma.user.count.mock.calls[0][0]).toEqual({ where: { loans: { some: { returnDate: null } } } });
  });

  test('UT-ANA-02 mọi bộ đếm bằng 0 → trả số 0 (không lỗi)', async () => {
    mocks.prisma.book.count.mockResolvedValue(0);
    mocks.prisma.loan.count.mockResolvedValue(0);
    mocks.prisma.user.count.mockResolvedValue(0);
    expect((await callHandler(getStats, {})).payload).toEqual({ totalBooks: 0, activeUsers: 0, totalBorrowed: 0, overdueBooks: 0 });
  });

  test('UT-ANA-03 lỗi DB → 500', async () => {
    mocks.prisma.book.count.mockRejectedValue(new Error('db'));
    mocks.prisma.loan.count.mockResolvedValue(0);
    mocks.prisma.user.count.mockResolvedValue(0);
    const res = await callHandler(getStats, {});
    expect(res.statusCode).toBe(500);
    expect(res.payload.error).toBe('Không thể tải thống kê');
  });
});

describe('getBorrowTrends', () => {
  test('UT-ANA-04 luôn trả đủ 12 tháng, đếm phiếu theo tháng mượn', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([
      { borrowDate: new Date('2026-01-15T05:00:00Z') },
      { borrowDate: new Date('2026-03-10T05:00:00Z') },
      { borrowDate: new Date('2026-03-20T05:00:00Z') },
      { borrowDate: new Date('2026-12-05T05:00:00Z') },
    ]);
    const res = await callHandler(getBorrowTrends, { query: { year: '2026' } });
    expect(res.payload).toHaveLength(12);
    expect(res.payload.map((m: any) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(res.payload.map((m: any) => m.count)).toEqual([1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  test('UT-ANA-05 truy vấn lọc theo khoảng năm (>= 1/1, <= 31/12)', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([]);
    await callHandler(getBorrowTrends, { query: { year: '2025' } });
    const { where } = mocks.prisma.loan.findMany.mock.calls[0][0];
    expect(where.borrowDate.gte).toEqual(new Date('2025-01-01'));
    expect(where.borrowDate.lte).toEqual(new Date('2025-12-31'));
  });

  test.each([
    ['UT-ANA-06a không truyền year → năm hiện tại', undefined, 2026],
    ['UT-ANA-06b year không phải số → năm hiện tại', 'abc', 2026],
    ['UT-ANA-06c year = 0 (falsy) → năm hiện tại', '0', 2026],
  ])('%s', async (_id, year, expectedYear) => {
    mocks.prisma.loan.findMany.mockResolvedValue([]);
    await callHandler(getBorrowTrends, { query: year === undefined ? {} : { year } });
    expect(mocks.prisma.loan.findMany.mock.calls[0][0].where.borrowDate.gte).toEqual(new Date(`${expectedYear}-01-01`));
  });

  test('UT-ANA-07 lỗi DB → 500', async () => {
    mocks.prisma.loan.findMany.mockRejectedValue(new Error('db'));
    expect((await callHandler(getBorrowTrends, { query: {} })).statusCode).toBe(500);
  });
});

describe('getTopBooks', () => {
  test('UT-ANA-08 gom theo đầu sách, sắp giảm dần theo số lượt mượn, định dạng đầy đủ', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loanOf(1), loanOf(2), loanOf(2), loanOf(2), loanOf(3), loanOf(3)]);
    const res = await callHandler(getTopBooks, { query: {} });
    expect(res.payload.map((b: any) => [b.id, b.borrowCount])).toEqual([[2, 3], [3, 2], [1, 1]]);
    expect(res.payload[0]).toEqual({
      id: 2, title: 'Sách 2', isbn: 'ISBN-2', author: 'Tác giả 2', category: 'Loại 2', coverImage: 'c2.png', borrowCount: 3,
    });
  });

  test('UT-ANA-09 mặc định giới hạn 5; limit tùy chỉnh cắt đúng số lượng', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue(Array.from({ length: 8 }, (_, i) => loanOf(i + 1)));
    expect((await callHandler(getTopBooks, { query: {} })).payload).toHaveLength(5);
    expect((await callHandler(getTopBooks, { query: { limit: '2' } })).payload).toHaveLength(2);
    expect((await callHandler(getTopBooks, { query: { limit: 'abc' } })).payload).toHaveLength(5);
    expect((await callHandler(getTopBooks, { query: { limit: '0' } })).payload).toHaveLength(5);
  });

  test('UT-ANA-10 phiếu không có thông tin sách bị bỏ qua; tác giả/thể loại thiếu → chuỗi rỗng', async () => {
    const noAuthor = loanOf(4);
    (noAuthor.bookItem!.book as any).author = null;
    (noAuthor.bookItem!.book as any).category = null;
    mocks.prisma.loan.findMany.mockResolvedValue([loanOf(null), noAuthor]);
    const res = await callHandler(getTopBooks, { query: {} });
    expect(res.payload).toHaveLength(1);
    expect(res.payload[0]).toMatchObject({ id: 4, author: '', category: '', borrowCount: 1 });
  });

  test('UT-ANA-11 chưa có phiếu mượn nào → mảng rỗng', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([]);
    expect((await callHandler(getTopBooks, { query: {} })).payload).toEqual([]);
  });

  test('UT-ANA-12 lỗi DB → 500', async () => {
    mocks.prisma.loan.findMany.mockRejectedValue(new Error('db'));
    expect((await callHandler(getTopBooks, { query: {} })).statusCode).toBe(500);
  });
});

describe('getRecentActivity', () => {
  test('UT-ANA-13 phiếu chưa trả → "borrowed" (date = borrowDate); đã trả → "returned" (date = returnDate)', async () => {
    const borrowDate = new Date('2026-10-01T00:00:00Z');
    const returnDate = new Date('2026-10-05T00:00:00Z');
    mocks.prisma.loan.findMany.mockResolvedValue([
      loanOf(1, { id: 1, borrowDate, returnDate: null }),
      loanOf(2, { id: 2, borrowDate, returnDate }),
    ]);
    const res = await callHandler(getRecentActivity, { query: {} });
    expect(res.payload[0]).toMatchObject({ id: 1, action: 'borrowed', date: borrowDate, userName: 'Độc giả', bookTitle: 'Sách 1' });
    expect(res.payload[1]).toMatchObject({ id: 2, action: 'returned', date: returnDate, returnDate });
  });

  test('UT-ANA-14 mặc định lấy 10 phiếu mới nhất; limit tùy chỉnh; limit không hợp lệ → 10', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([]);
    await callHandler(getRecentActivity, { query: {} });
    await callHandler(getRecentActivity, { query: { limit: '3' } });
    await callHandler(getRecentActivity, { query: { limit: 'x' } });
    expect(mocks.prisma.loan.findMany.mock.calls.map(([arg]) => arg.take)).toEqual([10, 3, 10]);
    expect(mocks.prisma.loan.findMany.mock.calls[0][0].orderBy).toEqual({ borrowDate: 'desc' });
  });

  test('UT-ANA-15 thiếu user/sách → tên mặc định "Độc giả" / "Sách"', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loanOf(null, { user: null })]);
    const res = await callHandler(getRecentActivity, { query: {} });
    expect(res.payload[0]).toMatchObject({ userName: 'Độc giả', bookTitle: 'Sách' });
  });

  test('UT-ANA-16 lỗi DB → 500', async () => {
    mocks.prisma.loan.findMany.mockRejectedValue(new Error('db'));
    expect((await callHandler(getRecentActivity, { query: {} })).statusCode).toBe(500);
  });
});
