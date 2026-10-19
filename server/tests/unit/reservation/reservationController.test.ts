/**
 * Mục tiêu: kiểm thử đơn vị reservationController (đặt trước sách): tạo, liệt kê, đổi trạng thái, hủy.
 * Kỹ thuật: hộp trắng phủ nhánh + phân vùng tương đương (vai trò USER/ADMIN, trạng thái đặt trước WAITING/NOTIFIED/
 *   FULFILLED/CANCELLED) + kiểm thử chuyển trạng thái. Prisma và notificationService được mock TRƯỚC khi import controller.
 * Ranh giới: chỉ chứng minh controller → lời gọi Prisma/notification; KHÔNG chứng minh ghi SQLite thật
 *   (xem tests/integration/reservation.api.test.ts) và không kiểm thử giao diện.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): RES-01 (đặt trước sách hết bản), RES-02 (sách còn bản → từ chối),
 *   RES-03 (đặt trùng), RES-04 (Admin xử lý WAITING → NOTIFIED → FULFILLED), RES-05 (hủy).
 * test.fails = viết theo luồng trạng thái ghi trong chú thích routes/reservationRoutes.ts
 *   (WAITING → NOTIFIED → FULFILLED / CANCELLED), hệ thống hiện chấp nhận mọi chuyển trạng thái:
 *   NEW FINDING FIND-06 (đổi trạng thái tùy ý), FIND-07 (hủy phiếu đã FULFILLED). Căn cứ là chú thích mã nguồn,
 *   nhóm cần xác nhận đây là yêu cầu nghiệp vụ.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { callHandler, resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    book: d('findUnique'),
    bookItem: d('count'),
    loan: d('findFirst'),
    reservation: d('findFirst', 'create', 'count', 'findMany', 'findUnique', 'update'),
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
  cancelReservation, createReservation, getAllReservations, getMyReservations, updateReservationStatus,
} from '../../../src/controllers/reservationController';

const ADMIN = { userId: 1, email: 'admin@test.local', role: 'ADMIN' };
const READER = { userId: 2, email: 'reader@test.local', role: 'USER' };

const book = (overrides: Record<string, unknown> = {}) => ({
  id: 100, title: 'Sách hết bản', isbn: '978', coverImage: 'c.png',
  author: { name: 'Tác giả' }, category: { name: 'Thể loại' },
  items: [{ status: 'BORROWED' }, { status: 'AVAILABLE' }, { status: 'LOST' }],
  ...overrides,
});
const reservation = (overrides: Record<string, unknown> = {}) => ({
  id: 9, userId: 2, bookId: 100, status: 'WAITING', createdAt: new Date('2026-10-01T00:00:00Z'),
  user: { id: 2, name: 'Độc giả', email: 'reader@test.local', membershipTier: 'STANDARD' },
  book: book(),
  ...overrides,
});

const allMocks = () => [
  mocks.prisma.book.findUnique, mocks.prisma.bookItem.count, mocks.prisma.loan.findFirst,
  ...Object.values(mocks.prisma.reservation), mocks.prisma.$connect, mocks.prisma.$disconnect, mocks.createNotification,
];

beforeAll(() => {
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  resetMocks(allMocks());
  mocks.createNotification.mockResolvedValue({ id: 1 });
});

afterAll(() => {
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

function expectNoWrite() {
  expect(mocks.prisma.reservation.create).not.toHaveBeenCalled();
  expect(mocks.prisma.reservation.update).not.toHaveBeenCalled();
  expect(mocks.createNotification).not.toHaveBeenCalled();
}

// ---------------------------------------------------------------- Tạo
describe('createReservation — POST /reservations', () => {
  function arrangeValid() {
    mocks.prisma.book.findUnique.mockResolvedValue(book());
    mocks.prisma.bookItem.count.mockResolvedValue(0);
    mocks.prisma.reservation.findFirst.mockResolvedValue(null);
    mocks.prisma.loan.findFirst.mockResolvedValue(null);
    mocks.prisma.reservation.create.mockResolvedValue(reservation());
    mocks.prisma.reservation.count.mockResolvedValue(3);
  }

  test('UT-RES-01 (RES-01) sách hết bản → tạo WAITING, trả 201 + vị trí hàng đợi, gửi thông báo', async () => {
    arrangeValid();
    const res = await callHandler(createReservation, { body: { bookId: 100 }, user: READER });
    expect(res.statusCode).toBe(201);
    expect(mocks.prisma.reservation.create.mock.calls[0][0].data).toEqual({ userId: 2, bookId: 100, status: 'WAITING' });
    expect(res.payload.queuePosition).toBe(3);
    expect(res.payload.message).toContain('thứ 3');
    expect(res.payload.reservation).toMatchObject({ id: 9, status: 'WAITING', userId: 2, bookId: 100 });
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 2, title: 'Đặt trước sách thành công' }));
  });

  test('UT-RES-02 bookId dạng chuỗi số "100" được ép sang số khi truy vấn', async () => {
    arrangeValid();
    await callHandler(createReservation, { body: { bookId: '100' }, user: READER });
    expect(mocks.prisma.book.findUnique.mock.calls[0][0].where).toEqual({ id: 100 });
    expect(mocks.prisma.bookItem.count.mock.calls[0][0].where).toEqual({ bookId: 100, status: 'AVAILABLE' });
  });

  test('UT-RES-03 chưa đăng nhập (không có userId) → 401, không truy vấn DB', async () => {
    const res = await callHandler(createReservation, { body: { bookId: 100 } });
    expect(res.statusCode).toBe(401);
    expect(mocks.prisma.book.findUnique).not.toHaveBeenCalled();
  });

  test.each([
    ['UT-RES-04a thiếu bookId', {}],
    ['UT-RES-04b bookId = 0 (falsy, biên dưới)', { bookId: 0 }],
    ['UT-RES-04c bookId rỗng', { bookId: '' }],
    ['UT-RES-04d bookId null', { bookId: null }],
  ])('%s → 400, không tạo đặt trước', async (_id, body) => {
    const res = await callHandler(createReservation, { body, user: READER });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('bookId');
    expectNoWrite();
  });

  test('UT-RES-05 đầu sách không tồn tại → 404', async () => {
    mocks.prisma.book.findUnique.mockResolvedValue(null);
    const res = await callHandler(createReservation, { body: { bookId: 999 }, user: READER });
    expect(res.statusCode).toBe(404);
    expectNoWrite();
  });

  test('UT-RES-06 (RES-02) sách còn bản AVAILABLE → 400 "mượn trực tiếp", không tạo đặt trước', async () => {
    mocks.prisma.book.findUnique.mockResolvedValue(book());
    mocks.prisma.bookItem.count.mockResolvedValue(1);
    const res = await callHandler(createReservation, { body: { bookId: 100 }, user: READER });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('mượn trực tiếp');
    expectNoWrite();
  });

  test.each([
    ['UT-RES-07a (RES-03) đã có yêu cầu WAITING', 'WAITING', 'Đang chờ sách'],
    ['UT-RES-07b (RES-03) đã có yêu cầu NOTIFIED', 'NOTIFIED', 'đang chờ bạn đến nhận'],
  ])('%s → 400 kèm trạng thái hiện có, không tạo thêm', async (_id, status, hint) => {
    mocks.prisma.book.findUnique.mockResolvedValue(book());
    mocks.prisma.bookItem.count.mockResolvedValue(0);
    mocks.prisma.reservation.findFirst.mockResolvedValue(reservation({ status }));
    const res = await callHandler(createReservation, { body: { bookId: 100 }, user: READER });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain(hint);
    expect(mocks.prisma.reservation.findFirst.mock.calls[0][0].where.status).toEqual({ in: ['WAITING', 'NOTIFIED'] });
    expectNoWrite();
  });

  test('UT-RES-08 độc giả đang mượn chính cuốn sách này → 400, không tạo đặt trước', async () => {
    mocks.prisma.book.findUnique.mockResolvedValue(book());
    mocks.prisma.bookItem.count.mockResolvedValue(0);
    mocks.prisma.reservation.findFirst.mockResolvedValue(null);
    mocks.prisma.loan.findFirst.mockResolvedValue({ id: 1 });
    const res = await callHandler(createReservation, { body: { bookId: 100 }, user: READER });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('đang mượn');
    expect(mocks.prisma.loan.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 2, returnDate: null, bookItem: { bookId: 100 } });
    expectNoWrite();
  });

  test('UT-RES-09 lỗi DB khi tạo → 500, thông điệp chung', async () => {
    mocks.prisma.book.findUnique.mockRejectedValue(new Error('db'));
    const res = await callHandler(createReservation, { body: { bookId: 100 }, user: READER });
    expect(res.statusCode).toBe(500);
    expect(res.payload.error).toBe('Không thể tạo yêu cầu đặt trước sách');
  });
});

// ---------------------------------------------------------------- Liệt kê
describe('getAllReservations / getMyReservations', () => {
  test('UT-RES-10 USER gọi danh sách toàn hệ thống → 403, không truy vấn', async () => {
    const res = await callHandler(getAllReservations, { user: READER });
    expect(res.statusCode).toBe(403);
    expect(mocks.prisma.reservation.findMany).not.toHaveBeenCalled();
  });

  test('UT-RES-11 ADMIN không lọc → where rỗng, sắp mới nhất trước, định dạng khả dụng/tổng bản', async () => {
    mocks.prisma.reservation.findMany.mockResolvedValue([reservation()]);
    const res = await callHandler(getAllReservations, { user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.reservation.findMany.mock.calls[0][0]).toMatchObject({ where: {}, orderBy: { createdAt: 'desc' } });
    expect(res.payload[0].book).toMatchObject({ available: 1, totalCopies: 3, author: 'Tác giả', category: 'Thể loại' });
    expect(res.payload[0].user).toEqual({ id: 2, name: 'Độc giả', email: 'reader@test.local', membershipTier: 'STANDARD' });
  });

  test.each([
    ['UT-RES-12a status=WAITING → lọc theo WAITING', 'WAITING', { status: 'WAITING' }],
    ['UT-RES-12b status=ALL → không lọc', 'ALL', {}],
    ['UT-RES-12c status rỗng → không lọc', '', {}],
    ['UT-RES-12d status không phải chuỗi (mảng) → bỏ qua bộ lọc', ['A', 'B'], {}],
  ])('%s', async (_id, status, where) => {
    mocks.prisma.reservation.findMany.mockResolvedValue([]);
    await callHandler(getAllReservations, { user: ADMIN, query: { status } });
    expect(mocks.prisma.reservation.findMany.mock.calls[0][0].where).toEqual(where);
  });

  test('UT-RES-13 bản ghi thiếu user/book/items/tác giả → trường tương ứng null hoặc mặc định', async () => {
    mocks.prisma.reservation.findMany.mockResolvedValue([
      reservation({ id: 1, user: null, book: null }),
      reservation({ id: 2, book: book({ items: undefined, author: null, category: null }) }),
    ]);
    const res = await callHandler(getAllReservations, { user: ADMIN });
    expect(res.payload[0]).toMatchObject({ user: null, book: null });
    expect(res.payload[1].book).toMatchObject({ available: 0, totalCopies: 0, author: '', category: '' });
  });

  test('UT-RES-14 lỗi DB → 500', async () => {
    mocks.prisma.reservation.findMany.mockRejectedValue(new Error('db'));
    const res = await callHandler(getAllReservations, { user: ADMIN });
    expect(res.statusCode).toBe(500);
  });

  test('UT-RES-15 getMyReservations chỉ lấy của người gọi (where.userId)', async () => {
    mocks.prisma.reservation.findMany.mockResolvedValue([reservation()]);
    const res = await callHandler(getMyReservations, { user: READER });
    expect(mocks.prisma.reservation.findMany.mock.calls[0][0].where).toEqual({ userId: 2 });
    expect(res.payload).toHaveLength(1);
  });

  test('UT-RES-16 getMyReservations không đăng nhập → 401; lỗi DB → 500', async () => {
    expect((await callHandler(getMyReservations, {})).statusCode).toBe(401);
    mocks.prisma.reservation.findMany.mockRejectedValue(new Error('db'));
    expect((await callHandler(getMyReservations, { user: READER })).statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------- Đổi trạng thái (Admin)
describe('updateReservationStatus — PATCH /reservations/:id/status (RES-04)', () => {
  test('UT-RES-17 USER → 403, không đổi trạng thái', async () => {
    const res = await callHandler(updateReservationStatus, { params: { id: '9' }, body: { status: 'NOTIFIED' }, user: READER });
    expect(res.statusCode).toBe(403);
    expect(mocks.prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  test.each([
    ['UT-RES-18a thiếu status', {}],
    ['UT-RES-18b status ngoài tập hợp lệ', { status: 'DONE' }],
    ['UT-RES-18c status sai chữ hoa/thường', { status: 'waiting' }],
  ])('%s → 400 liệt kê các giá trị hợp lệ', async (_id, body) => {
    const res = await callHandler(updateReservationStatus, { params: { id: '9' }, body, user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('WAITING, NOTIFIED, FULFILLED, CANCELLED');
    expect(mocks.prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  test('UT-RES-19 không tìm thấy bản ghi → 404', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(null);
    const res = await callHandler(updateReservationStatus, { params: { id: '9' }, body: { status: 'NOTIFIED' }, user: ADMIN });
    expect(res.statusCode).toBe(404);
    expectNoWrite();
  });

  test('UT-RES-20 (RES-04) WAITING → NOTIFIED: cập nhật và gửi thông báo "sách đã có sẵn" cho độc giả', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(reservation());
    mocks.prisma.reservation.update.mockResolvedValue(reservation({ status: 'NOTIFIED' }));
    const res = await callHandler(updateReservationStatus, { params: { id: '9' }, body: { status: 'NOTIFIED' }, user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.reservation.update.mock.calls[0][0]).toMatchObject({ where: { id: 9 }, data: { status: 'NOTIFIED' } });
    expect(res.payload.reservation.status).toBe('NOTIFIED');
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 2, title: 'Sách đặt trước đã có sẵn!' }));
  });

  test.each(['FULFILLED', 'CANCELLED', 'WAITING'])('UT-RES-21 (RES-04) chuyển sang %s: lưu trạng thái, KHÔNG gửi thông báo', async (status) => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(reservation({ status: 'NOTIFIED' }));
    mocks.prisma.reservation.update.mockResolvedValue(reservation({ status }));
    const res = await callHandler(updateReservationStatus, { params: { id: '9' }, body: { status }, user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.reservation.update.mock.calls[0][0].data).toEqual({ status });
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  test('UT-RES-22 lỗi DB → 500', async () => {
    mocks.prisma.reservation.findUnique.mockRejectedValue(new Error('db'));
    const res = await callHandler(updateReservationStatus, { params: { id: '9' }, body: { status: 'NOTIFIED' }, user: ADMIN });
    expect(res.statusCode).toBe(500);
  });

  // KNOWN BUG? NEW FINDING FIND-06 — luồng hợp lệ theo chú thích routes: WAITING → NOTIFIED → FULFILLED/CANCELLED.
  test.fails('UT-RES-23 (FIND-06) FULFILLED → NOTIFIED là chuyển trạng thái ngược: phải bị chặn 400, không ghi DB', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(reservation({ status: 'FULFILLED' }));
    mocks.prisma.reservation.update.mockResolvedValue(reservation({ status: 'NOTIFIED' }));
    const res = await callHandler(updateReservationStatus, { params: { id: '9' }, body: { status: 'NOTIFIED' }, user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.reservation.update).not.toHaveBeenCalled();
  });

  test.fails('UT-RES-24 (FIND-06) CANCELLED → FULFILLED: yêu cầu đã hủy không được hoàn tất, phải bị chặn 400', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(reservation({ status: 'CANCELLED' }));
    mocks.prisma.reservation.update.mockResolvedValue(reservation({ status: 'FULFILLED' }));
    const res = await callHandler(updateReservationStatus, { params: { id: '9' }, body: { status: 'FULFILLED' }, user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.reservation.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- Hủy
describe('cancelReservation — DELETE /reservations/:id (RES-05)', () => {
  test('UT-RES-25 không đăng nhập → 401', async () => {
    const res = await callHandler(cancelReservation, { params: { id: '9' } });
    expect(res.statusCode).toBe(401);
    expect(mocks.prisma.reservation.findUnique).not.toHaveBeenCalled();
  });

  test('UT-RES-26 không tìm thấy bản ghi → 404', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(null);
    const res = await callHandler(cancelReservation, { params: { id: '9' }, user: READER });
    expect(res.statusCode).toBe(404);
    expect(mocks.prisma.reservation.update).not.toHaveBeenCalled();
  });

  test('UT-RES-27 (RES-05) USER hủy yêu cầu của người khác → 403, không đổi trạng thái', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(reservation({ userId: 99 }));
    const res = await callHandler(cancelReservation, { params: { id: '9' }, user: READER });
    expect(res.statusCode).toBe(403);
    expect(mocks.prisma.reservation.update).not.toHaveBeenCalled();
  });

  test('UT-RES-28 (RES-05) USER hủy yêu cầu của chính mình → CANCELLED', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(reservation({ userId: 2 }));
    mocks.prisma.reservation.update.mockResolvedValue(reservation({ status: 'CANCELLED' }));
    const res = await callHandler(cancelReservation, { params: { id: '9' }, user: READER });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.reservation.update.mock.calls[0][0]).toEqual({ where: { id: 9 }, data: { status: 'CANCELLED' } });
    expect(res.payload.reservation.status).toBe('CANCELLED');
  });

  test('UT-RES-29 (RES-05) ADMIN hủy yêu cầu của độc giả khác → CANCELLED', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(reservation({ userId: 99 }));
    mocks.prisma.reservation.update.mockResolvedValue(reservation({ userId: 99, status: 'CANCELLED' }));
    const res = await callHandler(cancelReservation, { params: { id: '9' }, user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.reservation.update).toHaveBeenCalledTimes(1);
  });

  test('UT-RES-30 lỗi DB → 500', async () => {
    mocks.prisma.reservation.findUnique.mockRejectedValue(new Error('db'));
    const res = await callHandler(cancelReservation, { params: { id: '9' }, user: READER });
    expect(res.statusCode).toBe(500);
  });

  // NEW FINDING FIND-07 — yêu cầu đã FULFILLED (độc giả đã nhận sách) không còn hợp lệ để hủy.
  test.fails('UT-RES-31 (FIND-07) hủy yêu cầu đã FULFILLED phải bị chặn 400, không đổi trạng thái', async () => {
    mocks.prisma.reservation.findUnique.mockResolvedValue(reservation({ status: 'FULFILLED' }));
    mocks.prisma.reservation.update.mockResolvedValue(reservation({ status: 'CANCELLED' }));
    const res = await callHandler(cancelReservation, { params: { id: '9' }, user: READER });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.reservation.update).not.toHaveBeenCalled();
  });
});
