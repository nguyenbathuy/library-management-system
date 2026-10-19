/**
 * Mục tiêu: kiểm thử đơn vị State Machine của Loan (ACTIVE / OVERDUE / LOST_PENDING_PAYMENT /
 *   COMPLETED, renewalStatus NONE / PENDING / APPROVED / REJECTED) và BookItem (AVAILABLE /
 *   BORROWED / LOST / DAMAGED) qua các handler thật của loanController.
 * Kỹ thuật: kiểm thử chuyển trạng thái (state transition testing) — mỗi ca là một cặp
 *   (trạng thái nguồn, sự kiện) → trạng thái đích hoặc bị chặn; Prisma, notification được mock
 *   TRƯỚC khi import controller (vi.hoisted + vi.mock, alias prismaGuard chặn Prisma thật).
 * Ranh giới: chỉ chứng minh controller → lời gọi Prisma; KHÔNG chứng minh ghi SQLite thật
 *   (xem tests/integration/loans.api.test.ts).
 * Liên kết hộp đen (theo brief): BOR-01, BOR-06, RET-01, RET-10, EXT-01 (đã khớp mô tả trong brief);
 *   BOR-10, EXT-03, EXT-04 (brief nêu liên kết, chưa đối chiếu nội dung ca Chương 3).
 * Ca `test.fails` = viết theo đặc tả đúng, hệ thống hiện sai: DEF-004/005/006/008/009/010/011.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../../src/middleware/auth';

const mocks = vi.hoisted(() => {
  const delegate = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    user: delegate('findUnique'),
    bookItem: delegate('findUnique', 'findFirst', 'update', 'count'),
    loan: delegate('create', 'update', 'findUnique', 'findFirst', 'findMany'),
    reservation: delegate('findFirst', 'update'),
    auditLog: delegate('create'),
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return {
    prisma,
    PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }),
    createNotification: vi.fn(),
  };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));
vi.mock('../../../src/services/notificationService', () => ({ createNotification: mocks.createNotification }));

import { PrismaClient } from '@prisma/client';
import {
  approveRenewLoan, borrowByBarcode, rejectRenewLoan, reportLost,
  requestRenewLoan, returnBook, returnByBarcode,
} from '../../../src/controllers/loanController';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-14T09:00:00+07:00');
const ADMIN = { userId: 1, email: 'admin@test.local', role: 'ADMIN' };
const READER = { userId: 2, email: 'reader@test.local', role: 'USER' };

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>;

function makeReader(overrides: Record<string, unknown> = {}) {
  return { id: 2, email: 'reader@test.local', name: 'Độc giả Test', role: 'USER', membershipTier: 'STANDARD', isBlacklisted: false, loans: [], ...overrides };
}
function makeItem(overrides: Record<string, unknown> = {}) {
  return { id: 10, bookId: 100, barcode: 'BC-UT-01', location: 'Kệ A', status: 'AVAILABLE', book: { id: 100, title: 'Sách kiểm thử' }, ...overrides };
}
function makeLoan(overrides: Record<string, unknown> = {}) {
  return {
    id: 50, userId: 2, bookItemId: 10, borrowDate: new Date(NOW.getTime() - 3 * DAY),
    dueDate: new Date(NOW.getTime() + 11 * DAY), returnDate: null, status: 'ACTIVE',
    fineAmount: 0, compensationAmount: 0, isFinePaid: false, renewalStatus: 'NONE',
    bookItem: makeItem({ status: 'BORROWED', book: { id: 100, title: 'Sách kiểm thử', items: [] } }),
    user: makeReader(),
    ...overrides,
  };
}

async function call(handler: Handler, { body = {}, params = {}, user }: { body?: object; params?: object; user?: AuthRequest['user'] }) {
  const actual: { statusCode: number; payload?: any } = { statusCode: 200 };
  const res: any = {
    status: vi.fn((code: number) => { actual.statusCode = code; return res; }),
    json: vi.fn((payload: unknown) => { actual.payload = payload; return res; }),
  };
  await handler({ body, params, user, headers: {} } as unknown as AuthRequest, res as Response);
  expect(res.json).toHaveBeenCalledTimes(1);
  return actual;
}

/** Loan.update/BookItem.update data đã được gửi trong lần $transaction gần nhất. */
const writes = () => ({
  loan: mocks.prisma.loan.update.mock.calls.map(([arg]) => arg.data),
  item: mocks.prisma.bookItem.update.mock.calls.map(([arg]) => arg.data),
  created: mocks.prisma.loan.create.mock.calls.map(([arg]) => arg.data),
});

function expectNoStateWrite() {
  expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  expect(mocks.prisma.loan.create).not.toHaveBeenCalled();
  expect(mocks.prisma.bookItem.update).not.toHaveBeenCalled();
}

beforeAll(() => {
  // Isolation gate: controller import must have built exactly one mocked client, no queries yet.
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const all = [
    ...Object.values(mocks.prisma.user), ...Object.values(mocks.prisma.bookItem),
    ...Object.values(mocks.prisma.loan), ...Object.values(mocks.prisma.reservation),
    ...Object.values(mocks.prisma.auditLog), mocks.prisma.$transaction,
    mocks.prisma.$connect, mocks.prisma.$disconnect, mocks.createNotification,
  ];
  for (const fn of all) {
    fn.mockReset();
    fn.mockImplementation(() => { throw new Error('Unconfigured mock call: arrange this dependency.'); });
  }
  // Common happy-path plumbing; individual tests override what they assert on.
  mocks.prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  mocks.prisma.bookItem.update.mockImplementation(async ({ data }: any) => makeItem(data));
  mocks.prisma.bookItem.count.mockResolvedValue(2);
  mocks.prisma.reservation.findFirst.mockResolvedValue(null);
  mocks.createNotification.mockResolvedValue({ id: 1 });
});

afterAll(() => {
  vi.useRealTimers();
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------- Mượn
describe('Mượn sách qua barcode — BookItem AVAILABLE → BORROWED, Loan → ACTIVE', () => {
  function arrangeBorrow(item = makeItem(), reader = makeReader()) {
    mocks.prisma.bookItem.findUnique.mockResolvedValue(item);
    mocks.prisma.user.findUnique.mockResolvedValue(reader);
    mocks.prisma.loan.create.mockImplementation(async ({ data }: any) => makeLoan({ ...data, id: 77 }));
    mocks.prisma.auditLog.create.mockResolvedValue({ id: 1 });
  }

  test('SM-01 (BOR-01) AVAILABLE + độc giả hợp lệ → item BORROWED, loan ACTIVE, renewal NONE, phạt 0', async () => {
    arrangeBorrow();
    const actual = await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: ADMIN });
    expect(actual.statusCode).toBe(200);
    expect(writes().item).toEqual([{ status: 'BORROWED' }]);
    expect(writes().created[0]).toMatchObject({ userId: 2, bookItemId: 10, status: 'ACTIVE', fineAmount: 0, isFinePaid: false, renewalStatus: 'NONE' });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['SM-02 (BOR-06)', 'BORROWED'],
    ['SM-03', 'LOST'],
    ['SM-04', 'DAMAGED'],
  ])('%s BookItem %s → chặn 400, không đổi trạng thái', async (_id, status) => {
    arrangeBorrow(makeItem({ status }));
    const actual = await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: ADMIN });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload.error).toContain(status);
    expectNoStateWrite();
  });

  test('SM-05 độc giả trong Blacklist → 403, không tạo phiếu', async () => {
    arrangeBorrow(makeItem(), makeReader({ isBlacklisted: true }));
    const actual = await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: ADMIN });
    expect(actual.statusCode).toBe(403);
    expectNoStateWrite();
  });

  test('SM-06 (BOR-10) độc giả đang có phiếu OVERDUE → 400, không tạo phiếu', async () => {
    arrangeBorrow(makeItem(), makeReader({ loans: [makeLoan({ status: 'OVERDUE', dueDate: new Date(NOW.getTime() - 2 * DAY) })] }));
    const actual = await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: ADMIN });
    expect(actual.statusCode).toBe(400);
    expectNoStateWrite();
  });

  test('SM-07 STANDARD đã mượn 5 cuốn (biên hạn mức) → 400, không tạo phiếu', async () => {
    const loans = Array.from({ length: 5 }, (_, i) => makeLoan({ id: 60 + i }));
    arrangeBorrow(makeItem(), makeReader({ loans }));
    const actual = await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: ADMIN });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload.error).toContain('5/5');
    expectNoStateWrite();
  });

  test('SM-08 STANDARD đang mượn 4 cuốn (dưới biên 1) → được mượn', async () => {
    const loans = Array.from({ length: 4 }, (_, i) => makeLoan({ id: 60 + i }));
    arrangeBorrow(makeItem(), makeReader({ loans }));
    const actual = await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: ADMIN });
    expect(actual.statusCode).toBe(200);
  });

  test('SM-09 USER tự gọi borrow-by-barcode → 403 (chỉ thủ thư)', async () => {
    const actual = await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: READER });
    expect(actual.statusCode).toBe(403);
    expectNoStateWrite();
  });

  // KNOWN BUG DEF-004
  test.fails('SM-10 mượn thành công phải ghi AuditLog (DEF-004)', async () => {
    arrangeBorrow();
    await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: ADMIN });
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  // KNOWN BUG DEF-005
  test.fails('SM-11 độc giả PREMIUM → dueDate = ngày mượn + 30 ngày (DEF-005)', async () => {
    arrangeBorrow(makeItem(), makeReader({ membershipTier: 'PREMIUM' }));
    await call(borrowByBarcode, { body: { barcode: 'BC-UT-01', userId: 2 }, user: ADMIN });
    const { dueDate } = writes().created[0];
    expect(Math.round((dueDate.getTime() - NOW.getTime()) / DAY)).toBe(30);
  });
});

// ---------------------------------------------------------------- Trả
describe('Trả sách — Loan ACTIVE → COMPLETED / chờ nộp phạt, BookItem → AVAILABLE', () => {
  function arrangeReturn(loan: ReturnType<typeof makeLoan> | null) {
    mocks.prisma.bookItem.findUnique.mockResolvedValue(makeItem({ status: 'BORROWED' }));
    mocks.prisma.loan.findFirst.mockResolvedValue(loan);
    mocks.prisma.loan.update.mockImplementation(async ({ data }: any) => makeLoan({ ...loan, ...data }));
  }

  test('SM-12 (RET-01) trả đúng hạn → loan COMPLETED, returnDate = now, phạt 0, item AVAILABLE', async () => {
    arrangeReturn(makeLoan());
    const actual = await call(returnByBarcode, { body: { barcode: 'BC-UT-01' }, user: ADMIN });
    expect(actual.statusCode).toBe(200);
    expect(writes().loan).toEqual([{ returnDate: NOW, status: 'COMPLETED', fineAmount: 0 }]);
    expect(writes().item).toEqual([{ status: 'AVAILABLE' }]);
  });

  test('SM-13 trả trễ 3 ngày → phạt 15.000 đ được ghi vào phiếu, item AVAILABLE', async () => {
    arrangeReturn(makeLoan({ dueDate: new Date(NOW.getTime() - 3 * DAY) }));
    await call(returnByBarcode, { body: { barcode: 'BC-UT-01' }, user: ADMIN });
    expect(writes().loan[0]).toMatchObject({ returnDate: NOW, fineAmount: 15000 });
    expect(writes().item).toEqual([{ status: 'AVAILABLE' }]);
  });

  // KNOWN BUG DEF-006: hệ thống giữ OVERDUE thay vì PENDING_FINE_PAYMENT.
  test.fails('SM-14 trả trễ chưa nộp phạt → loan PENDING_FINE_PAYMENT (DEF-006)', async () => {
    arrangeReturn(makeLoan({ dueDate: new Date(NOW.getTime() - 3 * DAY) }));
    await call(returnByBarcode, { body: { barcode: 'BC-UT-01' }, user: ADMIN });
    expect(writes().loan[0].status).toBe('PENDING_FINE_PAYMENT');
  });

  test('SM-15 (RET-10) quét trả cuốn không còn phiếu mở → 400, không ghi', async () => {
    arrangeReturn(null);
    const actual = await call(returnByBarcode, { body: { barcode: 'BC-UT-01' }, user: ADMIN });
    expect(actual.statusCode).toBe(400);
    expectNoStateWrite();
  });

  test('SM-16 (RET-10) trả theo loanId phiếu đã COMPLETED → 400 "đã hoàn tất"', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(makeLoan({ status: 'COMPLETED', returnDate: NOW }));
    const actual = await call(returnBook, { body: { loanId: 50 }, user: ADMIN });
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Phiếu mượn này đã hoàn tất trước đó' } });
    expectNoStateWrite();
  });
});

// ---------------------------------------------------------------- Báo mất
describe('Báo mất — Loan → LOST_PENDING_PAYMENT, BookItem → LOST', () => {
  test('SM-17 phiếu ACTIVE báo mất 120.000 đ → LOST_PENDING_PAYMENT, item LOST, nợ = bồi thường', async () => {
    const loan = makeLoan();
    mocks.prisma.loan.findUnique.mockResolvedValue(loan);
    mocks.prisma.loan.update.mockImplementation(async ({ data }: any) => makeLoan({ ...loan, ...data }));
    const actual = await call(reportLost, { params: { id: '50' }, body: { compensationAmount: 120000 }, user: ADMIN });
    expect(actual.statusCode).toBe(200);
    expect(writes().loan[0]).toMatchObject({ status: 'LOST_PENDING_PAYMENT', compensationAmount: 120000, fineAmount: 120000, isFinePaid: false });
    expect(writes().item).toEqual([{ status: 'LOST' }]);
  });

  test.each([
    ['SM-18', { status: 'COMPLETED' }],
    ['SM-19', { status: 'LOST_PENDING_PAYMENT' }],
  ])('%s báo mất phiếu ở trạng thái kết thúc %o → 400', async (_id, state) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(makeLoan(state));
    const actual = await call(reportLost, { params: { id: '50' }, body: { compensationAmount: 1000 }, user: ADMIN });
    expect(actual.statusCode).toBe(400);
    expectNoStateWrite();
  });

  test('SM-20 số tiền bồi thường âm → 400 trước khi truy vấn phiếu', async () => {
    const actual = await call(reportLost, { params: { id: '50' }, body: { compensationAmount: -1 }, user: ADMIN });
    expect(actual.statusCode).toBe(400);
    expect(mocks.prisma.loan.findUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- Gia hạn
describe('Gia hạn — renewalStatus NONE → PENDING → APPROVED / REJECTED', () => {
  function arrangeLoan(loan: ReturnType<typeof makeLoan>) {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan);
    mocks.prisma.loan.update.mockImplementation(async ({ data }: any) => makeLoan({ ...loan, ...data }));
    mocks.prisma.reservation.findFirst.mockResolvedValue(null);
  }

  test('SM-21 (EXT-01) độc giả gửi gia hạn trước hạn → renewalStatus PENDING', async () => {
    arrangeLoan(makeLoan());
    const actual = await call(requestRenewLoan, { params: { id: '50' }, user: READER });
    expect(actual.statusCode).toBe(200);
    expect(writes().loan).toEqual([{ renewalStatus: 'PENDING' }]);
  });

  test('SM-22 (EXT-03) gửi lại khi đang PENDING → 400', async () => {
    arrangeLoan(makeLoan({ renewalStatus: 'PENDING' }));
    const actual = await call(requestRenewLoan, { params: { id: '50' }, user: READER });
    expect(actual.statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test('SM-23 (EXT-04) phiếu đã quá hạn → không cho gửi gia hạn (400)', async () => {
    arrangeLoan(makeLoan({ dueDate: new Date(NOW.getTime() - DAY) }));
    const actual = await call(requestRenewLoan, { params: { id: '50' }, user: READER });
    expect(actual.statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test('SM-24 độc giả khác gửi gia hạn phiếu không phải của mình → 403', async () => {
    arrangeLoan(makeLoan({ userId: 99 }));
    const actual = await call(requestRenewLoan, { params: { id: '50' }, user: READER });
    expect(actual.statusCode).toBe(403);
  });

  test('SM-25 phiếu đã COMPLETED → không gia hạn (400)', async () => {
    arrangeLoan(makeLoan({ status: 'COMPLETED', returnDate: NOW }));
    const actual = await call(requestRenewLoan, { params: { id: '50' }, user: READER });
    expect(actual.statusCode).toBe(400);
  });

  test('SM-26 thủ thư duyệt yêu cầu PENDING → renewalStatus APPROVED, loan ACTIVE', async () => {
    arrangeLoan(makeLoan({ renewalStatus: 'PENDING' }));
    const actual = await call(approveRenewLoan, { params: { id: '50' }, user: ADMIN });
    expect(actual.statusCode).toBe(200);
    expect(writes().loan[0]).toMatchObject({ renewalStatus: 'APPROVED', status: 'ACTIVE' });
  });

  // KNOWN BUG DEF-008
  test.fails('SM-27 duyệt gia hạn → dueDate mới = dueDate cũ + 14 ngày (DEF-008)', async () => {
    const loan = makeLoan({ renewalStatus: 'PENDING' });
    arrangeLoan(loan);
    await call(approveRenewLoan, { params: { id: '50' }, user: ADMIN });
    const newDue: Date = writes().loan[0].dueDate;
    expect(Math.round((newDue.getTime() - loan.dueDate.getTime()) / DAY)).toBe(14);
  });

  // KNOWN BUG DEF-009
  test.fails('SM-28 phiếu đã được gia hạn 1 lần (APPROVED) → gửi gia hạn lần 2 bị chặn 400 (DEF-009)', async () => {
    arrangeLoan(makeLoan({ renewalStatus: 'APPROVED' }));
    const actual = await call(requestRenewLoan, { params: { id: '50' }, user: READER });
    expect(actual.statusCode).toBe(400);
  });

  // KNOWN BUG DEF-011
  test.fails('SM-29 độc giả còn nợ phạt chưa nộp → không được duyệt gia hạn (DEF-011)', async () => {
    arrangeLoan(makeLoan({ renewalStatus: 'PENDING' }));
    mocks.prisma.user.findUnique.mockResolvedValue(makeReader({
      loans: [makeLoan({ id: 51, status: 'OVERDUE', fineAmount: 15000, isFinePaid: false, returnDate: NOW })],
    }));
    const actual = await call(approveRenewLoan, { params: { id: '50' }, user: ADMIN });
    expect(actual.statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test('SM-30 thủ thư từ chối → renewalStatus REJECTED', async () => {
    arrangeLoan(makeLoan({ renewalStatus: 'PENDING' }));
    const actual = await call(rejectRenewLoan, { params: { id: '50' }, body: { reason: 'Có người đặt trước' }, user: ADMIN });
    expect(actual.statusCode).toBe(200);
    expect(writes().loan[0]).toMatchObject({ renewalStatus: 'REJECTED' });
  });

  // KNOWN BUG DEF-010
  test.fails('SM-31 lý do từ chối phải được gửi tới độc giả (DEF-010)', async () => {
    arrangeLoan(makeLoan({ renewalStatus: 'PENDING' }));
    await call(rejectRenewLoan, { params: { id: '50' }, body: { reason: 'Có người đặt trước' }, user: ADMIN });
    expect(mocks.createNotification.mock.calls[0][0].message).toContain('Có người đặt trước');
  });

  test('SM-32 duyệt phiếu đã COMPLETED → 400, không ghi', async () => {
    arrangeLoan(makeLoan({ status: 'COMPLETED', returnDate: NOW }));
    const actual = await call(approveRenewLoan, { params: { id: '50' }, user: ADMIN });
    expect(actual.statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });
});
