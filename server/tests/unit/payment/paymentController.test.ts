/**
 * Mục tiêu: kiểm thử đơn vị paymentController (cổng thanh toán GIẢ LẬP tiền phạt): createPaymentUrl,
 *   getPaymentDetails, paymentCallback.
 * Kỹ thuật: hộp trắng phủ nhánh + phân tích giá trị biên (số ngày quá hạn 0 / 1, tiền phạt 0 / > 0) và
 *   phân vùng tương đương (vai trò, trạng thái giao dịch). Prisma và notificationService được mock TRƯỚC khi import.
 * Ranh giới: đây là cổng giả lập, KHÔNG phải giao dịch tiền thật; chỉ chứng minh controller → lời gọi Prisma/notification,
 *   không chứng minh ghi SQLite thật (xem tests/integration/payment.api.test.ts).
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): PAY-01 (mở cổng rồi Hủy → chưa đánh dấu đã trả),
 *   PAY-02 (xác nhận thanh toán → đã trả).
 * Hành vi hiện tại được GHI NHẬN (không khẳng định đúng nghiệp vụ, chờ nhóm xác nhận): phiếu không phạt vẫn có
 *   "phí tối thiểu giả lập" 10.000đ; callback không kiểm tra chủ phiếu. Xem mục "pending requirement" trong báo cáo.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { callHandler, resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    loan: d('findUnique', 'update'),
    auditLog: d('create'),
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
import { createPaymentUrl, getPaymentDetails, paymentCallback } from '../../../src/controllers/paymentController';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-14T09:00:00Z');
const OWNER = { userId: 2, email: 'reader@test.local', role: 'USER' };
const OTHER = { userId: 3, email: 'other@test.local', role: 'USER' };
const ADMIN = { userId: 1, email: 'admin@test.local', role: 'ADMIN' };

const loan = (overrides: Record<string, unknown> = {}) => ({
  id: 50, userId: 2, bookItemId: 10, status: 'OVERDUE', fineAmount: 20000, compensationAmount: 0, isFinePaid: false,
  finePaidAt: null, dueDate: new Date(NOW.getTime() - 4 * DAY), returnDate: null,
  bookItem: { book: { title: 'Sách phạt', coverImage: 'c.png', author: { name: 'Tác giả' } } },
  user: { name: 'Độc giả', email: 'reader@test.local' },
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
    ...Object.values(mocks.prisma.loan), mocks.prisma.auditLog.create,
    mocks.prisma.$connect, mocks.prisma.$disconnect, mocks.createNotification,
  ]);
  mocks.createNotification.mockResolvedValue({ id: 1 });
});

afterAll(() => {
  vi.useRealTimers();
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

describe('createPaymentUrl — POST /payments/create-url', () => {
  test('UT-PAY-01 thiếu loanId → 400, không truy vấn', async () => {
    const res = await callHandler(createPaymentUrl, { body: {}, user: OWNER });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.loan.findUnique).not.toHaveBeenCalled();
  });

  test('UT-PAY-02 phiếu không tồn tại → 404', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(null);
    expect((await callHandler(createPaymentUrl, { body: { loanId: 50 }, user: OWNER })).statusCode).toBe(404);
  });

  test('UT-PAY-03 người khác (không phải chủ phiếu, không phải ADMIN) → 403', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    expect((await callHandler(createPaymentUrl, { body: { loanId: 50 }, user: OTHER })).statusCode).toBe(403);
  });

  test('UT-PAY-04 ADMIN được tạo link cho phiếu của độc giả khác', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    expect((await callHandler(createPaymentUrl, { body: { loanId: 50 }, user: ADMIN })).statusCode).toBe(200);
  });

  test('UT-PAY-05 phạt đã thanh toán → 400', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan({ isFinePaid: true }));
    const res = await callHandler(createPaymentUrl, { body: { loanId: 50 }, user: OWNER });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('đã được thanh toán');
  });

  test('UT-PAY-06 (PAY-01/02) số tiền = phạt + bồi thường trong DB; URL mã hóa tên sách; method mặc định MOMO', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan({ fineAmount: 20000, compensationAmount: 50000, bookItem: { book: { title: 'Sách & Nhà' } } }));
    const res = await callHandler(createPaymentUrl, { body: { loanId: '50' }, user: OWNER });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ success: true, loanId: 50, amount: 70000, bookTitle: 'Sách & Nhà', borrowerName: 'Độc giả' });
    expect(res.payload.txnRef).toBe(`FINE-50-${NOW.getTime()}`);
    expect(res.payload.paymentUrl).toContain('method=MOMO');
    expect(res.payload.paymentUrl).toContain('amount=70000');
    expect(res.payload.paymentUrl).toContain(`bookTitle=${encodeURIComponent('Sách & Nhà')}`);
  });

  test('UT-PAY-07 method tùy chọn được giữ nguyên trong URL', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    const res = await callHandler(createPaymentUrl, { body: { loanId: 50, method: 'VNPAY' }, user: OWNER });
    expect(res.payload.paymentUrl).toContain('method=VNPAY');
  });

  test.each([
    ['UT-PAY-08a fine = 0, quá hạn 4 ngày → 4 × 5.000', 4 * DAY, 20000],
    ['UT-PAY-08b fine = 0, quá hạn 1 ngày + 1 giờ (làm tròn lên) → 2 × 5.000', DAY + 60 * 60 * 1000, 10000],
    ['UT-PAY-08c fine = 0, vừa đúng hạn (biên) → phí tối thiểu giả lập 10.000', 0, 10000],
    ['UT-PAY-08d fine = 0, còn hạn 3 ngày → phí tối thiểu giả lập 10.000 (ghi nhận hành vi hiện tại)', -3 * DAY, 10000],
  ])('%s', async (_id, overdueMs, amount) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan({ fineAmount: 0, compensationAmount: 0, dueDate: new Date(NOW.getTime() - overdueMs) }));
    const res = await callHandler(createPaymentUrl, { body: { loanId: 50 }, user: OWNER });
    expect(res.payload.amount).toBe(amount);
  });

  test('UT-PAY-09 fineAmount/compensationAmount null và thiếu thông tin sách/người dùng → giá trị mặc định', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan({ fineAmount: null, compensationAmount: null, bookItem: null, user: null }));
    const res = await callHandler(createPaymentUrl, { body: { loanId: 50 }, user: OWNER });
    expect(res.payload).toMatchObject({ bookTitle: 'Sách thư viện', borrowerName: '' });
  });

  test('UT-PAY-10 không có req.user: bỏ qua kiểm tra chủ phiếu (route thực tế luôn yêu cầu JWT) → 200', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    expect((await callHandler(createPaymentUrl, { body: { loanId: 50 } })).statusCode).toBe(200);
  });

  test('UT-PAY-11 lỗi DB → 500 kèm message; lỗi không message → thông điệp mặc định', async () => {
    mocks.prisma.loan.findUnique.mockRejectedValueOnce(new Error('db')).mockRejectedValueOnce({});
    expect((await callHandler(createPaymentUrl, { body: { loanId: 50 }, user: OWNER })).payload).toEqual({ error: 'db' });
    expect((await callHandler(createPaymentUrl, { body: { loanId: 50 }, user: OWNER })).payload).toEqual({ error: 'Không thể tạo phiên thanh toán' });
  });
});

describe('getPaymentDetails — GET /payments/details/:loanId', () => {
  test.each([['UT-PAY-12a', 'abc'], ['UT-PAY-12b', '0'], ['UT-PAY-12c', '']])('%s loanId "%s" không phải số dương → 400', async (_id, loanId) => {
    const res = await callHandler(getPaymentDetails, { params: { loanId } });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.loan.findUnique).not.toHaveBeenCalled();
  });

  test('UT-PAY-13 phiếu không tồn tại → 404', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(null);
    expect((await callHandler(getPaymentDetails, { params: { loanId: '50' } })).statusCode).toBe(404);
  });

  test('UT-PAY-14 trả đủ thông tin thanh toán, isFinePaid là boolean', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    const res = await callHandler(getPaymentDetails, { params: { loanId: '50' } });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      loanId: 50, amount: 20000, isFinePaid: false, bookTitle: 'Sách phạt', author: 'Tác giả',
      borrowerName: 'Độc giả', borrowerEmail: 'reader@test.local', status: 'OVERDUE',
    });
  });

  test.each([
    ['UT-PAY-15a quá hạn 2 ngày, chưa có phạt → 2 × 5.000', 2 * DAY, 10000],
    ['UT-PAY-15b chưa quá hạn → phí tối thiểu giả lập 10.000', -DAY, 10000],
    ['UT-PAY-15c quá hạn 3 ngày → 15.000', 3 * DAY, 15000],
  ])('%s', async (_id, overdueMs, amount) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan({ fineAmount: 0, dueDate: new Date(NOW.getTime() - overdueMs) }));
    expect((await callHandler(getPaymentDetails, { params: { loanId: '50' } })).payload.amount).toBe(amount);
  });

  test('UT-PAY-16 thiếu thông tin sách → giá trị mặc định; isFinePaid undefined → false', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan({ bookItem: null, isFinePaid: undefined }));
    const res = await callHandler(getPaymentDetails, { params: { loanId: '50' } });
    expect(res.payload).toMatchObject({ bookTitle: 'Sách mượn', author: '', isFinePaid: false });
  });

  test('UT-PAY-17 lỗi DB → 500', async () => {
    mocks.prisma.loan.findUnique.mockRejectedValue(new Error('db'));
    expect((await callHandler(getPaymentDetails, { params: { loanId: '50' } })).statusCode).toBe(500);
  });
});

describe('paymentCallback — POST|GET /payments/callback', () => {
  function arrangePaid() {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    mocks.prisma.loan.update.mockImplementation(async ({ data }: any) => loan({ ...data }));
    mocks.prisma.auditLog.create.mockResolvedValue({ id: 1 });
  }

  test('UT-PAY-18 (PAY-02) POST SUCCESS → loan COMPLETED + isFinePaid, ghi AuditLog FINE_PAYMENT, gửi thông báo', async () => {
    arrangePaid();
    const res = await callHandler(paymentCallback, {
      method: 'POST', body: { loanId: 50, txnRef: 'TXN-1', method: 'VNPAY', status: 'SUCCESS' }, user: OWNER,
    });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.loan.update.mock.calls[0][0].data).toMatchObject({
      isFinePaid: true, paymentMethod: 'VNPAY', paymentTransactionId: 'TXN-1', status: 'COMPLETED',
    });
    expect(mocks.prisma.loan.update.mock.calls[0][0].data.finePaidAt).toEqual(NOW);
    expect(res.payload).toMatchObject({ success: true, loanId: 50, paymentTransactionId: 'TXN-1', status: 'COMPLETED' });
    const audit = mocks.prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: 'FINE_PAYMENT', adminId: 2 });
    expect(JSON.parse(audit.details)).toMatchObject({ loanId: 50, paymentMethod: 'VNPAY', paymentTransactionId: 'TXN-1' });
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 2, title: 'Thanh toán phí phạt thành công' }));
  });

  test('UT-PAY-19 GET đọc tham số từ query; thiếu status/method/txnRef → mặc định SUCCESS/MOMO/TXN-<now>', async () => {
    arrangePaid();
    const res = await callHandler(paymentCallback, { method: 'GET', query: { loanId: '50' } });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.loan.update.mock.calls[0][0].data).toMatchObject({ paymentMethod: 'MOMO', paymentTransactionId: `TXN-${NOW.getTime()}` });
    // Không có req.user → AuditLog dùng userId của phiếu mượn.
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.adminId).toBe(2);
  });

  test('UT-PAY-20 thiếu / không hợp lệ loanId → 400', async () => {
    expect((await callHandler(paymentCallback, { method: 'POST', body: {} })).statusCode).toBe(400);
    expect((await callHandler(paymentCallback, { method: 'POST', body: { loanId: 'abc' } })).statusCode).toBe(400);
    expect(mocks.prisma.loan.findUnique).not.toHaveBeenCalled();
  });

  test('UT-PAY-21 phiếu không tồn tại → 404', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(null);
    expect((await callHandler(paymentCallback, { method: 'POST', body: { loanId: 50 } })).statusCode).toBe(404);
  });

  test.each(['CANCELLED', 'FAILED', 'success'])('UT-PAY-22 (PAY-01) status=%s → 400, KHÔNG đánh dấu đã trả, không ghi log/thông báo', async (status) => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    const res = await callHandler(paymentCallback, { method: 'POST', body: { loanId: 50, status } });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  test('UT-PAY-23 phiếu thiếu thông tin sách → thông báo dùng tên mặc định "Sách mượn"', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    mocks.prisma.loan.update.mockResolvedValue(loan({ bookItem: null }));
    mocks.prisma.auditLog.create.mockResolvedValue({ id: 1 });
    await callHandler(paymentCallback, { method: 'POST', body: { loanId: 50 } });
    expect(mocks.createNotification.mock.calls[0][0].message).toContain('"Sách mượn"');
  });

  test('UT-PAY-24 lỗi DB khi cập nhật → 500 kèm message; lỗi không message → thông điệp mặc định', async () => {
    mocks.prisma.loan.findUnique.mockResolvedValue(loan());
    mocks.prisma.loan.update.mockRejectedValueOnce(new Error('db')).mockRejectedValueOnce({});
    expect((await callHandler(paymentCallback, { method: 'POST', body: { loanId: 50 } })).payload).toEqual({ error: 'db' });
    expect((await callHandler(paymentCallback, { method: 'POST', body: { loanId: 50 } })).payload).toEqual({ error: 'Lỗi khi xử lý kết quả thanh toán' });
  });
});
