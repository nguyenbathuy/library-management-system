/**
 * Mục tiêu: bổ sung kiểm thử đơn vị cho các phần loanController chưa được phủ ở loan.stateMachine.test.ts:
 *   formatLoanResponse (trạng thái hiển thị + tiền phạt), validateBorrowRisk (blacklist / quá hạn / hạn mức theo hạng),
 *   borrowBook (mượn theo bookId / bookItemId), lookupBarcode, getMyLoans, getAllLoans, triggerReminders.
 * Kỹ thuật: hộp trắng phủ nhánh + phân vùng tương đương (hạng STANDARD/PREMIUM/LECTURER) + giá trị biên (đúng hạn mức
 *   4/5, 5/5; còn 2 ngày / 3 ngày tới hạn). Prisma, notificationService và reminderJob (import động) được mock TRƯỚC khi import.
 * Ranh giới: chỉ chứng minh controller → lời gọi Prisma/notification; KHÔNG chứng minh ghi SQLite thật hay gửi email thật
 *   (xem tests/integration/loans.api.test.ts, loans.lists.api.test.ts).
 * Liên kết hộp đen: BOR-10 (chặn mượn khi quá hạn/nợ phạt), BOR-06 (cuốn không khả dụng) theo brief.
 * test.fails: DEF-005 (hạn trả theo hạng thành viên PREMIUM/LECTURER vẫn +14 ngày) — căn cứ ghi trong utils/loanRules.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { callHandler, resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    user: d('findUnique'),
    bookItem: d('findFirst', 'findUnique', 'update', 'count'),
    loan: d('create', 'findMany'),
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return {
    prisma,
    PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }),
    createNotification: vi.fn(),
    scanAndSendReminders: vi.fn(),
  };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));
vi.mock('../../../src/services/notificationService', () => ({ createNotification: mocks.createNotification }));
vi.mock('../../../src/jobs/reminderJob', () => ({ scanAndSendReminders: mocks.scanAndSendReminders }));

import { PrismaClient } from '@prisma/client';
import {
  borrowBook, formatLoanResponse, getAllLoans, getMyLoans, lookupBarcode, triggerReminders, validateBorrowRisk,
} from '../../../src/controllers/loanController';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-14T09:00:00+07:00');
const ADMIN = { userId: 1, email: 'admin@test.local', role: 'ADMIN' };
const READER = { userId: 2, email: 'reader@test.local', role: 'USER' };

const loanOf = (overrides: Record<string, unknown> = {}) => ({
  id: 50, userId: 2, bookItemId: 10, borrowDate: new Date(NOW.getTime() - 3 * DAY), dueDate: new Date(NOW.getTime() + 11 * DAY),
  returnDate: null, status: 'ACTIVE', fineAmount: 0, compensationAmount: 0, isFinePaid: false, renewalStatus: 'NONE',
  bookItem: { id: 10, barcode: 'BC-1', location: 'Kệ A', status: 'BORROWED', book: { id: 100, title: 'Sách', isbn: 'I', coverImage: 'c', author: { name: 'TG' }, category: { name: 'TL' }, items: [{ status: 'AVAILABLE' }, { status: 'BORROWED' }] } },
  user: { id: 2, name: 'Độc giả', email: 'reader@test.local' },
  ...overrides,
});
const userOf = (loans: unknown[] = [], overrides: Record<string, unknown> = {}) => ({
  id: 2, email: 'reader@test.local', name: 'Độc giả', role: 'USER', membershipTier: 'STANDARD', isBlacklisted: false, loans, ...overrides,
});
const activeLoans = (n: number) => Array.from({ length: n }, (_, i) => loanOf({ id: 60 + i }));

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
    ...Object.values(mocks.prisma.user), ...Object.values(mocks.prisma.bookItem), ...Object.values(mocks.prisma.loan),
    mocks.prisma.$transaction, mocks.prisma.$connect, mocks.prisma.$disconnect, mocks.createNotification, mocks.scanAndSendReminders,
  ]);
  mocks.prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  mocks.createNotification.mockResolvedValue({ id: 1 });
});

afterAll(() => {
  vi.useRealTimers();
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------- formatLoanResponse
describe('formatLoanResponse — trạng thái hiển thị và tiền phạt', () => {
  const at = (days: number) => ({ dueDate: new Date(NOW.getTime() + days * DAY) });

  test.each([
    ['UT-LN-01a còn 11 ngày → On Time', at(11), 'On Time'],
    ['UT-LN-01b còn đúng 3 ngày (biên) → On Time', at(3), 'On Time'],
    ['UT-LN-01c còn đúng 2 ngày (biên) → Due Soon', at(2), 'Due Soon'],
    ['UT-LN-01d hôm nay hết hạn (0 ngày) → Due Soon', at(0), 'Due Soon'],
    ['UT-LN-01e quá hạn 2 ngày, status ACTIVE → Overdue', { ...at(-2) }, 'Overdue'],
    ['UT-LN-01f status OVERDUE → Overdue', { status: 'OVERDUE', ...at(5) }, 'Overdue'],
    ['UT-LN-01g status "Overdue" (dữ liệu cũ) → Overdue', { status: 'Overdue', ...at(5) }, 'Overdue'],
    ['UT-LN-01h LOST_PENDING_PAYMENT → Lost', { status: 'LOST_PENDING_PAYMENT' }, 'Lost'],
    ['UT-LN-01i status LOST/Lost (dữ liệu cũ) → Lost', { status: 'Lost' }, 'Lost'],
    ['UT-LN-01j COMPLETED → Returned', { status: 'COMPLETED' }, 'Returned'],
    ['UT-LN-01k status RETURNED/Returned (dữ liệu cũ) → Returned', { status: 'Returned' }, 'Returned'],
  ])('%s', (_id, overrides, expected) => {
    expect(formatLoanResponse(loanOf(overrides)).status).toBe(expected);
  });

  test('UT-LN-02 quá hạn mà DB chưa ghi phạt → tính 5.000đ × số ngày quá hạn; đã ghi phạt → giữ giá trị DB', () => {
    expect(formatLoanResponse(loanOf({ ...at(-3), fineAmount: 0 })).fineAmount).toBe(15000);
    expect(formatLoanResponse(loanOf({ ...at(-3), fineAmount: 40000 })).fineAmount).toBe(40000);
  });

  test('UT-LN-03 phiếu đã nộp phạt không tính thêm; chưa quá hạn → phạt 0', () => {
    expect(formatLoanResponse(loanOf({ ...at(-3), fineAmount: 0, isFinePaid: true })).fineAmount).toBe(0);
    expect(formatLoanResponse(loanOf({ ...at(5) })).fineAmount).toBe(0);
  });

  test('UT-LN-04 có tiền đền bù chưa nộp → fineAmount hiển thị = tiền đền bù', () => {
    const res = formatLoanResponse(loanOf({ status: 'LOST_PENDING_PAYMENT', compensationAmount: 200000, fineAmount: 0 }));
    expect(res.fineAmount).toBe(200000);
    expect(res.compensationAmount).toBe(200000);
  });

  test('UT-LN-05 số bản còn: dùng tham số availableCopies nếu có, nếu không tự đếm từ items (không phân biệt hoa thường)', () => {
    expect(formatLoanResponse(loanOf(), 7)).toMatchObject({ available: 7, availableCopies: 7 });
    expect(formatLoanResponse(loanOf())).toMatchObject({ available: 1, availableCopies: 1 });
    const lower = loanOf();
    lower.bookItem.book.items = [{ status: 'available' }, { status: 'Available' }];
    expect(formatLoanResponse(lower).available).toBe(2);
  });

  test('UT-LN-06 thiếu sách / bản sao / người dùng → null/undefined hoặc giá trị dự phòng; renewalStatus mặc định NONE', () => {
    const res = formatLoanResponse(loanOf({ bookItem: null, user: null, renewalStatus: null }));
    expect(res).toMatchObject({ bookId: null, book: null, bookItem: null, renewalStatus: 'NONE', available: undefined });
    expect(res.user).toEqual({ id: 2, name: 'Độc giả', email: '' });
    expect(formatLoanResponse(loanOf({ user: null, userId: null })).user).toBeUndefined();
  });

  test('UT-LN-07 ánh xạ đầy đủ thông tin sách, bản sao và người mượn; tác giả/thể loại thiếu → chuỗi rỗng', () => {
    const res = formatLoanResponse(loanOf());
    expect(res.book).toMatchObject({ id: 100, title: 'Sách', author: 'TG', category: 'TL', copies: 2 });
    expect(res.bookItem).toEqual({ id: 10, barcode: 'BC-1', location: 'Kệ A', status: 'BORROWED' });
    expect(res.user).toEqual({ id: 2, name: 'Độc giả', email: 'reader@test.local' });
    const bare = loanOf();
    bare.bookItem.book.author = null as any;
    bare.bookItem.book.category = null as any;
    expect(formatLoanResponse(bare).book).toMatchObject({ author: '', category: '' });
  });
});

// ---------------------------------------------------------------- validateBorrowRisk
describe('validateBorrowRisk — kiểm duyệt trước khi mượn', () => {
  const risk = async (user: unknown) => {
    mocks.prisma.user.findUnique.mockResolvedValue(user);
    return validateBorrowRisk(2);
  };

  test('UT-LN-08 độc giả không tồn tại → 404', async () => {
    expect(await risk(null)).toMatchObject({ allowed: false, status: 404 });
  });

  test('UT-LN-09 độc giả trong Blacklist → 403', async () => {
    expect(await risk(userOf([], { isBlacklisted: true }))).toMatchObject({ allowed: false, status: 403 });
  });

  test.each([
    ['UT-LN-10a status OVERDUE', loanOf({ status: 'OVERDUE' })],
    ['UT-LN-10b LOST_PENDING_PAYMENT', loanOf({ status: 'LOST_PENDING_PAYMENT' })],
    ['UT-LN-10c ACTIVE nhưng đã quá hạn (chưa trả)', loanOf({ dueDate: new Date(NOW.getTime() - DAY) })],
    ['UT-LN-10d đã trả nhưng còn nợ tiền phạt', loanOf({ returnDate: new Date(), status: 'COMPLETED', fineAmount: 10000, isFinePaid: false })],
    ['UT-LN-10e đã trả nhưng còn nợ tiền đền bù', loanOf({ returnDate: new Date(), status: 'COMPLETED', compensationAmount: 50000, isFinePaid: false })],
  ])('%s (BOR-10) → 400, không cho mượn tiếp', async (_id, blocking) => {
    const result = await risk(userOf([blocking]));
    expect(result).toMatchObject({ allowed: false, status: 400 });
    expect(result.error).toContain('1 phiếu mượn quá hạn');
    expect(result.error).toContain('"Sách"');
  });

  test('UT-LN-11 nhiều phiếu vi phạm → chỉ liệt kê 3 tên sách đầu và thêm "..."', async () => {
    const loans = Array.from({ length: 4 }, (_, i) => loanOf({ id: i, status: 'OVERDUE' }));
    const result = await risk(userOf(loans));
    expect(result.error).toContain('4 phiếu mượn');
    expect(result.error).toContain('...');
    expect((result.error!.match(/"Sách"/g) ?? [])).toHaveLength(3);
  });

  test('UT-LN-12 phiếu vi phạm thiếu tên sách → dùng "Sách"', async () => {
    const result = await risk(userOf([loanOf({ status: 'OVERDUE', bookItem: null })]));
    expect(result.error).toContain('"Sách"');
  });

  test('UT-LN-13 đã trả và đã nộp phạt đầy đủ → không chặn', async () => {
    expect(await risk(userOf([loanOf({ returnDate: new Date(), status: 'COMPLETED', fineAmount: 10000, isFinePaid: true })]))).toEqual({ allowed: true });
  });

  test.each([
    ['UT-LN-14a STANDARD đang mượn 4/5 (biên dưới) → được mượn', 'STANDARD', 4, true],
    ['UT-LN-14b STANDARD đang mượn 5/5 (biên) → 400', 'STANDARD', 5, false],
    ['UT-LN-14c PREMIUM 9/10 → được mượn', 'PREMIUM', 9, true],
    ['UT-LN-14d PREMIUM 10/10 → 400', 'PREMIUM', 10, false],
    ['UT-LN-14e LECTURER 14/15 → được mượn', 'LECTURER', 14, true],
    ['UT-LN-14f LECTURER 15/15 → 400', 'LECTURER', 15, false],
    ['UT-LN-14g hạng viết thường "premium" vẫn được nhận diện (10)', 'premium', 10, false],
    ['UT-LN-14h hạng không xác định → mặc định hạn mức 5', 'VIP', 5, false],
    ['UT-LN-14i hạng null → STANDARD', null, 5, false],
  ])('%s', async (_id, tier, count, allowed) => {
    const result = await risk(userOf(activeLoans(count), { membershipTier: tier }));
    expect(result.allowed).toBe(allowed);
    if (!allowed) {
      expect(result.status).toBe(400);
      expect(result.error).toContain('giới hạn mượn tối đa');
    }
  });
});

// ---------------------------------------------------------------- borrowBook
describe('borrowBook — POST /loans/borrow (mượn theo bookId / bookItemId)', () => {
  const item = (overrides: Record<string, unknown> = {}) => ({ id: 10, bookId: 100, barcode: 'BC-1', status: 'AVAILABLE', book: { id: 100, title: 'Sách mượn' }, ...overrides });
  function arrange(found: unknown = item()) {
    mocks.prisma.user.findUnique.mockResolvedValue(userOf());
    mocks.prisma.bookItem.findFirst.mockResolvedValue(found);
    mocks.prisma.bookItem.update.mockResolvedValue({ id: 10, status: 'BORROWED' });
    mocks.prisma.loan.create.mockImplementation(async ({ data }: any) => loanOf({ ...data, id: 77 }));
    mocks.prisma.bookItem.count.mockResolvedValue(1);
  }

  test('UT-LN-15 chưa đăng nhập → 401, không truy vấn', async () => {
    const res = await callHandler(borrowBook, { body: { bookId: 100 } });
    expect(res.statusCode).toBe(401);
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test.each([
    ['UT-LN-16a Blacklist → 403', userOf([], { isBlacklisted: true }), 403],
    ['UT-LN-16b đang có phiếu quá hạn → 400', userOf([loanOf({ status: 'OVERDUE' })]), 400],
    ['UT-LN-16c không tồn tại → 404', null, 404],
  ])('%s: kết quả kiểm duyệt rủi ro chặn mượn, không tạo phiếu', async (_id, user, status) => {
    mocks.prisma.user.findUnique.mockResolvedValue(user);
    const res = await callHandler(borrowBook, { body: { bookId: 100 }, user: READER });
    expect(res.statusCode).toBe(status);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  test('UT-LN-17 mượn theo bookId: lấy một bản AVAILABLE, BookItem → BORROWED, Loan ACTIVE hạn +14 ngày, thông báo, số bản còn', async () => {
    arrange();
    const res = await callHandler(borrowBook, { body: { bookId: '100' }, user: READER });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.bookItem.findFirst.mock.calls[0][0].where).toEqual({ bookId: 100, status: 'AVAILABLE' });
    expect(mocks.prisma.bookItem.update.mock.calls[0][0]).toEqual({ where: { id: 10 }, data: { status: 'BORROWED' } });
    const data = mocks.prisma.loan.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 2, bookItemId: 10, status: 'ACTIVE', fineAmount: 0, isFinePaid: false, renewalStatus: 'NONE' });
    expect(data.dueDate.getTime() - NOW.getTime()).toBe(14 * DAY);
    expect(res.payload).toMatchObject({ id: 77, available: 1, availableCopies: 1 });
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 2, title: 'Mượn sách thành công' }));
    expect(mocks.prisma.bookItem.count.mock.calls[0][0].where).toEqual({ bookId: 100, status: 'AVAILABLE' });
  });

  test('UT-LN-18 mượn theo bookItemId cụ thể (ưu tiên hơn bookId)', async () => {
    arrange();
    await callHandler(borrowBook, { body: { bookItemId: 10, bookId: 999 }, user: READER });
    expect(mocks.prisma.bookItem.findFirst.mock.calls[0][0].where).toEqual({ id: 10, status: 'AVAILABLE' });
  });

  test('UT-LN-19 (BOR-06) bookItemId không khả dụng → 400 "không khả dụng", không tạo phiếu', async () => {
    arrange(null);
    const res = await callHandler(borrowBook, { body: { bookItemId: 10 }, user: READER });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('không khả dụng');
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  test('UT-LN-20 bookId hết bản → 400 "hết bản"; thiếu cả bookId và bookItemId → 400', async () => {
    arrange(null);
    const out = await callHandler(borrowBook, { body: { bookId: 100 }, user: READER });
    expect(out.statusCode).toBe(400);
    expect(out.payload.error).toContain('hết bản');
    const missing = await callHandler(borrowBook, { body: {}, user: READER });
    expect(missing.statusCode).toBe(400);
    expect(missing.payload.error).toContain('Thiếu bookId');
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  test('UT-LN-21 lỗi giao dịch → 500, thông điệp "giao dịch đã được hủy an toàn"', async () => {
    arrange();
    mocks.prisma.$transaction.mockRejectedValue(new Error('db'));
    const res = await callHandler(borrowBook, { body: { bookId: 100 }, user: READER });
    expect(res.statusCode).toBe(500);
    expect(res.payload.error).toContain('hủy an toàn');
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  test('UT-LN-22 phiếu tạo ra thiếu thông tin sách → thông báo dùng tên "Sách"', async () => {
    arrange();
    mocks.prisma.loan.create.mockImplementation(async ({ data }: any) => loanOf({ ...data, bookItem: null }));
    await callHandler(borrowBook, { body: { bookId: 100 }, user: READER });
    expect(mocks.createNotification.mock.calls[0][0].message).toContain('"Sách"');
  });

  // KNOWN BUG DEF-005 — đặc tả: STANDARD 14 / PREMIUM 30 / LECTURER 60 ngày; hệ thống luôn +14 ngày.
  test.fails('UT-LN-23 (DEF-005) độc giả PREMIUM mượn → hạn trả +30 ngày', async () => {
    arrange();
    mocks.prisma.user.findUnique.mockResolvedValue(userOf([], { membershipTier: 'PREMIUM' }));
    await callHandler(borrowBook, { body: { bookId: 100 }, user: READER });
    const due = mocks.prisma.loan.create.mock.calls[0][0].data.dueDate as Date;
    expect(due.getTime() - NOW.getTime()).toBe(30 * DAY);
  });
});

// ---------------------------------------------------------------- lookupBarcode
describe('lookupBarcode — GET /loans/barcode/:barcode', () => {
  const found = (loans: unknown[] = []) => ({
    id: 10, barcode: 'BC-1', location: 'Kệ A', status: 'BORROWED',
    book: { id: 100, title: 'Sách', isbn: 'I', coverImage: 'c', author: { name: 'TG' }, category: { name: 'TL' }, publisher: { name: 'NXB' } },
    loans,
  });

  test.each([['UT-LN-24a rỗng', ''], ['UT-LN-24b chỉ khoảng trắng', '   ']])('%s → 400 thiếu mã vạch', async (_id, barcode) => {
    const res = await callHandler(lookupBarcode, { params: { barcode }, user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.bookItem.findUnique).not.toHaveBeenCalled();
  });

  test('UT-LN-25 không tìm thấy → 404 nêu mã vạch', async () => {
    mocks.prisma.bookItem.findUnique.mockResolvedValue(null);
    const res = await callHandler(lookupBarcode, { params: { barcode: 'BC-X' }, user: ADMIN });
    expect(res.statusCode).toBe(404);
    expect(res.payload.error).toContain('BC-X');
  });

  test('UT-LN-26 bản đang được mượn → trả thông tin sách, bản sao và phiếu mượn đang hoạt động (người mượn)', async () => {
    mocks.prisma.bookItem.findUnique.mockResolvedValue(found([{ id: 5, borrowDate: NOW, dueDate: NOW, status: 'ACTIVE', user: { id: 2, name: 'Độc giả', email: 'r@t' } }]));
    const res = await callHandler(lookupBarcode, { params: { barcode: ' BC-1 ' }, user: ADMIN });
    expect(mocks.prisma.bookItem.findUnique.mock.calls[0][0].where).toEqual({ barcode: 'BC-1' });
    expect(res.payload.book).toMatchObject({ title: 'Sách', author: 'TG', category: 'TL', publisher: 'NXB' });
    expect(res.payload.activeLoan).toMatchObject({ id: 5, status: 'ACTIVE', user: { name: 'Độc giả' } });
  });

  test('UT-LN-27 bản chưa ai mượn → activeLoan = null; tác giả/thể loại/NXB thiếu → chuỗi rỗng', async () => {
    const item = found([]);
    item.book.author = null as any; item.book.category = null as any; item.book.publisher = null as any;
    mocks.prisma.bookItem.findUnique.mockResolvedValue(item);
    const res = await callHandler(lookupBarcode, { params: { barcode: 'BC-1' }, user: ADMIN });
    expect(res.payload.activeLoan).toBeNull();
    expect(res.payload.book).toMatchObject({ author: '', category: '', publisher: '' });
  });

  test('UT-LN-28 lỗi DB → 500', async () => {
    mocks.prisma.bookItem.findUnique.mockRejectedValue(new Error('db'));
    expect((await callHandler(lookupBarcode, { params: { barcode: 'BC-1' }, user: ADMIN })).statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------- getMyLoans / getAllLoans / triggerReminders
describe('getMyLoans / getAllLoans', () => {
  test('UT-LN-29 getMyLoans: chưa đăng nhập → 401; chỉ lấy phiếu của người gọi, mới nhất trước, đã định dạng', async () => {
    expect((await callHandler(getMyLoans, {})).statusCode).toBe(401);
    mocks.prisma.loan.findMany.mockResolvedValue([loanOf()]);
    const res = await callHandler(getMyLoans, { user: READER });
    expect(mocks.prisma.loan.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 2 }, orderBy: { borrowDate: 'desc' } });
    expect(res.payload[0]).toMatchObject({ id: 50, status: 'On Time', rawStatus: 'ACTIVE' });
  });

  test('UT-LN-30 getAllLoans: USER → 403; ADMIN → toàn bộ phiếu', async () => {
    expect((await callHandler(getAllLoans, { user: READER })).statusCode).toBe(403);
    expect(mocks.prisma.loan.findMany).not.toHaveBeenCalled();
    mocks.prisma.loan.findMany.mockResolvedValue([loanOf({ id: 1 }), loanOf({ id: 2 })]);
    const res = await callHandler(getAllLoans, { user: ADMIN });
    expect(res.payload.map((l: any) => l.id)).toEqual([1, 2]);
    expect(mocks.prisma.loan.findMany.mock.calls[0][0]).not.toHaveProperty('where');
  });

  test('UT-LN-31 lỗi DB → 500 ở cả hai', async () => {
    mocks.prisma.loan.findMany.mockRejectedValue(new Error('db'));
    expect((await callHandler(getMyLoans, { user: READER })).statusCode).toBe(500);
    expect((await callHandler(getAllLoans, { user: ADMIN })).statusCode).toBe(500);
  });
});

describe('triggerReminders — POST /loans/reminders/trigger', () => {
  test('UT-LN-32 USER → 403, không chạy quét', async () => {
    expect((await callHandler(triggerReminders, { user: READER })).statusCode).toBe(403);
    expect(mocks.scanAndSendReminders).not.toHaveBeenCalled();
  });

  test('UT-LN-33 ADMIN → chạy quét một lần và trả báo cáo + thông điệp tóm tắt', async () => {
    const report = { emailsSent: 3, dueSoonCount: 2, overdueCount: 1 };
    mocks.scanAndSendReminders.mockResolvedValue(report);
    const res = await callHandler(triggerReminders, { user: ADMIN });
    expect(mocks.scanAndSendReminders).toHaveBeenCalledTimes(1);
    expect(res.payload.report).toEqual(report);
    expect(res.payload.message).toContain('3 email');
  });

  test('UT-LN-34 quét lỗi → 500 kèm chi tiết', async () => {
    mocks.scanAndSendReminders.mockRejectedValue(new Error('smtp down'));
    const res = await callHandler(triggerReminders, { user: ADMIN });
    expect(res.statusCode).toBe(500);
    expect(res.payload.details).toBe('smtp down');
  });
});
