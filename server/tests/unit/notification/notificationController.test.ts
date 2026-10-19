/**
 * Mục tiêu: kiểm thử đơn vị notificationController (chuông thông báo) và notificationService.createNotification.
 * Kỹ thuật: hộp trắng phủ nhánh + phân vùng tương đương (chủ thông báo / người khác / chưa đăng nhập).
 *   Prisma được mock TRƯỚC khi import controller và service (alias prismaGuard chặn Prisma thật).
 * Ranh giới: chỉ chứng minh controller → lời gọi Prisma; KHÔNG chứng minh ghi SQLite thật
 *   (xem tests/integration/notification.api.test.ts).
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): NOTI-01 (thông báo đúng chủ, số chưa đọc),
 *   NOTI-02 (đánh dấu một/tất cả đã đọc, xóa một/tất cả).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { callHandler, resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    notification: d('findMany', 'count', 'findUnique', 'update', 'updateMany', 'delete', 'deleteMany', 'create'),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { prisma, PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }) };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));

import { PrismaClient } from '@prisma/client';
import {
  clearAllNotifications, deleteNotification, getMyNotifications, markAllNotificationsAsRead, markNotificationAsRead,
} from '../../../src/controllers/notificationController';
import { createNotification } from '../../../src/services/notificationService';

const USER = { userId: 2, email: 'reader@test.local', role: 'USER' };

beforeAll(() => {
  // Controller và service đều new PrismaClient() → đúng hai client, cùng trỏ về mock.
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(2);
  for (const result of mocks.PrismaClient.mock.results) expect(result.value).toBe(mocks.prisma);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  resetMocks([...Object.values(mocks.prisma.notification), mocks.prisma.$connect, mocks.prisma.$disconnect]);
});

afterAll(() => {
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

describe('getMyNotifications (NOTI-01)', () => {
  test('UT-NOT-01 chưa đăng nhập → 401', async () => {
    const res = await callHandler(getMyNotifications, {});
    expect(res.statusCode).toBe(401);
    expect(mocks.prisma.notification.findMany).not.toHaveBeenCalled();
  });

  test('UT-NOT-02 chỉ lấy thông báo của người gọi, mới nhất trước, tối đa 50, kèm số chưa đọc', async () => {
    mocks.prisma.notification.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.prisma.notification.count.mockResolvedValue(1);
    const res = await callHandler(getMyNotifications, { user: USER });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.notification.findMany).toHaveBeenCalledWith({ where: { userId: 2 }, orderBy: { createdAt: 'desc' }, take: 50 });
    expect(mocks.prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 2, isRead: false } });
    expect(res.payload).toEqual({ notifications: [{ id: 1 }, { id: 2 }], unreadCount: 1 });
  });

  test('UT-NOT-03 lỗi DB → 500', async () => {
    mocks.prisma.notification.findMany.mockRejectedValue(new Error('db'));
    expect((await callHandler(getMyNotifications, { user: USER })).statusCode).toBe(500);
  });
});

describe('markNotificationAsRead (NOTI-02)', () => {
  test('UT-NOT-04 thông báo của chính mình → isRead = true', async () => {
    mocks.prisma.notification.findUnique.mockResolvedValue({ id: 5, userId: 2, isRead: false });
    mocks.prisma.notification.update.mockResolvedValue({ id: 5, userId: 2, isRead: true });
    const res = await callHandler(markNotificationAsRead, { params: { id: '5' }, user: USER });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.notification.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { isRead: true } });
    expect(res.payload.isRead).toBe(true);
  });

  test.each([
    ['UT-NOT-05a không tồn tại', null],
    ['UT-NOT-05b thuộc người dùng khác (không lộ sự tồn tại)', { id: 5, userId: 99 }],
  ])('%s → 404, không cập nhật', async (_id, found) => {
    mocks.prisma.notification.findUnique.mockResolvedValue(found);
    const res = await callHandler(markNotificationAsRead, { params: { id: '5' }, user: USER });
    expect(res.statusCode).toBe(404);
    expect(mocks.prisma.notification.update).not.toHaveBeenCalled();
  });

  test('UT-NOT-06 lỗi DB → 500', async () => {
    mocks.prisma.notification.findUnique.mockRejectedValue(new Error('db'));
    expect((await callHandler(markNotificationAsRead, { params: { id: '5' }, user: USER })).statusCode).toBe(500);
  });
});

describe('markAllNotificationsAsRead (NOTI-02)', () => {
  test('UT-NOT-07 chưa đăng nhập → 401', async () => {
    expect((await callHandler(markAllNotificationsAsRead, {})).statusCode).toBe(401);
    expect(mocks.prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  test('UT-NOT-08 chỉ cập nhật thông báo chưa đọc của người gọi', async () => {
    mocks.prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    const res = await callHandler(markAllNotificationsAsRead, { user: USER });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.notification.updateMany).toHaveBeenCalledWith({ where: { userId: 2, isRead: false }, data: { isRead: true } });
  });

  test('UT-NOT-09 lỗi DB → 500', async () => {
    mocks.prisma.notification.updateMany.mockRejectedValue(new Error('db'));
    expect((await callHandler(markAllNotificationsAsRead, { user: USER })).statusCode).toBe(500);
  });
});

describe('deleteNotification / clearAllNotifications (NOTI-02)', () => {
  test('UT-NOT-10 xóa thông báo của chính mình', async () => {
    mocks.prisma.notification.findUnique.mockResolvedValue({ id: 5, userId: 2 });
    mocks.prisma.notification.delete.mockResolvedValue({ id: 5 });
    const res = await callHandler(deleteNotification, { params: { id: '5' }, user: USER });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  test.each([
    ['UT-NOT-11a không tồn tại', null],
    ['UT-NOT-11b thuộc người khác', { id: 5, userId: 99 }],
  ])('%s → 404, không xóa', async (_id, found) => {
    mocks.prisma.notification.findUnique.mockResolvedValue(found);
    expect((await callHandler(deleteNotification, { params: { id: '5' }, user: USER })).statusCode).toBe(404);
    expect(mocks.prisma.notification.delete).not.toHaveBeenCalled();
  });

  test('UT-NOT-12 lỗi DB khi xóa một → 500', async () => {
    mocks.prisma.notification.findUnique.mockRejectedValue(new Error('db'));
    expect((await callHandler(deleteNotification, { params: { id: '5' }, user: USER })).statusCode).toBe(500);
  });

  test('UT-NOT-13 xóa tất cả: chỉ của người gọi; chưa đăng nhập → 401', async () => {
    mocks.prisma.notification.deleteMany.mockResolvedValue({ count: 4 });
    expect((await callHandler(clearAllNotifications, { user: USER })).statusCode).toBe(200);
    expect(mocks.prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 2 } });
    mocks.prisma.notification.deleteMany.mockClear();
    expect((await callHandler(clearAllNotifications, {})).statusCode).toBe(401);
    expect(mocks.prisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  test('UT-NOT-14 lỗi DB khi xóa tất cả → 500', async () => {
    mocks.prisma.notification.deleteMany.mockRejectedValue(new Error('db'));
    expect((await callHandler(clearAllNotifications, { user: USER })).statusCode).toBe(500);
  });
});

describe('notificationService.createNotification', () => {
  test('UT-NOT-15 tạo bản ghi chưa đọc và trả về bản ghi đó', async () => {
    mocks.prisma.notification.create.mockResolvedValue({ id: 1, isRead: false });
    const result = await createNotification({ userId: 2, title: 'T', message: 'M' });
    expect(mocks.prisma.notification.create).toHaveBeenCalledWith({ data: { userId: 2, title: 'T', message: 'M', isRead: false } });
    expect(result).toEqual({ id: 1, isRead: false });
  });

  test('UT-NOT-16 lỗi DB được nuốt và trả null (không làm hỏng nghiệp vụ gọi nó)', async () => {
    mocks.prisma.notification.create.mockRejectedValue(new Error('db'));
    await expect(createNotification({ userId: 2, title: 'T', message: 'M' })).resolves.toBeNull();
  });
});
