/**
 * Mục tiêu: kiểm thử tích hợp các endpoint phiếu mượn chưa được phủ ở loans.api.test.ts: mượn theo bookId/bookItemId
 *   (POST /api/loans/borrow), danh sách của tôi / toàn hệ thống (GET /my, /all), tra cứu mã vạch (GET /barcode/:barcode)
 *   và kích hoạt quét nhắc hạn (POST /reminders/trigger) — qua HTTP thật trên SQLite tạm, mail bị stub.
 * Kỹ thuật: hộp đen mức API + kiểm tra DB; phân vùng tương đương theo vai trò và hạng thành viên; giá trị biên hạn mức mượn.
 * Liên kết hộp đen: BOR-06, BOR-10 (theo brief); MAIL-01 (Kiểm thử phần mềm.pdf: nhắc hạn/email — ở đây email chỉ được stub,
 *   KHÔNG chứng minh gửi mail thật).
 * test.fails: KNOWN BUG DEF-005 (hạn trả theo hạng thành viên) — căn cứ ghi trong utils/loanRules.ts; NEW FINDING FIND-21
 *   (trả lại phiếu đã có returnDate bằng loanId làm bản sách bị đặt AVAILABLE trong khi người khác đang mượn), FIND-22 (duyệt gia hạn
 *   khi chưa có yêu cầu PENDING).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../helpers/app';
import { availableCount, bearer, createBook, createLoan, createUser, DAY, daysBetween, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

// Các lời gọi mail bị stub được setup (setup/integrationDb.ts) ghi lại tại globalThis.__mailCalls.
const mailCalls = (globalThis as unknown as { __mailCalls: Array<{ fn: string; args: unknown }> }).__mailCalls;
const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;
let book: Awaited<ReturnType<typeof createBook>>;

const borrow = (body: unknown, as = reader) => request(app).post('/api/loans/borrow').set(bearer(as)).send(body as object);

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  mailCalls.length = 0;
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN' });
  reader = await createUser({ email: 'reader@it.local', name: 'Độc giả IT' });
  book = await createBook('LST-IT-01', 3, 'Sách danh sách');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/loans/borrow — mượn theo bookId / bookItemId', () => {
  test('IT-LST-01 mượn theo bookId → 200, một bản chuyển BORROWED, Loan ACTIVE hạn +14 ngày, có thông báo, khả dụng 3 → 2', async () => {
    const res = await borrow({ bookId: book.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: reader.id, rawStatus: 'ACTIVE', status: 'On Time', availableCopies: 2 });
    const loan = await prisma.loan.findFirstOrThrow({ where: { userId: reader.id } });
    expect(daysBetween(loan.borrowDate, loan.dueDate)).toBe(14);
    expect(await availableCount(book.id)).toBe(2);
    expect((await prisma.bookItem.findUniqueOrThrow({ where: { id: loan.bookItemId } })).status).toBe('BORROWED');
    expect((await prisma.notification.findMany({ where: { userId: reader.id } })).map((n) => n.title)).toEqual(['Mượn sách thành công']);
  });

  test('IT-LST-02 mượn theo bookItemId cụ thể → đúng bản đó được mượn', async () => {
    const res = await borrow({ bookItemId: book.items[2].id });
    expect(res.status).toBe(200);
    expect(res.body.bookItemId).toBe(book.items[2].id);
    expect((await prisma.bookItem.findUniqueOrThrow({ where: { id: book.items[2].id } })).status).toBe('BORROWED');
  });

  test('IT-LST-03 (BOR-06) bản đã được mượn hoặc sách hết bản → 400, không tạo phiếu', async () => {
    await createLoan(admin.id, book.items[0].id);
    expect((await borrow({ bookItemId: book.items[0].id })).status).toBe(400);
    for (const item of book.items.slice(1)) await prisma.bookItem.update({ where: { id: item.id }, data: { status: 'LOST' } });
    expect((await borrow({ bookId: book.id })).status).toBe(400);
    expect(await prisma.loan.count({ where: { userId: reader.id } })).toBe(0);
  });

  test('IT-LST-04 thiếu cả bookId và bookItemId → 400; không token → 401', async () => {
    expect((await borrow({})).status).toBe(400);
    expect((await request(app).post('/api/loans/borrow').send({ bookId: book.id })).status).toBe(401);
  });

  test('IT-LST-05 (BOR-10) độc giả Blacklist → 403; có phiếu quá hạn → 400; đều không tạo phiếu', async () => {
    const blocked = await createUser({ email: 'blocked@it.local', isBlacklisted: true });
    expect((await borrow({ bookId: book.id }, blocked)).status).toBe(403);
    const late = await createUser({ email: 'late@it.local' });
    await createLoan(late.id, book.items[0].id, { dueDate: new Date(Date.now() - 2 * DAY) });
    expect((await borrow({ bookId: book.id }, late)).status).toBe(400);
    expect(await prisma.loan.count({ where: { userId: blocked.id } })).toBe(0);
    expect(await prisma.loan.count({ where: { userId: late.id } })).toBe(1);
  });

  test('IT-LST-06 hạn mức STANDARD 5 cuốn: mượn cuốn thứ 5 được, cuốn thứ 6 bị 400', async () => {
    const many = await createBook('LST-IT-MANY', 7, 'Nhiều bản');
    for (let i = 0; i < 5; i++) expect((await borrow({ bookItemId: many.items[i].id })).status).toBe(200);
    const sixth = await borrow({ bookItemId: many.items[5].id });
    expect(sixth.status).toBe(400);
    expect(sixth.body.error).toContain('5/5');
    expect(await prisma.loan.count({ where: { userId: reader.id } })).toBe(5);
  });

  test('IT-LST-07 hạn mức PREMIUM là 10 cuốn (cuốn thứ 6 vẫn được mượn)', async () => {
    const premium = await createUser({ email: 'premium@it.local', membershipTier: 'PREMIUM' });
    const many = await createBook('LST-IT-PREM', 7, 'Nhiều bản');
    for (let i = 0; i < 6; i++) expect((await borrow({ bookItemId: many.items[i].id }, premium)).status).toBe(200);
  });

  // KNOWN BUG DEF-005 — đặc tả: PREMIUM 30 ngày; hệ thống luôn cho +14 ngày.
  test.fails('IT-LST-08 (DEF-005) độc giả PREMIUM mượn → hạn trả +30 ngày', async () => {
    const premium = await createUser({ email: 'premium2@it.local', membershipTier: 'PREMIUM' });
    expect((await borrow({ bookId: book.id }, premium)).status).toBe(200);
    const loan = await prisma.loan.findFirstOrThrow({ where: { userId: premium.id } });
    expect(daysBetween(loan.borrowDate, loan.dueDate)).toBe(30);
  });
});

describe('GET /api/loans/my và /api/loans/all', () => {
  test('IT-LST-09 /my chỉ trả phiếu của người gọi, mới nhất trước, kèm thông tin sách', async () => {
    const other = await createUser({ email: 'other@it.local' });
    await createLoan(reader.id, book.items[0].id, { borrowDate: new Date('2026-01-01T00:00:00Z') });
    await createLoan(reader.id, book.items[1].id, { borrowDate: new Date('2026-06-01T00:00:00Z') });
    await createLoan(other.id, book.items[2].id);
    const res = await request(app).get('/api/loans/my').set(bearer(reader));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((l: any) => l.bookItemId)).toEqual([book.items[1].id, book.items[0].id]);
    expect(res.body[0].book).toMatchObject({ title: 'Sách danh sách', author: 'Nhóm 8' });
  });

  test('IT-LST-10 /my phản ánh trạng thái hiển thị: quá hạn → Overdue kèm phạt tính theo ngày; đã trả → Returned', async () => {
    await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 3 * DAY) });
    await createLoan(reader.id, book.items[1].id, { returnDate: new Date(), status: 'COMPLETED' });
    const res = await request(app).get('/api/loans/my').set(bearer(reader));
    const byItem = Object.fromEntries(res.body.map((l: any) => [l.bookItemId, l]));
    expect(byItem[book.items[0].id]).toMatchObject({ status: 'Overdue', fineAmount: 15000 });
    expect(byItem[book.items[1].id]).toMatchObject({ status: 'Returned' });
  });

  test('IT-LST-11 /all chỉ ADMIN; trả phiếu của mọi độc giả; USER → 403; không token → 401', async () => {
    const other = await createUser({ email: 'other@it.local' });
    await createLoan(reader.id, book.items[0].id);
    await createLoan(other.id, book.items[1].id);
    expect((await request(app).get('/api/loans/all').set(bearer(reader))).status).toBe(403);
    expect((await request(app).get('/api/loans/all')).status).toBe(401);
    const res = await request(app).get('/api/loans/all').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.map((l: any) => l.userId).sort()).toEqual([reader.id, other.id].sort());
    expect(res.body[0].user).toHaveProperty('email');
  });

  test('IT-LST-12 /my không token → 401', async () => {
    expect((await request(app).get('/api/loans/my')).status).toBe(401);
  });
});

describe('GET /api/loans/barcode/:barcode — tra cứu mã vạch', () => {
  const lookup = (barcode: string, as = admin) => request(app).get(`/api/loans/barcode/${encodeURIComponent(barcode)}`).set(bearer(as));

  test('IT-LST-13 bản chưa mượn → activeLoan null; đang mượn → trả phiếu và người mượn', async () => {
    const free = await lookup('LST-IT-01-1');
    expect(free.status).toBe(200);
    expect(free.body).toMatchObject({ bookItem: { barcode: 'LST-IT-01-1', status: 'AVAILABLE' }, activeLoan: null, book: { title: 'Sách danh sách' } });
    await createLoan(reader.id, book.items[0].id);
    const held = await lookup('LST-IT-01-1');
    expect(held.body.activeLoan).toMatchObject({ status: 'ACTIVE', user: { id: reader.id, name: 'Độc giả IT' } });
  });

  test('IT-LST-14 mã vạch không tồn tại → 404; không token → 401', async () => {
    expect((await lookup('KHONG-CO')).status).toBe(404);
    expect((await request(app).get('/api/loans/barcode/LST-IT-01-1')).status).toBe(401);
  });
});

describe('POST /api/loans/reminders/trigger — quét nhắc hạn (mail bị stub)', () => {
  const trigger = (as = admin) => request(app).post('/api/loans/reminders/trigger').set(bearer(as));

  test('IT-LST-15 USER → 403; không token → 401; không gửi mail', async () => {
    expect((await trigger(reader)).status).toBe(403);
    expect((await request(app).post('/api/loans/reminders/trigger')).status).toBe(401);
    expect(mailCalls).toHaveLength(0);
  });

  test('IT-LST-16 (MAIL-01) phiếu quá hạn → DB chuyển OVERDUE + phạt 5.000/ngày, có thông báo; phiếu sắp hạn → thông báo; phiếu còn lâu → bỏ qua', async () => {
    const overdue = await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 3 * DAY) });
    const soon = await createLoan(reader.id, book.items[1].id, { dueDate: new Date(Date.now() + 1 * DAY) });
    const far = await createLoan(reader.id, book.items[2].id, { dueDate: new Date(Date.now() + 10 * DAY) });
    const res = await trigger();
    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ totalActiveLoans: 3, overdueCount: 1, dueSoonCount: 1, updatedOverdueCount: 1, emailsSent: 2, failedCount: 0 });
    expect(await prisma.loan.findUniqueOrThrow({ where: { id: overdue.id } })).toMatchObject({ status: 'OVERDUE', fineAmount: 15000 });
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: soon.id } })).status).toBe('ACTIVE');
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: far.id } })).status).toBe('ACTIVE');
    const titles = (await prisma.notification.findMany({ where: { userId: reader.id } })).map((n) => n.title).sort();
    expect(titles).toEqual(['Cảnh báo sách quá hạn!', 'Nhắc nhở sắp đến hạn trả sách']);
    expect(mailCalls.map((m) => m.fn).sort()).toEqual(['sendDueSoonReminderEmail', 'sendOverdueReminderEmail']);
  });

  test('IT-LST-17 phiếu đã trả không bị quét; DB không có phiếu → báo cáo toàn số 0', async () => {
    await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 5 * DAY), returnDate: new Date(), status: 'COMPLETED' });
    const res = await trigger();
    expect(res.body.report).toMatchObject({ totalActiveLoans: 0, overdueCount: 0, dueSoonCount: 0, emailsSent: 0 });
    expect(mailCalls).toHaveLength(0);
  });

  test('IT-LST-18 quét hai lần liên tiếp: phạt không bị cộng dồn (vẫn 5.000 × số ngày trễ)', async () => {
    const overdue = await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 2 * DAY) });
    await trigger();
    await trigger();
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: overdue.id } })).fineAmount).toBe(10000);
  });
});

describe('POST /api/loans/return — trả sách theo mã phiếu', () => {
  const giveBackById = (loanId: unknown, as = admin) => request(app).post('/api/loans/return').set(bearer(as)).send({ loanId });

  test('IT-LST-19 (RET-01) trả đúng hạn → COMPLETED, bản sao AVAILABLE, thông báo; USER → 403; thiếu/không tồn tại loanId → 400/404', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    expect((await giveBackById(loan.id, reader)).status).toBe(403);
    expect((await giveBackById(undefined)).status).toBe(400);
    expect((await giveBackById(99999)).status).toBe(404);
    const res = await giveBackById(loan.id);
    expect(res.status).toBe(200);
    expect(await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).toMatchObject({ status: 'COMPLETED', fineAmount: 0 });
    expect((await prisma.bookItem.findUniqueOrThrow({ where: { id: book.items[0].id } })).status).toBe('AVAILABLE');
    expect((await prisma.notification.findMany({ where: { userId: reader.id } })).map((n) => n.title)).toContain('Trả sách thành công');
    expect((await giveBackById(loan.id)).status).toBe(400); // phiếu COMPLETED không trả lại được
  });

  test('IT-LST-20 trả trễ 3 ngày → phiếu giữ OVERDUE với phạt 15.000; người đặt trước nhận thông báo và yêu cầu chuyển NOTIFIED', async () => {
    const waiting = await createUser({ email: 'waiting@it.local' });
    const loan = await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 3 * DAY), status: 'OVERDUE' });
    for (const item of book.items.slice(1)) await prisma.bookItem.update({ where: { id: item.id }, data: { status: 'LOST' } });
    const reservation = await prisma.reservation.create({ data: { userId: waiting.id, bookId: book.id } });
    const res = await giveBackById(loan.id);
    expect(res.status).toBe(200);
    expect(res.body.reservationNotice).toMatchObject({ userEmail: 'waiting@it.local' });
    expect(await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).toMatchObject({ status: 'OVERDUE', fineAmount: 15000 });
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe('NOTIFIED');
    expect((await prisma.notification.findMany({ where: { userId: waiting.id } })).map((n) => n.title)).toEqual(['Sách bạn đặt trước đã có sẵn!']);
  });

  // NEW FINDING FIND-21 — trả lại phiếu đã trả (còn nợ phạt): bản sách bị đặt AVAILABLE dù người khác đang mượn.
  test.fails('IT-LST-21 (FIND-21) trả lại phiếu đã có returnDate không được làm bản sao đang được người khác mượn thành AVAILABLE', async () => {
    const first = await createLoan(reader.id, book.items[0].id, { dueDate: new Date(Date.now() - 3 * DAY), status: 'OVERDUE' });
    expect((await giveBackById(first.id)).status).toBe(200); // trả lần đầu, còn nợ phạt → OVERDUE có returnDate
    const other = await createUser({ email: 'next@it.local' });
    expect((await borrow({ bookItemId: book.items[0].id }, other)).status).toBe(200); // người khác mượn đúng bản đó
    await giveBackById(first.id); // trả lại phiếu cũ
    expect((await prisma.bookItem.findUniqueOrThrow({ where: { id: book.items[0].id } })).status).toBe('BORROWED');
  });
});

describe('Duyệt gia hạn khi chưa có yêu cầu', () => {
  // NEW FINDING FIND-22 — máy trạng thái NONE → PENDING → APPROVED; duyệt khi renewalStatus còn NONE vẫn thành công.
  test.fails('IT-LST-22 (FIND-22) duyệt gia hạn cho phiếu chưa có yêu cầu PENDING phải bị chặn, hạn trả không đổi', async () => {
    const loan = await createLoan(reader.id, book.items[0].id);
    const res = await request(app).post(`/api/loans/${loan.id}/approve-renew`).set(bearer(admin));
    expect(res.status).toBe(400);
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).dueDate.getTime()).toBe(loan.dueDate.getTime());
  });
});
