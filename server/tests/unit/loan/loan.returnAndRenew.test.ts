/**
 * Mục tiêu: bổ sung kiểm thử đơn vị cho loanController — trả sách theo mã phiếu (returnBook), các nhánh còn lại của trả theo
 *   barcode (returnByBarcode), báo mất (reportLost) và vòng đời gia hạn (requestRenewLoan / approveRenewLoan / rejectRenewLoan).
 * Kỹ thuật: kiểm thử chuyển trạng thái + phân vùng tương đương (nợ phạt / đã nộp / đền bù / có người đặt trước) + giá trị biên
 *   (đúng hạn, trễ 3 ngày). Oracle ngày gia hạn là "trung tính" (hạn mới sau hạn cũ, giữ giờ) để không phụ thuộc DEF-008.
 *   Prisma và notificationService được mock TRƯỚC khi import controller; không gọi mạng/DB thật.
 * Ranh giới: chỉ chứng minh controller → lời gọi Prisma/notification; KHÔNG chứng minh ghi SQLite (xem tests/integration/loans.*).
 * Liên kết hộp đen: RET-01, RET-10, EXT-01/03/04 theo brief (đã khớp mô tả ở loan.stateMachine.test.ts).
 * test.fails: NEW FINDING FIND-21 (trả lại phiếu đã có returnDate bằng loanId), FIND-22 (duyệt/từ chối gia hạn khi chưa có yêu cầu
 *   PENDING, hoặc từ chối phiếu đã kết thúc) — căn cứ: máy trạng thái NONE → PENDING → APPROVED/REJECTED ghi ở loan.stateMachine.test.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { callHandler, resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    bookItem: d('findUnique', 'update', 'count'),
    loan: d('findUnique', 'findFirst', 'update'),
    reservation: d('findFirst', 'update'),
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { prisma, PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }), createNotification: vi.fn() };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));
vi.mock('../../../src/services/notificationService', () => ({ createNotification: mocks.createNotification }));

import { PrismaClient } from '@prisma/client';
import {
  approveRenewLoan, rejectRenewLoan, renewLoan, reportLost, requestRenewLoan, returnBook, returnByBarcode,
} from '../../../src/controllers/loanController';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-14T09:00:00+07:00');
const ADMIN = { userId: 1, email: 'admin@test.local', role: 'ADMIN' };
const READER = { userId: 2, email: 'reader@test.local', role: 'USER' };
const OTHER = { userId: 3, email: 'other@test.local', role: 'USER' };

const bookOf = () => ({ id: 100, title: 'Sách trả', isbn: 'I', coverImage: 'c', author: { name: 'TG' }, category: { name: 'TL' }, items: [] });
const loanOf = (overrides: Record<string, unknown> = {}) => ({
  id: 50, userId: 2, bookItemId: 10, borrowDate: new Date(NOW.getTime() - 3 * DAY), dueDate: new Date(NOW.getTime() + 11 * DAY),
  returnDate: null, status: 'ACTIVE', fineAmount: 0, compensationAmount: 0, isFinePaid: false, renewalStatus: 'NONE',
  bookItem: { id: 10, bookId: 100, barcode: 'BC-1', location: 'Kệ A', status: 'BORROWED', book: bookOf() },
  user: { id: 2, name: 'Độc giả', email: 'reader@test.local' },
  ...overrides,
});
const late = (days = 3, overrides: Record<string, unknown> = {}) => loanOf({ dueDate: new Date(NOW.getTime() - days * DAY), ...overrides });

const loanWrites = () => mocks.prisma.loan.update.mock.calls.map(([arg]) => arg.data);
const itemWrites = () => mocks.prisma.bookItem.update.mock.calls.map(([arg]) => arg.data);
const titles = () => mocks.createNotification.mock.calls.map(([arg]) => arg.title);

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
    ...Object.values(mocks.prisma.bookItem), ...Object.values(mocks.prisma.loan), ...Object.values(mocks.prisma.reservation),
    mocks.prisma.$transaction, mocks.prisma.$connect, mocks.prisma.$disconnect, mocks.createNotification,
  ]);
  mocks.prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  mocks.prisma.loan.update.mockImplementation(async ({ data, where }: any) => loanOf({ id: where.id, ...data }));
  mocks.prisma.bookItem.update.mockResolvedValue({});
  mocks.prisma.bookItem.count.mockResolvedValue(1);
  mocks.prisma.reservation.findFirst.mockResolvedValue(null);
  mocks.createNotification.mockResolvedValue({ id: 1 });
});

afterAll(() => {
  vi.useRealTimers();
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------- returnBook
describe('returnBook — POST /loans/return (theo mã phiếu)', () => {
  const run = (loan: unknown, body: object = { loanId: 50 }, user = ADMIN) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan);
    return callHandler(returnBook, { body, user });
  };

  test('UT-RT-01 USER → 403; thiếu loanId → 400; không tìm thấy phiếu → 404; không ghi gì', async () => {
    expect((await callHandler(returnBook, { body: { loanId: 50 }, user: READER })).statusCode).toBe(403);
    expect((await callHandler(returnBook, { body: {}, user: ADMIN })).statusCode).toBe(400);
    expect((await run(null)).statusCode).toBe(404);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  test('UT-RT-02 (RET-01) trả đúng hạn → loan COMPLETED, phạt 0, returnDate = now, bản sao AVAILABLE, thông báo "Trả sách thành công"', async () => {
    const res = await run(loanOf());
    expect(res.statusCode).toBe(200);
    expect(loanWrites()).toEqual([{ returnDate: NOW, status: 'COMPLETED', fineAmount: 0 }]);
    expect(itemWrites()).toEqual([{ status: 'AVAILABLE' }]);
    expect(titles()).toEqual(['Trả sách thành công']);
    expect(res.payload).toMatchObject({ rawStatus: 'COMPLETED', status: 'Returned', availableCopies: 1, reservationNotice: null });
  });

  test('UT-RT-03 trả trễ 3 ngày chưa nộp phạt → phạt 15.000 và phiếu giữ OVERDUE (chờ nộp phạt); thông báo nêu số tiền', async () => {
    await run(late(3));
    expect(loanWrites()).toEqual([{ returnDate: NOW, status: 'OVERDUE', fineAmount: 15000 }]);
    expect(itemWrites()).toEqual([{ status: 'AVAILABLE' }]);
    expect(titles()).toEqual(['Đã nhận lại sách (Chờ nộp phạt)']);
    expect(mocks.createNotification.mock.calls[0][0].message).toContain('15.000');
  });

  test('UT-RT-04 trễ nhưng phiếu đã nộp phạt → COMPLETED, giữ nguyên fineAmount trong DB', async () => {
    await run(late(3, { isFinePaid: true, fineAmount: 15000 }));
    expect(loanWrites()).toEqual([{ returnDate: NOW, status: 'COMPLETED', fineAmount: 15000 }]);
  });

  test('UT-RT-05 phạt đã ghi trong DB lớn hơn phạt tính theo ngày → giữ giá trị lớn hơn (max)', async () => {
    await run(late(3, { fineAmount: 40000 }));
    expect(loanWrites()[0]).toMatchObject({ status: 'OVERDUE', fineAmount: 40000 });
    await run(late(5, { fineAmount: 10000 }));
    expect(loanWrites()[1]).toMatchObject({ status: 'OVERDUE', fineAmount: 25000 });
  });

  test('UT-RT-06 còn nợ tiền đền bù (dù đúng hạn, phạt 0) → giữ OVERDUE, không đóng phiếu', async () => {
    await run(loanOf({ compensationAmount: 80000 }));
    expect(loanWrites()[0]).toMatchObject({ status: 'OVERDUE', fineAmount: 0 });
  });

  test('UT-RT-07 đã nộp xong (isFinePaid) kể cả có đền bù → COMPLETED', async () => {
    await run(loanOf({ compensationAmount: 80000, isFinePaid: true }));
    expect(loanWrites()[0].status).toBe('COMPLETED');
  });

  test('UT-RT-08 có độc giả đang đặt trước (WAITING) → chuyển NOTIFIED, thông báo cho người đặt, trả reservationNotice', async () => {
    mocks.prisma.reservation.findFirst.mockResolvedValue({ id: 7, userId: 9, user: { name: 'Người đặt', email: 'wait@test.local' } });
    mocks.prisma.reservation.update.mockResolvedValue({});
    const res = await run(loanOf());
    expect(mocks.prisma.reservation.findFirst.mock.calls[0][0]).toMatchObject({ where: { bookId: 100, status: 'WAITING' }, orderBy: { createdAt: 'asc' } });
    expect(mocks.prisma.reservation.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: 'NOTIFIED' } });
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, title: 'Sách bạn đặt trước đã có sẵn!' }));
    expect(titles()).toEqual(['Sách bạn đặt trước đã có sẵn!', 'Trả sách thành công']);
    expect(res.payload.reservationNotice).toEqual({ userName: 'Người đặt', userEmail: 'wait@test.local' });
  });

  test('UT-RT-09 phiếu trả về thiếu thông tin sách → thông báo dùng tên "Sách"', async () => {
    mocks.prisma.loan.update.mockImplementation(async ({ data, where }: any) => loanOf({ id: where.id, ...data, bookItem: null }));
    await run(loanOf());
    expect(mocks.createNotification.mock.calls[0][0].message).toContain('"Sách"');
  });

  test('UT-RT-10 lỗi giao dịch → 500, không gửi thông báo', async () => {
    mocks.prisma.$transaction.mockRejectedValue(new Error('db'));
    const res = await run(loanOf());
    expect(res.statusCode).toBe(500);
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  // NEW FINDING FIND-21 — returnBook chỉ chặn phiếu COMPLETED. Phiếu đã trả nhưng còn nợ phạt (status OVERDUE, returnDate đã có)
  // vẫn được "trả" lần nữa → BookItem bị đặt lại AVAILABLE dù có thể đã được người khác mượn.
  test.fails('UT-RT-11 (FIND-21, RET-10) phiếu đã có returnDate (đã trả, còn nợ phạt) không được trả lần hai bằng loanId', async () => {
    const res = await run(late(3, { returnDate: new Date(NOW.getTime() - DAY), status: 'OVERDUE', fineAmount: 15000 }));
    expect(res.statusCode).toBe(400);
    expect(itemWrites()).toEqual([]);
  });
});

// ---------------------------------------------------------------- returnByBarcode (các nhánh còn lại)
describe('returnByBarcode — POST /loans/return-by-barcode', () => {
  const arrange = (loan: unknown, item: unknown = { id: 10, bookId: 100, barcode: 'BC-1', book: bookOf() }) => {
    mocks.prisma.bookItem.findUnique.mockResolvedValue(item);
    mocks.prisma.loan.findFirst.mockResolvedValue(loan);
  };

  test('UT-RB-01 USER → 403; thiếu mã vạch → 400; mã vạch không tồn tại → 404', async () => {
    expect((await callHandler(returnByBarcode, { body: { barcode: 'BC-1' }, user: READER })).statusCode).toBe(403);
    expect((await callHandler(returnByBarcode, { body: {}, user: ADMIN })).statusCode).toBe(400);
    mocks.prisma.bookItem.findUnique.mockResolvedValue(null);
    const res = await callHandler(returnByBarcode, { body: { barcode: 'KHONG-CO' }, user: ADMIN });
    expect(res.statusCode).toBe(404);
    expect(res.payload.error).toContain('KHONG-CO');
  });

  test('UT-RB-02 mã vạch được trim; chỉ tìm phiếu chưa trả với trạng thái ACTIVE/OVERDUE/BORROWING', async () => {
    arrange(loanOf());
    await callHandler(returnByBarcode, { body: { barcode: '  BC-1  ' }, user: ADMIN });
    expect(mocks.prisma.bookItem.findUnique.mock.calls[0][0].where).toEqual({ barcode: 'BC-1' });
    expect(mocks.prisma.loan.findFirst.mock.calls[0][0].where).toEqual({ bookItemId: 10, returnDate: null, status: { in: ['ACTIVE', 'OVERDUE', 'BORROWING'] } });
  });

  test('UT-RB-03 (RET-01) trả đúng hạn → COMPLETED; thông điệp không có phần "Phạt trễ hạn"; thông báo "Thu hồi sách thành công"', async () => {
    arrange(loanOf());
    const res = await callHandler(returnByBarcode, { body: { barcode: 'BC-1' }, user: ADMIN });
    expect(loanWrites()).toEqual([{ returnDate: NOW, status: 'COMPLETED', fineAmount: 0 }]);
    expect(res.payload.message).toBe('Thu hồi thành công: "Sách trả" từ Độc giả');
    expect(titles()).toEqual(['Thu hồi sách thành công']);
  });

  test('UT-RB-04 trả trễ chưa nộp phạt → OVERDUE; thông điệp nêu số tiền phạt; thông báo "Chờ nộp phạt"', async () => {
    arrange(late(3));
    const res = await callHandler(returnByBarcode, { body: { barcode: 'BC-1' }, user: ADMIN });
    expect(loanWrites()[0]).toMatchObject({ status: 'OVERDUE', fineAmount: 15000 });
    expect(res.payload.message).toContain('Phạt trễ hạn: 15.000 VNĐ');
    expect(titles()).toEqual(['Thu hồi sách (Chờ nộp phạt)']);
  });

  test('UT-RB-05 đã nộp phạt → COMPLETED; còn đền bù chưa nộp → OVERDUE; max(phạt DB, phạt tính)', async () => {
    arrange(late(3, { isFinePaid: true, fineAmount: 15000 }));
    await callHandler(returnByBarcode, { body: { barcode: 'BC-1' }, user: ADMIN });
    expect(loanWrites()[0]).toMatchObject({ status: 'COMPLETED', fineAmount: 15000 });
    arrange(loanOf({ compensationAmount: 50000 }));
    await callHandler(returnByBarcode, { body: { barcode: 'BC-1' }, user: ADMIN });
    expect(loanWrites()[1]).toMatchObject({ status: 'OVERDUE' });
    arrange(late(2, { fineAmount: 99000 }));
    await callHandler(returnByBarcode, { body: { barcode: 'BC-1' }, user: ADMIN });
    expect(loanWrites()[2].fineAmount).toBe(99000);
  });

  test('UT-RB-06 có người đặt trước → NOTIFIED + thông báo + reservationNotice', async () => {
    arrange(loanOf());
    mocks.prisma.reservation.findFirst.mockResolvedValue({ id: 7, userId: 9, user: { name: 'Người đặt', email: 'wait@test.local' } });
    mocks.prisma.reservation.update.mockResolvedValue({});
    const res = await callHandler(returnByBarcode, { body: { barcode: 'BC-1' }, user: ADMIN });
    expect(mocks.prisma.reservation.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: 'NOTIFIED' } });
    expect(res.payload.reservationNotice).toEqual({ userName: 'Người đặt', userEmail: 'wait@test.local' });
    expect(titles()[0]).toBe('Sách bạn đặt trước đã có sẵn!');
  });

  test('UT-RB-07 lỗi giao dịch → 500', async () => {
    arrange(loanOf());
    mocks.prisma.$transaction.mockRejectedValue(new Error('db'));
    expect((await callHandler(returnByBarcode, { body: { barcode: 'BC-1' }, user: ADMIN })).statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------- reportLost
describe('reportLost — POST /loans/:id/report-lost', () => {
  const lost = (params: Record<string, string>, body: object, loan: unknown = loanOf()) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan);
    return callHandler(reportLost, { params, body, user: ADMIN });
  };

  test.each([
    ['UT-RL-01a id không phải số', { id: 'abc' }, { compensationAmount: 1000 }],
    ['UT-RL-01b id = 0', { id: '0' }, { compensationAmount: 1000 }],
    ['UT-RL-01c thiếu số tiền bồi thường (NaN)', { id: '50' }, {}],
    ['UT-RL-01d số tiền không phải số', { id: '50' }, { compensationAmount: 'abc' }],
    ['UT-RL-01e số tiền âm', { id: '50' }, { compensationAmount: -1 }],
  ])('%s → 400, không truy vấn', async (_id, params, body) => {
    const res = await callHandler(reportLost, { params, body, user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.loan.findUnique).not.toHaveBeenCalled();
  });

  test('UT-RL-02 phiếu không tồn tại → 404; đã COMPLETED → 400; đã báo mất (phiếu hoặc bản sao) → 400', async () => {
    expect((await lost({ id: '50' }, { compensationAmount: 1000 }, null)).statusCode).toBe(404);
    expect((await lost({ id: '50' }, { compensationAmount: 1000 }, loanOf({ status: 'COMPLETED' }))).statusCode).toBe(400);
    expect((await lost({ id: '50' }, { compensationAmount: 1000 }, loanOf({ status: 'LOST_PENDING_PAYMENT' }))).statusCode).toBe(400);
    const itemLost = loanOf();
    itemLost.bookItem.status = 'LOST';
    expect((await lost({ id: '50' }, { compensationAmount: 1000 }, itemLost)).statusCode).toBe(400);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  test('UT-RL-03 báo mất 120.000 → Loan LOST_PENDING_PAYMENT (phạt = đền bù, chưa nộp), BookItem LOST, thông báo, số bản còn', async () => {
    const res = await lost({ id: '50' }, { compensationAmount: '120000' });
    expect(res.statusCode).toBe(200);
    expect(loanWrites()[0]).toMatchObject({ status: 'LOST_PENDING_PAYMENT', returnDate: NOW, compensationAmount: 120000, fineAmount: 120000, isFinePaid: false });
    expect(itemWrites()).toEqual([{ status: 'LOST' }]);
    expect(titles()).toEqual(['Ghi nhận báo mất sách']);
    expect(mocks.createNotification.mock.calls[0][0].message).toContain('120.000');
    expect(res.payload).toMatchObject({ availableCopies: 1 });
    expect(res.payload.message).toContain('"Sách trả"');
  });

  test('UT-RL-04 số tiền bồi thường 0 (biên) hoặc null được chấp nhận (ghi nhận hành vi hiện tại)', async () => {
    expect((await lost({ id: '50' }, { compensationAmount: 0 })).statusCode).toBe(200);
    expect((await lost({ id: '50' }, { compensationAmount: null })).statusCode).toBe(200);
  });

  test('UT-RL-05 lỗi giao dịch → 500', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loanOf());
    mocks.prisma.$transaction.mockRejectedValue(new Error('db'));
    expect((await callHandler(reportLost, { params: { id: '50' }, body: { compensationAmount: 1 }, user: ADMIN })).statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------- requestRenewLoan
describe('requestRenewLoan — POST /loans/:id/request-renew', () => {
  const req = (loan: unknown, user = READER, params: Record<string, string> = { id: '50' }) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan);
    return callHandler(requestRenewLoan, { params, user });
  };

  test('UT-RN-01 id không hợp lệ → 400; không tìm thấy → 404; người khác → 403', async () => {
    expect((await req(loanOf(), READER, { id: 'abc' })).statusCode).toBe(400);
    expect((await req(null)).statusCode).toBe(404);
    expect((await req(loanOf(), OTHER)).statusCode).toBe(403);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test('UT-RN-02 Admin được gửi yêu cầu thay cho độc giả', async () => {
    mocks.prisma.reservation.findFirst.mockResolvedValue(null);
    expect((await req(loanOf(), ADMIN)).statusCode).toBe(200);
  });

  test.each([
    ['UT-RN-03a đã có returnDate', { returnDate: NOW }],
    ['UT-RN-03b COMPLETED', { status: 'COMPLETED' }],
    ['UT-RN-03c LOST_PENDING_PAYMENT', { status: 'LOST_PENDING_PAYMENT' }],
    ['UT-RN-03d status "LOST" (dữ liệu cũ)', { status: 'LOST' }],
  ])('%s → 400 "đã kết thúc"', async (_id, patch) => {
    const res = await req(loanOf(patch));
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('đã kết thúc');
  });

  test('UT-RN-04 (EXT-04) status OVERDUE dù hạn còn → 400 "quá hạn"; hạn đã qua → 400', async () => {
    expect((await req(loanOf({ status: 'OVERDUE' }))).payload.error).toContain('quá hạn');
    expect((await req(late(1))).statusCode).toBe(400);
  });

  test('UT-RN-05 (EXT-03) đã PENDING → 400 "đang chờ"', async () => {
    const res = await req(loanOf({ renewalStatus: 'PENDING' }));
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('đang chờ');
  });

  test('UT-RN-06 đầu sách đang có độc giả KHÁC đặt trước → 400, truy vấn loại trừ chính chủ phiếu', async () => {
    mocks.prisma.reservation.findFirst.mockResolvedValue({ id: 1 });
    const res = await req(loanOf());
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('đặt trước');
    expect(mocks.prisma.reservation.findFirst.mock.calls[0][0].where).toEqual({ bookId: 100, status: { in: ['WAITING', 'NOTIFIED'] }, userId: { not: 2 } });
  });

  test('UT-RN-07 (EXT-01) hợp lệ → renewalStatus PENDING, thông báo "Đã gửi yêu cầu gia hạn"', async () => {
    const res = await req(loanOf());
    expect(res.statusCode).toBe(200);
    expect(loanWrites()).toEqual([{ renewalStatus: 'PENDING' }]);
    expect(titles()).toEqual(['Đã gửi yêu cầu gia hạn']);
    expect(res.payload.loan.renewalStatus).toBe('PENDING');
  });

  test('UT-RN-08 renewLoan là bí danh của requestRenewLoan; lỗi DB → 500', async () => {
    expect(renewLoan).toBe(requestRenewLoan);
    mocks.prisma.loan.findUnique.mockRejectedValue(new Error('db'));
    expect((await callHandler(requestRenewLoan, { params: { id: '50' }, user: READER })).statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------- approve / reject
describe('approveRenewLoan / rejectRenewLoan', () => {
  const approve = (loan: unknown, user = ADMIN, params: Record<string, string> = { id: '50' }) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan);
    return callHandler(approveRenewLoan, { params, user });
  };
  const reject = (loan: unknown, user = ADMIN, params: Record<string, string> = { id: '50' }) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan);
    return callHandler(rejectRenewLoan, { params, user });
  };

  test('UT-AP-01 USER → 403; id không hợp lệ → 400; không tìm thấy → 404 (cả duyệt và từ chối)', async () => {
    for (const handler of [approve, reject]) {
      expect((await handler(loanOf({ renewalStatus: 'PENDING' }), READER)).statusCode).toBe(403);
      expect((await handler(loanOf({ renewalStatus: 'PENDING' }), ADMIN, { id: 'abc' })).statusCode).toBe(400);
      expect((await handler(null)).statusCode).toBe(404);
    }
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test.each([
    ['UT-AP-02a đã có returnDate', { returnDate: NOW }],
    ['UT-AP-02b LOST_PENDING_PAYMENT', { status: 'LOST_PENDING_PAYMENT' }],
  ])('%s → duyệt bị chặn 400', async (_id, patch) => {
    expect((await approve(loanOf({ renewalStatus: 'PENDING', ...patch }))).statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test('UT-AP-03 (EXT-01) duyệt yêu cầu PENDING → APPROVED, phiếu về ACTIVE, hạn mới sau hạn cũ (giữ giờ), thông báo phê duyệt', async () => {
    const original = loanOf({ renewalStatus: 'PENDING' });
    const res = await approve(original);
    expect(res.statusCode).toBe(200);
    const data = loanWrites()[0];
    expect(data).toMatchObject({ renewalStatus: 'APPROVED', status: 'ACTIVE' });
    // Oracle trung tính (đúng cho cả +7 lẫn +14): hạn mới muộn hơn hạn cũ, cùng giờ trong ngày, cách nguyên số ngày.
    const delta = data.dueDate.getTime() - original.dueDate.getTime();
    expect(delta).toBeGreaterThan(0);
    expect(delta % DAY).toBe(0);
    expect(titles()).toEqual(['Yêu cầu gia hạn được phê duyệt']);
    expect(res.payload.message).toContain('"Sách trả"');
  });

  test('UT-AP-04 duyệt phiếu đang OVERDUE → phiếu bị đưa về ACTIVE (ghi nhận hành vi hiện tại, liên quan DEF-011)', async () => {
    await approve(late(2, { renewalStatus: 'PENDING', status: 'OVERDUE', fineAmount: 10000 }));
    expect(loanWrites()[0].status).toBe('ACTIVE');
  });

  test('UT-AP-05 (EXT-02) từ chối → REJECTED, thông báo "bị từ chối"', async () => {
    const res = await reject(loanOf({ renewalStatus: 'PENDING' }));
    expect(res.statusCode).toBe(200);
    expect(loanWrites()).toEqual([{ renewalStatus: 'REJECTED' }]);
    expect(titles()).toEqual(['Yêu cầu gia hạn bị từ chối']);
    expect(res.payload.message).toContain('"Sách trả"');
  });

  test('UT-AP-06 lỗi DB → 500 ở cả duyệt và từ chối', async () => {
    mocks.prisma.loan.findUnique.mockRejectedValue(new Error('db'));
    expect((await callHandler(approveRenewLoan, { params: { id: '50' }, user: ADMIN })).statusCode).toBe(500);
    expect((await callHandler(rejectRenewLoan, { params: { id: '50' }, user: ADMIN })).statusCode).toBe(500);
  });

  // NEW FINDING FIND-22 — không có yêu cầu PENDING mà thủ thư vẫn "duyệt" được (nhảy cóc NONE → APPROVED).
  test.fails('UT-AP-07 (FIND-22) duyệt gia hạn khi phiếu chưa có yêu cầu (renewalStatus NONE) phải bị chặn 400, không ghi', async () => {
    const res = await approve(loanOf({ renewalStatus: 'NONE' }));
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test.fails('UT-AP-08 (FIND-22) từ chối gia hạn khi phiếu chưa có yêu cầu PENDING phải bị chặn 400, không ghi', async () => {
    const res = await reject(loanOf({ renewalStatus: 'NONE' }));
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test.fails('UT-AP-09 (FIND-22) từ chối gia hạn của phiếu đã COMPLETED phải bị chặn 400 (duyệt đã có kiểm tra này, từ chối thì không)', async () => {
    const res = await reject(loanOf({ status: 'COMPLETED', returnDate: NOW, renewalStatus: 'PENDING' }));
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });
});
