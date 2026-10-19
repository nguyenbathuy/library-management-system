/**
 * Mục tiêu: kiểm thử tích hợp API thanh toán tiền phạt GIẢ LẬP (/api/payments) qua HTTP thật trên SQLite tạm:
 *   tạo link, xem chi tiết, callback kết quả; kiểm tra Loan, AuditLog và Notification trong DB.
 * Kỹ thuật: hộp đen mức API + kiểm tra DB; phân vùng tương đương theo vai trò và trạng thái giao dịch.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): PAY-01 (mở cổng rồi Hủy → chưa đánh dấu đã trả),
 *   PAY-02 (xác nhận thanh toán → đã trả, phiếu đóng). Đây là cổng giả lập, không phải giao dịch tiền thật.
 * test.fails: NEW FINDING FIND-11 (người chưa đăng nhập đọc được email người mượn), FIND-12 (callback không cần đăng nhập
 *   vẫn đóng phiếu), FIND-13 (gọi callback lần 2 ghi trùng AuditLog/thông báo). Căn cứ: nguyên tắc bảo mật dữ liệu và
 *   tính idempotent của thanh toán; nhóm cần xác nhận đây là yêu cầu (cổng giả lập có thể cố ý để mở).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../helpers/app';
import { bearer, createBook, createLoan, createUser, DAY, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;
let other: Awaited<ReturnType<typeof createUser>>;
let loanId: number;

const loanInDb = () => prisma.loan.findUniqueOrThrow({ where: { id: loanId } });
const callback = (body: Record<string, unknown>, as?: typeof reader) => {
  const req = request(app).post('/api/payments/callback');
  return (as ? req.set(bearer(as)) : req).send({ loanId, ...body });
};

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN' });
  reader = await createUser({ email: 'reader@it.local', name: 'Độc giả phạt' });
  other = await createUser({ email: 'other@it.local' });
  const book = await createBook('PAY-IT-01', 1, 'Sách có phạt');
  // Phiếu quá hạn 4 ngày, đã có tiền phạt 20.000đ (đúng mô tả PAY-01: "phiếu đã có tiền phạt do nhóm chuẩn bị").
  const loan = await createLoan(reader.id, book.items[0].id, {
    status: 'OVERDUE', fineAmount: 20000, dueDate: new Date(Date.now() - 4 * DAY), borrowDate: new Date(Date.now() - 18 * DAY),
  });
  loanId = loan.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/payments/create-url', () => {
  const createUrl = (body: object, as?: typeof reader) => {
    const req = request(app).post('/api/payments/create-url');
    return (as ? req.set(bearer(as)) : req).send(body);
  };

  test('IT-PAY-01 chủ phiếu → 200, số tiền = phạt trong DB, link chứa loanId, amount, method', async () => {
    const res = await createUrl({ loanId, method: 'VNPAY' }, reader);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, loanId, amount: 20000, bookTitle: 'Sách có phạt', borrowerName: 'Độc giả phạt' });
    expect(res.body.paymentUrl).toContain(`loanId=${loanId}`);
    expect(res.body.paymentUrl).toContain('amount=20000');
    expect(res.body.paymentUrl).toContain('method=VNPAY');
    // Tạo link không được đánh dấu đã trả.
    expect((await loanInDb()).isFinePaid).toBe(false);
  });

  test('IT-PAY-02 Admin tạo được link cho phiếu của độc giả; người khác → 403; không token → 401', async () => {
    expect((await createUrl({ loanId }, admin)).status).toBe(200);
    expect((await createUrl({ loanId }, other)).status).toBe(403);
    expect((await createUrl({ loanId })).status).toBe(401);
  });

  test('IT-PAY-03 thiếu loanId → 400; phiếu không tồn tại → 404', async () => {
    expect((await createUrl({}, reader)).status).toBe(400);
    expect((await createUrl({ loanId: 99999 }, reader)).status).toBe(404);
  });

  test('IT-PAY-04 phiếu đã thanh toán → 400', async () => {
    await prisma.loan.update({ where: { id: loanId }, data: { isFinePaid: true } });
    expect((await createUrl({ loanId }, reader)).status).toBe(400);
  });
});

describe('GET /api/payments/details/:loanId', () => {
  test('IT-PAY-05 trả thông tin thanh toán của phiếu (số tiền, đã trả, sách, hạn trả, trạng thái)', async () => {
    const res = await request(app).get(`/api/payments/details/${loanId}`).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ loanId, amount: 20000, isFinePaid: false, bookTitle: 'Sách có phạt', status: 'OVERDUE', borrowerName: 'Độc giả phạt' });
  });

  test('IT-PAY-06 loanId không phải số / bằng 0 → 400; không tồn tại → 404', async () => {
    expect((await request(app).get('/api/payments/details/abc')).status).toBe(400);
    expect((await request(app).get('/api/payments/details/0')).status).toBe(400);
    expect((await request(app).get('/api/payments/details/99999')).status).toBe(404);
  });

  // NEW FINDING FIND-11 — route dùng optionalAuthenticateToken nên khách vô danh đọc được tên + email người mượn.
  test.fails('IT-PAY-07 (FIND-11) người chưa đăng nhập không được đọc email của người mượn', async () => {
    const res = await request(app).get(`/api/payments/details/${loanId}`);
    expect(res.body.borrowerEmail).toBeUndefined();
  });
});

describe('POST|GET /api/payments/callback (PAY-01, PAY-02)', () => {
  test('IT-PAY-08 (PAY-02) xác nhận thành công → Loan đã trả + COMPLETED, lưu phương thức/mã GD, AuditLog, thông báo', async () => {
    const res = await callback({ txnRef: 'TXN-IT-1', method: 'VNPAY', status: 'SUCCESS' }, reader);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, loanId, paymentTransactionId: 'TXN-IT-1', status: 'COMPLETED' });
    const loan = await loanInDb();
    expect(loan).toMatchObject({ isFinePaid: true, status: 'COMPLETED', paymentMethod: 'VNPAY', paymentTransactionId: 'TXN-IT-1' });
    expect(loan.finePaidAt).toBeInstanceOf(Date);
    const logs = await prisma.auditLog.findMany({ where: { action: 'FINE_PAYMENT' } });
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0].details)).toMatchObject({ loanId, paymentTransactionId: 'TXN-IT-1', fineAmount: 20000 });
    const notes = await prisma.notification.findMany({ where: { userId: reader.id } });
    expect(notes.map((n) => n.title)).toEqual(['Thanh toán phí phạt thành công']);
  });

  test('IT-PAY-09 (PAY-01) bấm Hủy (status ≠ SUCCESS) → 400, KHÔNG đánh dấu đã trả, không AuditLog/thông báo', async () => {
    for (const status of ['CANCELLED', 'FAILED']) {
      const res = await callback({ status }, reader);
      expect(res.status).toBe(400);
    }
    const loan = await loanInDb();
    expect(loan).toMatchObject({ isFinePaid: false, status: 'OVERDUE', paymentTransactionId: null });
    expect(await prisma.auditLog.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  test('IT-PAY-10 callback qua GET (query string) cũng xử lý được như POST', async () => {
    const res = await request(app).get(`/api/payments/callback?loanId=${loanId}&status=SUCCESS&txnRef=TXN-GET&method=MOMO`).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(await loanInDb()).toMatchObject({ isFinePaid: true, paymentTransactionId: 'TXN-GET', paymentMethod: 'MOMO' });
  });

  test('IT-PAY-11 thiếu/sai loanId → 400; phiếu không tồn tại → 404; không thay đổi dữ liệu', async () => {
    expect((await request(app).post('/api/payments/callback').send({})).status).toBe(400);
    expect((await request(app).post('/api/payments/callback').send({ loanId: 'abc' })).status).toBe(400);
    expect((await request(app).post('/api/payments/callback').send({ loanId: 99999 })).status).toBe(404);
    expect((await loanInDb()).isFinePaid).toBe(false);
  });

  test('IT-PAY-12 sau khi đã thanh toán, tạo link mới bị từ chối (400)', async () => {
    await callback({ status: 'SUCCESS' }, reader);
    const res = await request(app).post('/api/payments/create-url').set(bearer(reader)).send({ loanId });
    expect(res.status).toBe(400);
  });

  // NEW FINDING FIND-12 — callback đổi trạng thái tiền phạt nhưng route chỉ dùng optionalAuthenticateToken.
  test.fails('IT-PAY-13 (FIND-12) callback không có token không được đóng phiếu (phải 401/403, DB không đổi)', async () => {
    const res = await callback({ status: 'SUCCESS' });
    expect([401, 403]).toContain(res.status);
    expect((await loanInDb()).isFinePaid).toBe(false);
  });

  // NEW FINDING FIND-13 — gọi lại callback (bấm xác nhận 2 lần / retry) ghi trùng AuditLog và thông báo.
  test.fails('IT-PAY-14 (FIND-13) callback lần 2 cho phiếu đã trả không được ghi thêm AuditLog/thông báo', async () => {
    await callback({ status: 'SUCCESS', txnRef: 'TXN-A' }, reader);
    await callback({ status: 'SUCCESS', txnRef: 'TXN-B' }, reader);
    expect(await prisma.auditLog.count({ where: { action: 'FINE_PAYMENT' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: reader.id } })).toBe(1);
  });
});
