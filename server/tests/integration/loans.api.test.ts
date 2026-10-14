/**
 * Mục tiêu: kiểm thử tích hợp API vòng đời phiếu mượn (mượn → trả / báo mất → gia hạn) qua HTTP thật
 *   (supertest → Express router → middleware JWT → loanController → Prisma → SQLite).
 * Kỹ thuật: kiểm thử hộp đen mức API trên DB SQLite cách ly (server/tests/tmp, tạo bằng prisma db push
 *   từ schema; KHÔNG chạm dev.db), dữ liệu dựng bằng factory; mốc quá hạn dựng bằng cách cập nhật
 *   dueDate trực tiếp qua Prisma. Kiểm tra cả phản hồi HTTP lẫn trạng thái lưu trong DB.
 * Mã ca: IT-BOR/RET/EXT/SRCH-xx là mã tích hợp mới, thiết kế từ đặc tả Chương 2 và brief.
 *   Mã hộp đen trong ngoặc chỉ ghi khi brief mô tả rõ ca đó (BOR-01, BOR-06, RET-01, RET-10, EXT-01);
 *   các mã BOR/RET/EXT khác của Chương 3 chưa có trong repo nên chưa ánh xạ (cần đối chiếu).
 * test.fails: KNOWN BUG DEF-004/005/006/007/008/009/010/011/012/013/014 và NEW FINDING FIND-01.
 * Ranh giới: không chạy index.ts (listen/cron); mail được stub; không kiểm thử UI.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp, loanRoutes } from '../helpers/app';
import {
  availableCount, bearer, createBook, createLoan, createUser, DAY, daysBetween, prisma, resetDatabase,
} from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;
let book: Awaited<ReturnType<typeof createBook>>;

const borrow = (barcode: unknown, userId: unknown, as = admin) =>
  request(app).post('/api/loans/borrow-by-barcode').set(bearer(as)).send({ barcode, userId });
const giveBack = (barcode: unknown, as = admin) =>
  request(app).post('/api/loans/return-by-barcode').set(bearer(as)).send({ barcode });
const loanCount = () => prisma.loan.count();

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN', name: 'Thủ thư IT' });
  reader = await createUser({ email: 'reader@it.local' });
  book = await createBook('ISBN-IT-01', 3);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ============================================================ MƯỢN
describe('Mượn sách — POST /api/loans/borrow-by-barcode', () => {
  test('IT-BOR-01 (BOR-01) thủ thư quét barcode độc giả + sách → 200, Loan ACTIVE, BookItem BORROWED, khả dụng 3 → 2', async () => {
    const res = await borrow('ISBN-IT-01-1', reader.id);
    expect(res.status).toBe(200);
    expect(res.body.availableCopies).toBe(2);
    const loan = await prisma.loan.findFirstOrThrow({ where: { userId: reader.id } });
    expect(loan).toMatchObject({ status: 'ACTIVE', returnDate: null, fineAmount: 0, renewalStatus: 'NONE' });
    expect((await prisma.bookItem.findUniqueOrThrow({ where: { barcode: 'ISBN-IT-01-1' } })).status).toBe('BORROWED');
    expect(await availableCount(book.id)).toBe(2);
  });

  test('IT-BOR-02 thiếu barcode → 400, không tạo phiếu', async () => {
    const res = await borrow(undefined, reader.id);
    expect(res.status).toBe(400);
    expect(await loanCount()).toBe(0);
  });

  test('IT-BOR-03 barcode không tồn tại → 404', async () => {
    expect((await borrow('KHONG-TON-TAI', reader.id)).status).toBe(404);
    expect(await loanCount()).toBe(0);
  });

  test('IT-BOR-04 mã độc giả không tồn tại → 404', async () => {
    expect((await borrow('ISBN-IT-01-1', 999999)).status).toBe(404);
    expect(await loanCount()).toBe(0);
  });

  test('IT-BOR-05 độc giả (USER) tự gọi API mượn → 403', async () => {
    expect((await borrow('ISBN-IT-01-1', reader.id, reader)).status).toBe(403);
    expect(await loanCount()).toBe(0);
  });

  test('IT-BOR-06 (BOR-06) quét cuốn đang BORROWED → 400, không tạo phiếu thứ hai', async () => {
    expect((await borrow('ISBN-IT-01-1', reader.id)).status).toBe(200);
    const other = await createUser({ email: 'other@it.local' });
    const res = await borrow('ISBN-IT-01-1', other.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('BORROWED');
    expect(await loanCount()).toBe(1);
  });

  test('IT-BOR-07 độc giả bị Blacklist → 403', async () => {
    await prisma.user.update({ where: { id: reader.id }, data: { isBlacklisted: true } });
    expect((await borrow('ISBN-IT-01-1', reader.id)).status).toBe(403);
    expect(await loanCount()).toBe(0);
  });

  test('IT-BOR-08 độc giả có phiếu quá hạn (dueDate dời về quá khứ) → 400', async () => {
    const other = await createBook('ISBN-IT-02', 1);
    await createLoan(reader.id, other.items[0].id, { dueDate: new Date(Date.now() - 2 * DAY) });
    expect((await borrow('ISBN-IT-01-1', reader.id)).status).toBe(400);
    expect(await loanCount()).toBe(1);
  });

  test('IT-BOR-09 STANDARD → dueDate lưu trong DB = ngày mượn + 14 ngày', async () => {
    await borrow('ISBN-IT-01-1', reader.id);
    const loan = await prisma.loan.findFirstOrThrow();
    expect(daysBetween(loan.borrowDate, loan.dueDate)).toBe(14);
  });

  test('IT-BOR-10 STANDARD đã mượn 5 cuốn → cuốn thứ 6 bị chặn 400 (hạn mức)', async () => {
    const many = await createBook('ISBN-IT-03', 6);
    for (let i = 0; i < 5; i++) expect((await borrow(`ISBN-IT-03-${i + 1}`, reader.id)).status).toBe(200);
    const res = await borrow('ISBN-IT-03-6', reader.id);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('5/5');
    expect(await availableCount(many.id)).toBe(1);
  });

  test('IT-BOR-11 không gửi token → 401', async () => {
    const res = await request(app).post('/api/loans/borrow-by-barcode').send({ barcode: 'ISBN-IT-01-1', userId: reader.id });
    expect(res.status).toBe(401);
  });

  test('IT-BOR-12 còn nợ phạt chưa nộp (phiếu đã trả) → không được mượn mới', async () => {
    const other = await createBook('ISBN-IT-02', 1);
    await createLoan(reader.id, other.items[0].id, { returnDate: new Date(), status: 'OVERDUE', fineAmount: 15000, isFinePaid: false });
    expect((await borrow('ISBN-IT-01-1', reader.id)).status).toBe(400);
  });

  // KNOWN BUG DEF-004
  test.fails('IT-BOR-13 mượn thành công → ghi 1 dòng AuditLog (DEF-004)', async () => {
    await borrow('ISBN-IT-01-1', reader.id);
    expect(await prisma.auditLog.count()).toBe(1);
  });

  // KNOWN BUG DEF-005
  test.fails('IT-BOR-14 độc giả PREMIUM → dueDate = ngày mượn + 30 ngày (DEF-005)', async () => {
    await prisma.user.update({ where: { id: reader.id }, data: { membershipTier: 'PREMIUM' } });
    await borrow('ISBN-IT-01-1', reader.id);
    const loan = await prisma.loan.findFirstOrThrow();
    expect(daysBetween(loan.borrowDate, loan.dueDate)).toBe(30);
  });
});

// ============================================================ TRẢ
describe('Trả sách — POST /api/loans/return-by-barcode', () => {
  test('IT-RET-01 (RET-01) trả đúng hạn → Loan COMPLETED, phạt 0, BookItem AVAILABLE, khả dụng phục hồi', async () => {
    await borrow('ISBN-IT-01-1', reader.id);
    const res = await giveBack('ISBN-IT-01-1');
    expect(res.status).toBe(200);
    const loan = await prisma.loan.findFirstOrThrow();
    expect(loan.status).toBe('COMPLETED');
    expect(loan.returnDate).not.toBeNull();
    expect(loan.fineAmount).toBe(0);
    expect((await prisma.bookItem.findUniqueOrThrow({ where: { barcode: 'ISBN-IT-01-1' } })).status).toBe('AVAILABLE');
    expect(await availableCount(book.id)).toBe(3);
  });

  test('IT-RET-02 trả trễ 3 ngày → phạt 15.000 đ được lưu, sách về AVAILABLE', async () => {
    const loan = await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 3 * DAY - 60_000) });
    expect((await giveBack('ISBN-IT-01-1')).status).toBe(200);
    const saved = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(saved.fineAmount).toBe(15000);
    expect(saved.isFinePaid).toBe(false);
    expect((await prisma.bookItem.findUniqueOrThrow({ where: { id: book.items[0].id } })).status).toBe('AVAILABLE');
  });

  // KNOWN BUG DEF-006
  test.fails('IT-RET-03 trả trễ chưa nộp phạt → Loan PENDING_FINE_PAYMENT (DEF-006)', async () => {
    const loan = await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 3 * DAY - 60_000) });
    await giveBack('ISBN-IT-01-1');
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe('PENDING_FINE_PAYMENT');
  });

  // NEW FINDING FIND-01
  test.fails('IT-RET-04 trễ 1 ngày 1 giờ → phạt theo ceil = 2 ngày = 10.000 đ (FIND-01)', async () => {
    const loan = await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - DAY - 60 * 60 * 1000) });
    await giveBack('ISBN-IT-01-1');
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).fineAmount).toBe(10000);
  });

  test('IT-RET-05 quét trả cuốn đang AVAILABLE (không có phiếu mở) → 400', async () => {
    expect((await giveBack('ISBN-IT-01-2')).status).toBe(400);
  });

  test('IT-RET-06 barcode không tồn tại → 404', async () => {
    expect((await giveBack('KHONG-TON-TAI')).status).toBe(404);
  });

  test('IT-RET-07 độc giả (USER) gọi API trả → 403, phiếu vẫn ACTIVE', async () => {
    await borrow('ISBN-IT-01-1', reader.id);
    expect((await giveBack('ISBN-IT-01-1', reader)).status).toBe(403);
    expect((await prisma.loan.findFirstOrThrow()).status).toBe('ACTIVE');
  });

  test('IT-RET-08 trả sách đang có người đặt trước (WAITING) → đặt trước chuyển NOTIFIED + thông báo', async () => {
    await borrow('ISBN-IT-01-1', reader.id);
    const waiting = await createUser({ email: 'waiting@it.local' });
    const reservation = await prisma.reservation.create({ data: { userId: waiting.id, bookId: book.id } });
    const res = await giveBack('ISBN-IT-01-1');
    expect(res.body.reservationNotice).toMatchObject({ userEmail: 'waiting@it.local' });
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe('NOTIFIED');
    expect(await prisma.notification.count({ where: { userId: waiting.id } })).toBe(1);
  });

  test('IT-RET-09 sau khi trả trễ còn nợ phạt → bị chặn mượn mới (400)', async () => {
    await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 2 * DAY - 60_000) });
    await giveBack('ISBN-IT-01-1');
    expect((await borrow('ISBN-IT-01-2', reader.id)).status).toBe(400);
  });

  test('IT-RET-10 (RET-10) bấm trả lần 2 → 400; trả theo loanId phiếu COMPLETED → "đã hoàn tất"', async () => {
    await borrow('ISBN-IT-01-1', reader.id);
    expect((await giveBack('ISBN-IT-01-1')).status).toBe(200);
    expect((await giveBack('ISBN-IT-01-1')).status).toBe(400);
    const loan = await prisma.loan.findFirstOrThrow();
    const res = await request(app).post('/api/loans/return').set(bearer(admin)).send({ loanId: loan.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Phiếu mượn này đã hoàn tất trước đó');
  });

  test('IT-RET-11 báo mất 120.000 đ → Loan LOST_PENDING_PAYMENT, BookItem LOST, báo mất lần 2 → 400', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    const url = `/api/loans/${loan.id}/report-lost`;
    expect((await request(app).post(url).set(bearer(admin)).send({ compensationAmount: 120000 })).status).toBe(200);
    expect(await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).toMatchObject({ status: 'LOST_PENDING_PAYMENT', compensationAmount: 120000 });
    expect((await prisma.bookItem.findUniqueOrThrow({ where: { id: book.items[0].id } })).status).toBe('LOST');
    expect((await request(app).post(url).set(bearer(admin)).send({ compensationAmount: 1 })).status).toBe(400);
  });

  // KNOWN BUG DEF-007: không có route nào cho luồng báo hỏng (BookItem → DAMAGED).
  test.fails('IT-RET-12 có luồng báo hỏng sách trong API phiếu mượn (DEF-007)', () => {
    const paths = (loanRoutes as unknown as { stack: Array<{ route?: { path: string } }> }).stack
      .map((layer) => layer.route?.path ?? '');
    expect(paths.some((path) => /damage/i.test(path))).toBe(true);
  });
});

// ============================================================ GIA HẠN
describe('Gia hạn — request-renew / approve-renew / reject-renew', () => {
  const ask = (loanId: number, as = reader) => request(app).post(`/api/loans/${loanId}/request-renew`).set(bearer(as)).send({});
  const approve = (loanId: number, as = admin) => request(app).post(`/api/loans/${loanId}/approve-renew`).set(bearer(as)).send({});

  test('IT-EXT-01 (EXT-01) độc giả gửi gia hạn → PENDING; thủ thư duyệt → APPROVED, dueDate lùi về sau', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    expect((await ask(loan.id)).status).toBe(200);
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).renewalStatus).toBe('PENDING');
    expect((await approve(loan.id)).status).toBe(200);
    const saved = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(saved.renewalStatus).toBe('APPROVED');
    expect(saved.dueDate.getTime()).toBeGreaterThan(loan.dueDate.getTime());
    expect(await prisma.notification.count({ where: { userId: reader.id } })).toBe(2);
  });

  // KNOWN BUG DEF-008
  test.fails('IT-EXT-02 duyệt gia hạn → dueDate + 14 ngày (DEF-008)', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    await ask(loan.id);
    await approve(loan.id);
    const saved = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(daysBetween(loan.dueDate, saved.dueDate)).toBe(14);
  });

  test('IT-EXT-03 gửi gia hạn lần nữa khi đang PENDING → 400', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    await ask(loan.id);
    expect((await ask(loan.id)).status).toBe(400);
  });

  test('IT-EXT-04 phiếu đã quá hạn → không cho gửi gia hạn (400)', async () => {
    const loan = await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - DAY) });
    expect((await ask(loan.id)).status).toBe(400);
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).renewalStatus).toBe('NONE');
  });

  // KNOWN BUG DEF-009
  test.fails('IT-EXT-05 đã gia hạn 1 lần (APPROVED) → yêu cầu gia hạn lần 2 bị chặn (DEF-009)', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    await ask(loan.id);
    await approve(loan.id);
    expect((await ask(loan.id)).status).toBe(400);
  });

  // KNOWN BUG DEF-010
  test.fails('IT-EXT-06 từ chối kèm lý do → lý do được lưu/gửi tới độc giả (DEF-010)', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    await ask(loan.id);
    const res = await request(app).post(`/api/loans/${loan.id}/reject-renew`).set(bearer(admin)).send({ reason: 'Đã có người đặt trước' });
    expect(res.status).toBe(200);
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).renewalStatus).toBe('REJECTED');
    const notes = await prisma.notification.findMany({ where: { userId: reader.id } });
    expect(notes.some((note) => note.message.includes('Đã có người đặt trước'))).toBe(true);
  });

  // KNOWN BUG DEF-011
  test.fails('IT-EXT-07 độc giả còn nợ phạt → thủ thư không duyệt được gia hạn (DEF-011)', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    await ask(loan.id);
    const other = await createBook('ISBN-IT-02', 1);
    await createLoan(reader.id, other.items[0].id, { returnDate: new Date(), status: 'OVERDUE', fineAmount: 20000, isFinePaid: false });
    expect((await approve(loan.id)).status).toBe(400);
  });

  test('IT-EXT-08 đầu sách đang có độc giả khác đặt trước → không cho gia hạn (400)', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    const waiting = await createUser({ email: 'waiting@it.local' });
    await prisma.reservation.create({ data: { userId: waiting.id, bookId: book.id } });
    expect((await ask(loan.id)).status).toBe(400);
  });

  test('IT-EXT-09 độc giả (USER) tự duyệt gia hạn → 403', async () => {
    const loan = await createLoan(reader.id, book.items[0].id, { renewalStatus: 'PENDING' });
    expect((await approve(loan.id, reader)).status).toBe(403);
  });
});

// ============================================================ TRA CỨU PHIẾU
describe('Tra cứu phiếu mượn — GET /api/loans/all, /barcode/:barcode', () => {
  async function seedHistory() {
    const done = await createLoan(reader.id, book.items[0].id, { returnDate: new Date(Date.now() - DAY), status: 'COMPLETED' });
    await prisma.bookItem.update({ where: { id: book.items[0].id }, data: { status: 'AVAILABLE' } });
    const open = await createLoan(reader.id, book.items[1].id);
    return { done, open };
  }

  test('IT-SRCH-01 thủ thư xem toàn bộ phiếu → 200, đủ số phiếu, có trạng thái hiển thị', async () => {
    await seedHistory();
    const res = await request(app).get('/api/loans/all').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((loan: { status: string }) => loan.status).sort()).toEqual(['On Time', 'Returned']);
  });

  // KNOWN BUG DEF-012 (giả định API nhận ?search=<mã phiếu>; hiện API bỏ qua mọi tham số lọc)
  test.fails('IT-SRCH-02 tìm phiếu theo mã phiếu → chỉ trả về đúng phiếu đó (DEF-012)', async () => {
    const { open } = await seedHistory();
    const res = await request(app).get(`/api/loans/all?search=${open.id}`).set(bearer(admin));
    expect(res.body.map((loan: { id: number }) => loan.id)).toEqual([open.id]);
  });

  // KNOWN BUG DEF-013
  test.fails('IT-SRCH-03 tra cứu barcode trả kèm lịch sử mượn của cuốn sách (DEF-013)', async () => {
    const { done } = await seedHistory();
    const res = await request(app).get('/api/loans/barcode/ISBN-IT-01-1').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('history');
    expect(res.body.history.map((loan: { id: number }) => loan.id)).toContain(done.id);
  });

  // KNOWN BUG DEF-014 (giả định tham số ?status=&page=&limit=)
  test.fails('IT-SRCH-04 lọc phiếu theo trạng thái + phân trang (DEF-014)', async () => {
    await seedHistory();
    const res = await request(app).get('/api/loans/all?status=COMPLETED&page=1&limit=1').set(bearer(admin));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rawStatus).toBe('COMPLETED');
  });
});
