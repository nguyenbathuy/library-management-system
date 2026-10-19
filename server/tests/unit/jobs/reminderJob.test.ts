/**
 * Mục tiêu: kiểm thử đơn vị reminderJob: scanAndSendReminders (quét phiếu quá hạn / sắp đến hạn, cập nhật OVERDUE + tiền phạt,
 *   tạo thông báo, gửi email, tổng hợp báo cáo) và startReminderCron (đăng ký lịch 08:00 hằng ngày).
 * Kỹ thuật: hộp trắng phủ nhánh + phân tích giá trị biên số ngày tới hạn (đã quá hạn / 0 / 2 / 3 ngày).
 *   Prisma, mailService, notificationService và node-cron đều được mock TRƯỚC khi import → không SMTP, không cron thật.
 * Ranh giới: không chứng minh email được giao hay cron thật chạy lúc 08:00 (MAIL-01 cần hộp thư/Ethereal thật). Không nạp
 *   index.ts (bootstrap) vì quy tắc isolation của repository.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): MAIL-01, NOTI-01.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = { loan: d('findMany', 'update'), $connect: vi.fn(), $disconnect: vi.fn() };
  return {
    prisma,
    PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }),
    sendDueSoon: vi.fn(),
    sendOverdue: vi.fn(),
    createNotification: vi.fn(),
    schedule: vi.fn(),
  };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));
vi.mock('node-cron', () => ({ default: { schedule: mocks.schedule } }));
vi.mock('../../../src/services/mailService', () => ({
  sendDueSoonReminderEmail: mocks.sendDueSoon,
  sendOverdueReminderEmail: mocks.sendOverdue,
}));
vi.mock('../../../src/services/notificationService', () => ({ createNotification: mocks.createNotification }));

import { PrismaClient } from '@prisma/client';
import { scanAndSendReminders, startReminderCron } from '../../../src/jobs/reminderJob';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-14T09:00:00Z');
const loan = (dueOffsetMs: number, overrides: Record<string, unknown> = {}) => ({
  id: 1, userId: 2, borrowDate: new Date(NOW.getTime() - 10 * DAY), dueDate: new Date(NOW.getTime() + dueOffsetMs),
  user: { name: 'Độc giả', email: 'reader@test.local' },
  bookItem: { barcode: 'BC-1', book: { title: 'Sách nhắc hạn' } },
  ...overrides,
});
const ok = (to = 'reader@test.local') => ({ success: true, to, subject: 's' });

beforeAll(() => {
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetMocks([
    mocks.prisma.loan.findMany, mocks.prisma.loan.update, mocks.prisma.$connect, mocks.prisma.$disconnect,
    mocks.sendDueSoon, mocks.sendOverdue, mocks.createNotification, mocks.schedule,
  ]);
  mocks.prisma.loan.update.mockResolvedValue({});
  mocks.createNotification.mockResolvedValue({ id: 1 });
  mocks.sendDueSoon.mockResolvedValue(ok());
  mocks.sendOverdue.mockResolvedValue(ok());
  mocks.schedule.mockReturnValue(undefined);
});

afterAll(() => {
  vi.useRealTimers();
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

describe('scanAndSendReminders — quét hạn trả', () => {
  test('UT-RMD-01 chỉ quét phiếu chưa trả với trạng thái ACTIVE/BORROWING/OVERDUE; không có phiếu → báo cáo toàn 0', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([]);
    const report = await scanAndSendReminders();
    expect(mocks.prisma.loan.findMany.mock.calls[0][0].where).toEqual({ returnDate: null, status: { in: ['ACTIVE', 'BORROWING', 'OVERDUE'] } });
    expect(report).toMatchObject({ totalActiveLoans: 0, dueSoonCount: 0, overdueCount: 0, updatedOverdueCount: 0, emailsSent: 0, notificationsCreated: 0, failedCount: 0, results: [] });
    expect(report.timestamp).toBe(NOW.toISOString());
  });

  test('UT-RMD-02 (MAIL-01) quá hạn 3 ngày → DB OVERDUE + phạt 15.000, thông báo cảnh báo, email quá hạn đúng tham số', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(-3 * DAY)]);
    const report = await scanAndSendReminders();
    expect(mocks.prisma.loan.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'OVERDUE', fineAmount: 15000 } });
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 2, title: 'Cảnh báo sách quá hạn!' }));
    expect(mocks.createNotification.mock.calls[0][0].message).toContain('3 ngày');
    expect(mocks.sendOverdue).toHaveBeenCalledWith(expect.objectContaining({ to: 'reader@test.local', userName: 'Độc giả', bookTitle: 'Sách nhắc hạn', barcode: 'BC-1', overdueDays: 3 }));
    expect(mocks.sendDueSoon).not.toHaveBeenCalled();
    expect(report).toMatchObject({ totalActiveLoans: 1, overdueCount: 1, updatedOverdueCount: 1, dueSoonCount: 0, emailsSent: 1, notificationsCreated: 1, failedCount: 0 });
  });

  test('UT-RMD-03 trễ 3 giờ (chưa tròn 1 ngày): ceil(-0,125) = -0 nên CHƯA bị coi là quá hạn mà là "sắp đến hạn" (cùng gốc FIND-01)', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(-3 * 60 * 60 * 1000)]);
    const report = await scanAndSendReminders();
    expect(report.overdueCount).toBe(0);
    expect(report.dueSoonCount).toBe(1);
  });

  test('UT-RMD-04 quá hạn 1 ngày 1 giờ → ceil = -1 → quá hạn 1 ngày, phạt 5.000', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(-(DAY + 60 * 60 * 1000))]);
    await scanAndSendReminders();
    expect(mocks.prisma.loan.update.mock.calls[0][0].data).toEqual({ status: 'OVERDUE', fineAmount: 5000 });
  });

  test.each([
    ['UT-RMD-05a hết hạn đúng lúc quét (0 ngày) → sắp đến hạn, còn tối thiểu 1 ngày', 0, 1],
    ['UT-RMD-05b còn 1 ngày', DAY, 1],
    ['UT-RMD-05c còn đúng 2 ngày (biên trên) → sắp đến hạn', 2 * DAY, 2],
  ])('%s', async (_id, offset, daysLeft) => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(offset)]);
    const report = await scanAndSendReminders();
    expect(report).toMatchObject({ dueSoonCount: 1, overdueCount: 0, emailsSent: 1, notificationsCreated: 1 });
    expect(mocks.sendDueSoon).toHaveBeenCalledWith(expect.objectContaining({ daysLeft, bookTitle: 'Sách nhắc hạn' }));
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nhắc nhở sắp đến hạn trả sách' }));
    expect(mocks.prisma.loan.update).not.toHaveBeenCalled();
  });

  test('UT-RMD-06 còn 2 ngày 1 giờ → ceil = 3 → ngoài vùng nhắc, bị bỏ qua', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(2 * DAY + 60 * 60 * 1000)]);
    const report = await scanAndSendReminders();
    expect(report).toMatchObject({ totalActiveLoans: 1, dueSoonCount: 0, overdueCount: 0, emailsSent: 0 });
    expect(mocks.sendDueSoon).not.toHaveBeenCalled();
    expect(mocks.sendOverdue).not.toHaveBeenCalled();
  });

  test('UT-RMD-07 phiếu thiếu thông tin sách → dùng tên mặc định "Sách Thư Viện" và barcode undefined', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(-2 * DAY, { bookItem: null })]);
    await scanAndSendReminders();
    expect(mocks.sendOverdue).toHaveBeenCalledWith(expect.objectContaining({ bookTitle: 'Sách Thư Viện', barcode: undefined }));
  });

  test('UT-RMD-08 người mượn không có email → vẫn cập nhật + thông báo nhưng KHÔNG gửi mail', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(-2 * DAY, { user: { name: 'Không mail', email: '' } }), loan(DAY, { id: 2, user: null })]);
    const report = await scanAndSendReminders();
    expect(mocks.sendOverdue).not.toHaveBeenCalled();
    expect(mocks.sendDueSoon).not.toHaveBeenCalled();
    expect(report).toMatchObject({ overdueCount: 1, dueSoonCount: 1, emailsSent: 0, notificationsCreated: 2 });
  });

  test('UT-RMD-09 phiếu không có userId → không tạo thông báo (mail vẫn gửi nếu có email)', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(-2 * DAY, { userId: null })]);
    const report = await scanAndSendReminders();
    expect(mocks.createNotification).not.toHaveBeenCalled();
    expect(report).toMatchObject({ notificationsCreated: 0, emailsSent: 1 });
  });

  test('UT-RMD-10 cập nhật OVERDUE lỗi → ghi log, updatedOverdueCount không tăng, vẫn thông báo và gửi mail', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(-2 * DAY)]);
    mocks.prisma.loan.update.mockRejectedValue(new Error('locked'));
    const report = await scanAndSendReminders();
    expect(report).toMatchObject({ overdueCount: 1, updatedOverdueCount: 0, notificationsCreated: 1, emailsSent: 1 });
  });

  test('UT-RMD-11 tạo thông báo thất bại (null) không được đếm; mail thất bại tính vào failedCount, không tính emailsSent', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([loan(-2 * DAY)]);
    mocks.createNotification.mockResolvedValue(null);
    mocks.sendOverdue.mockResolvedValue({ success: false, to: 'reader@test.local', subject: 's', error: 'smtp' });
    const report = await scanAndSendReminders();
    expect(report).toMatchObject({ notificationsCreated: 0, emailsSent: 0, failedCount: 1 });
    expect(report.results).toHaveLength(1);
  });

  test('UT-RMD-12 nhiều phiếu hỗn hợp: đếm đúng từng nhóm; tổng hợp results của mọi email', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([
      loan(-5 * DAY, { id: 1 }), loan(DAY, { id: 2 }), loan(10 * DAY, { id: 3 }), loan(-DAY, { id: 4 }),
    ]);
    mocks.sendDueSoon.mockResolvedValue({ success: false, to: 'x', subject: 's', error: 'e' });
    const report = await scanAndSendReminders();
    expect(report).toMatchObject({ totalActiveLoans: 4, overdueCount: 2, dueSoonCount: 1, updatedOverdueCount: 2, emailsSent: 2, failedCount: 1, notificationsCreated: 3 });
    expect(report.results).toHaveLength(3);
  });

  test('UT-RMD-13 truy vấn DB lỗi → lỗi lan ra cho người gọi (controller/cron xử lý)', async () => {
    mocks.prisma.loan.findMany.mockRejectedValue(new Error('db'));
    await expect(scanAndSendReminders()).rejects.toThrow('db');
  });
});

describe('startReminderCron', () => {
  test('UT-RMD-14 đăng ký lịch "0 8 * * *" (08:00 hằng ngày) với một callback', () => {
    startReminderCron();
    expect(mocks.schedule).toHaveBeenCalledTimes(1);
    expect(mocks.schedule.mock.calls[0][0]).toBe('0 8 * * *');
    expect(mocks.schedule.mock.calls[0][1]).toBeTypeOf('function');
  });

  test('UT-RMD-15 callback của cron chạy quét một lần; lỗi khi quét được nuốt (không làm sập tiến trình)', async () => {
    startReminderCron();
    const callback = mocks.schedule.mock.calls[0][1] as () => Promise<void>;
    mocks.prisma.loan.findMany.mockResolvedValue([]);
    await callback();
    expect(mocks.prisma.loan.findMany).toHaveBeenCalledTimes(1);
    mocks.prisma.loan.findMany.mockRejectedValue(new Error('db'));
    await expect(callback()).resolves.toBeUndefined();
  });
});
