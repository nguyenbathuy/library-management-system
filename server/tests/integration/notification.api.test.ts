/**
 * Mục tiêu: kiểm thử tích hợp API thông báo (/api/notifications) qua HTTP thật trên SQLite tạm, gồm cách ly dữ liệu
 *   giữa các người dùng và thông báo sinh ra từ các sự kiện khác (đặt trước, đổi mật khẩu).
 * Kỹ thuật: hộp đen mức API + kiểm tra DB; phân vùng tương đương (chủ thông báo / người khác / chưa đăng nhập).
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): NOTI-01 (thông báo mới + số chưa đọc đúng chủ), NOTI-02 (đánh dấu một/tất cả
 *   đã đọc, xóa một/tất cả).
 * test.fails: NEW FINDING FIND-10 (id không phải số → HTTP 500 thay vì 4xx).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../helpers/app';
import { bearer, createUser, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const app = buildApp();
let reader: Awaited<ReturnType<typeof createUser>>;
let other: Awaited<ReturnType<typeof createUser>>;

const note = (userId: number, title: string, isRead = false, createdAt = new Date()) =>
  prisma.notification.create({ data: { userId, title, message: `Nội dung ${title}`, isRead, createdAt } });
const list = (as = reader) => request(app).get('/api/notifications').set(bearer(as));

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  reader = await createUser({ email: 'reader@it.local' });
  other = await createUser({ email: 'other@it.local' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/notifications (NOTI-01)', () => {
  test('IT-NOT-01 không token → 401 ở mọi endpoint thông báo', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).patch('/api/notifications/read-all')).status).toBe(401);
    expect((await request(app).patch('/api/notifications/1/read')).status).toBe(401);
    expect((await request(app).delete('/api/notifications/1')).status).toBe(401);
    expect((await request(app).delete('/api/notifications/clear-all')).status).toBe(401);
  });

  test('IT-NOT-02 (NOTI-01) chỉ trả thông báo của chính mình, mới nhất trước, kèm số chưa đọc đúng', async () => {
    await note(reader.id, 'Cũ', true, new Date('2026-01-01'));
    await note(reader.id, 'Mới', false, new Date('2026-06-01'));
    await note(other.id, 'Của người khác');
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.notifications.map((n: any) => n.title)).toEqual(['Mới', 'Cũ']);
    expect(res.body.unreadCount).toBe(1);
    expect((await list(other)).body.notifications.map((n: any) => n.title)).toEqual(['Của người khác']);
  });

  test('IT-NOT-03 tối đa 50 thông báo gần nhất; số chưa đọc vẫn đếm đủ', async () => {
    await prisma.notification.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({ userId: reader.id, title: `T${i}`, message: 'm', createdAt: new Date(2026, 0, 1, 0, i) })),
    });
    const res = await list();
    expect(res.body.notifications).toHaveLength(50);
    expect(res.body.notifications[0].title).toBe('T54');
    expect(res.body.unreadCount).toBe(55);
  });

  test('IT-NOT-04 (NOTI-01) sự kiện đặt trước tạo thông báo cho đúng người, chưa đọc', async () => {
    const book = await prisma.book.create({
      data: { title: 'Hết bản', isbn: 'NOT-IT-1', category: { create: { name: 'C' } }, author: { create: { name: 'A' } } },
    });
    expect((await request(app).post('/api/reservations').set(bearer(reader)).send({ bookId: book.id })).status).toBe(201);
    const res = await list();
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.notifications[0].title).toBe('Đặt trước sách thành công');
    expect((await list(other)).body.unreadCount).toBe(0);
  });
});

describe('Đánh dấu đã đọc (NOTI-02)', () => {
  test('IT-NOT-05 đánh dấu một thông báo của mình → isRead = true, số chưa đọc giảm', async () => {
    const a = await note(reader.id, 'A');
    await note(reader.id, 'B');
    const res = await request(app).patch(`/api/notifications/${a.id}/read`).set(bearer(reader));
    expect(res.status).toBe(200);
    expect(res.body.isRead).toBe(true);
    expect((await list()).body.unreadCount).toBe(1);
  });

  test('IT-NOT-06 đánh dấu thông báo của người khác / không tồn tại → 404, dữ liệu không đổi', async () => {
    const foreign = await note(other.id, 'Của người khác');
    expect((await request(app).patch(`/api/notifications/${foreign.id}/read`).set(bearer(reader))).status).toBe(404);
    expect((await request(app).patch('/api/notifications/99999/read').set(bearer(reader))).status).toBe(404);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: foreign.id } })).isRead).toBe(false);
  });

  test('IT-NOT-07 (NOTI-02) đánh dấu tất cả đã đọc: chỉ ảnh hưởng thông báo của mình', async () => {
    await note(reader.id, 'A');
    await note(reader.id, 'B');
    await note(other.id, 'C');
    const res = await request(app).patch('/api/notifications/read-all').set(bearer(reader));
    expect(res.status).toBe(200);
    expect((await list()).body.unreadCount).toBe(0);
    expect((await list(other)).body.unreadCount).toBe(1);
  });
});

describe('Xóa thông báo (NOTI-02)', () => {
  test('IT-NOT-08 xóa một thông báo của mình → biến mất khỏi danh sách và DB', async () => {
    const a = await note(reader.id, 'A');
    await note(reader.id, 'B');
    expect((await request(app).delete(`/api/notifications/${a.id}`).set(bearer(reader))).status).toBe(200);
    expect(await prisma.notification.findUnique({ where: { id: a.id } })).toBeNull();
    expect((await list()).body.notifications).toHaveLength(1);
  });

  test('IT-NOT-09 xóa thông báo của người khác / không tồn tại → 404, không xóa', async () => {
    const foreign = await note(other.id, 'Của người khác');
    expect((await request(app).delete(`/api/notifications/${foreign.id}`).set(bearer(reader))).status).toBe(404);
    expect((await request(app).delete('/api/notifications/99999').set(bearer(reader))).status).toBe(404);
    expect(await prisma.notification.count({ where: { userId: other.id } })).toBe(1);
  });

  test('IT-NOT-10 (NOTI-02) xóa tất cả: chỉ xóa của mình, "clear-all" không bị hiểu nhầm là :id', async () => {
    await note(reader.id, 'A');
    await note(reader.id, 'B');
    await note(other.id, 'C');
    const res = await request(app).delete('/api/notifications/clear-all').set(bearer(reader));
    expect(res.status).toBe(200);
    expect(await prisma.notification.count({ where: { userId: reader.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: other.id } })).toBe(1);
  });
});

describe('Đầu vào bất thường', () => {
  // NEW FINDING FIND-10 — id không phải số làm Prisma ném lỗi validate → HTTP 500 (lỗi client phải là 4xx).
  test.fails.each([
    ['PATCH /notifications/abc/read', () => request(app).patch('/api/notifications/abc/read').set(bearer(reader))],
    ['DELETE /notifications/abc', () => request(app).delete('/api/notifications/abc').set(bearer(reader))],
  ])('IT-NOT-11 (FIND-10) %s phải trả 4xx, không phải 500', async (_label, send) => {
    const res = await send();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
