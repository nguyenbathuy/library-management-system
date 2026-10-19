/**
 * Mục tiêu: kiểm thử tích hợp API đặt trước sách (/api/reservations) qua HTTP thật trên SQLite tạm, gồm tác động
 *   lên bảng Reservation và Notification.
 * Kỹ thuật: hộp đen mức API + kiểm tra DB; phân vùng tương đương theo vai trò (USER/ADMIN) và trạng thái đặt trước.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): RES-01 (đặt trước sách hết bản → WAITING + thông báo),
 *   RES-02 (sách còn bản → từ chối), RES-03 (đặt trùng), RES-04 (Admin WAITING → NOTIFIED → FULFILLED, độc giả nhận
 *   thông báo), RES-05 (hủy: chủ sở hữu / Admin / người khác).
 * test.fails: NEW FINDING FIND-06/07 (chuyển trạng thái tùy ý; hủy phiếu đã FULFILLED — căn cứ chú thích routes, cần nhóm
 *   xác nhận) và FIND-10 (id không phải số → HTTP 500 thay vì 400/404, cùng họ với FIND-02/03).
 * Ranh giới: không kiểm thử giao diện (danh sách "Hồ sơ", chuông thông báo).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../helpers/app';
import { bearer, createBook, createLoan, createUser, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;
let other: Awaited<ReturnType<typeof createUser>>;
let soldOut: Awaited<ReturnType<typeof createBook>>; // 0 bản AVAILABLE
let inStock: Awaited<ReturnType<typeof createBook>>; // còn bản

const reserve = (bookId: unknown, as = reader) => request(app).post('/api/reservations').set(bearer(as)).send({ bookId });
const rows = (where: Record<string, unknown> = {}) => prisma.reservation.findMany({ where, orderBy: { id: 'asc' } });

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN' });
  reader = await createUser({ email: 'reader@it.local', name: 'Độc giả A' });
  other = await createUser({ email: 'other@it.local', name: 'Độc giả B' });
  soldOut = await createBook('RES-IT-OUT', 1);
  inStock = await createBook('RES-IT-IN', 2);
  await createLoan(other.id, soldOut.items[0].id); // bản duy nhất đang được mượn → sách hết bản
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Tạo đặt trước — POST /api/reservations', () => {
  test('IT-RES-01 (RES-01) sách hết bản → 201, Reservation WAITING trong DB, độc giả nhận thông báo, vị trí hàng đợi 1', async () => {
    const res = await reserve(soldOut.id);
    expect(res.status).toBe(201);
    expect(res.body.queuePosition).toBe(1);
    expect(res.body.reservation).toMatchObject({ status: 'WAITING', userId: reader.id, bookId: soldOut.id });
    expect(await rows({ userId: reader.id, bookId: soldOut.id })).toHaveLength(1);
    const notes = await prisma.notification.findMany({ where: { userId: reader.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: 'Đặt trước sách thành công', isRead: false });
  });

  test('IT-RES-02 hai độc giả đặt cùng sách → vị trí hàng đợi 1 và 2', async () => {
    const third = await createUser({ email: 'third@it.local' });
    expect((await reserve(soldOut.id)).body.queuePosition).toBe(1);
    expect((await reserve(soldOut.id, third)).body.queuePosition).toBe(2);
  });

  test('IT-RES-03 (RES-02) sách còn bản AVAILABLE → 400, không tạo đặt trước, không thông báo', async () => {
    const res = await reserve(inStock.id);
    expect(res.status).toBe(400);
    expect(await rows()).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  test('IT-RES-04 (RES-03) đặt trùng cùng đầu sách → 400, chỉ còn đúng 1 yêu cầu', async () => {
    expect((await reserve(soldOut.id)).status).toBe(201);
    const again = await reserve(soldOut.id);
    expect(again.status).toBe(400);
    expect(await rows({ userId: reader.id })).toHaveLength(1);
  });

  test('IT-RES-05 sau khi hủy, được đặt lại (yêu cầu CANCELLED không chặn)', async () => {
    const first = await reserve(soldOut.id);
    await request(app).delete(`/api/reservations/${first.body.reservation.id}`).set(bearer(reader));
    expect((await reserve(soldOut.id)).status).toBe(201);
    expect((await rows({ userId: reader.id })).map((r) => r.status)).toEqual(['CANCELLED', 'WAITING']);
  });

  test('IT-RES-06 độc giả đang mượn chính cuốn sách đó → 400', async () => {
    const res = await reserve(soldOut.id, other);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('đang mượn');
    expect(await rows({ userId: other.id })).toHaveLength(0);
  });

  test('IT-RES-07 sách không tồn tại → 404; thiếu bookId → 400; không token → 401', async () => {
    expect((await reserve(99999)).status).toBe(404);
    expect((await reserve(undefined)).status).toBe(400);
    expect((await request(app).post('/api/reservations').send({ bookId: soldOut.id })).status).toBe(401);
    expect(await rows()).toHaveLength(0);
  });

  // NEW FINDING FIND-10 — bookId không phải số nguyên hợp lệ là lỗi của client (4xx), nhưng Number("abc") = NaN
  // làm Prisma ném PrismaClientValidationError → HTTP 500.
  test.fails('IT-RES-08 (FIND-10) bookId = "abc" phải trả 4xx, không phải 500', async () => {
    const res = await reserve('abc');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('Danh sách đặt trước', () => {
  test('IT-RES-09 /my chỉ trả yêu cầu của chính người gọi; /all chỉ ADMIN, lọc theo trạng thái', async () => {
    await reserve(soldOut.id);
    const third = await createUser({ email: 'third@it.local' });
    await reserve(soldOut.id, third);
    const mine = await request(app).get('/api/reservations/my').set(bearer(reader));
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ userId: reader.id, status: 'WAITING', book: { title: soldOut.title, available: 0, totalCopies: 1 } });

    expect((await request(app).get('/api/reservations/all').set(bearer(reader))).status).toBe(403);
    const all = await request(app).get('/api/reservations/all').set(bearer(admin));
    expect(all.body).toHaveLength(2);
    expect((await request(app).get('/api/reservations/all?status=CANCELLED').set(bearer(admin))).body).toEqual([]);
    expect((await request(app).get('/api/reservations/all?status=ALL').set(bearer(admin))).body).toHaveLength(2);
  });

  test('IT-RES-10 không token → 401 ở /my và /all', async () => {
    expect((await request(app).get('/api/reservations/my')).status).toBe(401);
    expect((await request(app).get('/api/reservations/all')).status).toBe(401);
  });
});

describe('Admin xử lý — PATCH /api/reservations/:id/status (RES-04)', () => {
  let reservationId: number;
  beforeEach(async () => {
    reservationId = (await reserve(soldOut.id)).body.reservation.id;
    await prisma.notification.deleteMany(); // chỉ quan sát thông báo do bước đổi trạng thái tạo ra
  });
  const patch = (status: unknown, as = admin) => request(app).patch(`/api/reservations/${reservationId}/status`).set(bearer(as)).send({ status });

  test('IT-RES-11 (RES-04) WAITING → NOTIFIED: lưu DB và độc giả nhận thông báo "đã có sẵn"', async () => {
    const res = await patch('NOTIFIED');
    expect(res.status).toBe(200);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe('NOTIFIED');
    const notes = await prisma.notification.findMany({ where: { userId: reader.id } });
    expect(notes.map((n) => n.title)).toEqual(['Sách đặt trước đã có sẵn!']);
  });

  test('IT-RES-12 (RES-04) NOTIFIED → FULFILLED: trạng thái lưu, không thêm thông báo', async () => {
    await patch('NOTIFIED');
    await prisma.notification.deleteMany();
    expect((await patch('FULFILLED')).status).toBe(200);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe('FULFILLED');
    expect(await prisma.notification.count()).toBe(0);
  });

  test('IT-RES-13 USER → 403, trạng thái không đổi', async () => {
    expect((await patch('NOTIFIED', reader)).status).toBe(403);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe('WAITING');
  });

  test.each([[undefined], ['DONE'], ['waiting']])('IT-RES-14 status %s không hợp lệ → 400, không đổi', async (value) => {
    expect((await patch(value)).status).toBe(400);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe('WAITING');
  });

  test('IT-RES-15 id không tồn tại → 404', async () => {
    expect((await request(app).patch('/api/reservations/99999/status').set(bearer(admin)).send({ status: 'NOTIFIED' })).status).toBe(404);
  });

  // NEW FINDING FIND-06 (căn cứ: chú thích routes "WAITING -> NOTIFIED -> FULFILLED / CANCELLED").
  test.fails('IT-RES-16 (FIND-06) FULFILLED → WAITING (đi ngược) phải bị chặn, trạng thái DB vẫn FULFILLED', async () => {
    await patch('NOTIFIED');
    await patch('FULFILLED');
    const res = await patch('WAITING');
    expect(res.status).toBe(400);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe('FULFILLED');
  });
});

describe('Hủy đặt trước — DELETE /api/reservations/:id (RES-05)', () => {
  let reservationId: number;
  beforeEach(async () => {
    reservationId = (await reserve(soldOut.id)).body.reservation.id;
  });
  const cancel = (as: typeof reader | undefined, id: number | string = reservationId) => {
    const req = request(app).delete(`/api/reservations/${id}`);
    return as ? req.set(bearer(as)) : req;
  };
  const statusInDb = async () => (await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status;

  test('IT-RES-17 (RES-05) độc giả hủy yêu cầu của mình → CANCELLED', async () => {
    expect((await cancel(reader)).status).toBe(200);
    expect(await statusInDb()).toBe('CANCELLED');
  });

  test('IT-RES-18 (RES-05) độc giả khác hủy yêu cầu không phải của mình → 403, vẫn WAITING', async () => {
    expect((await cancel(other)).status).toBe(403);
    expect(await statusInDb()).toBe('WAITING');
  });

  test('IT-RES-19 (RES-05) Admin hủy yêu cầu của độc giả khác → CANCELLED', async () => {
    expect((await cancel(admin)).status).toBe(200);
    expect(await statusInDb()).toBe('CANCELLED');
  });

  test('IT-RES-20 không token → 401; id không tồn tại → 404', async () => {
    expect((await cancel(undefined)).status).toBe(401);
    expect((await cancel(reader, 99999)).status).toBe(404);
    expect(await statusInDb()).toBe('WAITING');
  });

  // NEW FINDING FIND-07 — độc giả đã nhận sách (FULFILLED) vẫn hủy được và hồ sơ đổi thành CANCELLED.
  test.fails('IT-RES-21 (FIND-07) hủy yêu cầu đã FULFILLED phải bị chặn, DB vẫn FULFILLED', async () => {
    await request(app).patch(`/api/reservations/${reservationId}/status`).set(bearer(admin)).send({ status: 'FULFILLED' });
    const res = await cancel(reader);
    expect(res.status).toBe(400);
    expect(await statusInDb()).toBe('FULFILLED');
  });

  // NEW FINDING FIND-10 (id đường dẫn không phải số).
  test.fails('IT-RES-22 (FIND-10) DELETE /reservations/abc phải trả 4xx, không phải 500', async () => {
    const res = await cancel(reader, 'abc');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
