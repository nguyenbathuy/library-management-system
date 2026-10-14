/**
 * Mục tiêu: kiểm thử hộp trắng phần 2FA được thêm ở commit 90f35a26 trong authController:
 *   nhánh OTP của login, verifyOtp, resendLoginOtp, toggleTwoFactor.
 * Kỹ thuật: phủ nhánh (branch coverage) + giá trị biên thời hạn OTP (hết hạn / đúng thời điểm hết hạn);
 *   Prisma, bcrypt, jsonwebtoken, mailService mock TRƯỚC import (vi.hoisted/vi.mock + alias prismaGuard).
 * Oracle: S (hành vi source/contract tại 90f35a26) và yêu cầu bảo mật của commit
 *   "không cấp token trước khi xác thực OTP". Không gửi email thật, không DB thật.
 * Liên kết hộp đen: AUTH-01/02 (đăng nhập), luồng OTP chưa có ca Chương 3 tương ứng.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../../src/middleware/auth';
import { makeUser } from '../../fixtures/auth';

const mocks = vi.hoisted(() => {
  const prisma = {
    user: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return {
    prisma,
    PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }),
    bcrypt: { hash: vi.fn(), compare: vi.fn() },
    jwt: { sign: vi.fn(), verify: vi.fn() },
    mail: { sendPasswordResetOtpEmail: vi.fn(), sendLoginOtpEmail: vi.fn() },
    createNotification: vi.fn(),
  };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));
vi.mock('bcryptjs', () => ({ default: mocks.bcrypt }));
vi.mock('jsonwebtoken', () => ({ default: mocks.jwt }));
vi.mock('../../../src/services/mailService', () => mocks.mail);
vi.mock('../../../src/services/notificationService', () => ({ createNotification: mocks.createNotification }));

import { PrismaClient } from '@prisma/client';
import { login, resendLoginOtp, toggleTwoFactor, verifyOtp } from '../../../src/controllers/authController';

const NOW = new Date('2026-10-14T02:00:00.000Z');
const TEN_MINUTES = 10 * 60 * 1000;
const TOKEN = 'unit-test-jwt-output';
const OTP_FROM_RANDOM_HALF = '550000'; // 100000 + floor(0.5 × 900000)
const USER_2FA = makeUser({ twoFactorEnabled: true, loginOtp: null, loginOtpExpiry: null });

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>;
async function call(handler: Handler, body: Record<string, unknown>, user?: AuthRequest['user']) {
  const actual: { statusCode: number; payload?: any } = { statusCode: 200 };
  const res: any = {
    status: vi.fn((code: number) => { actual.statusCode = code; return res; }),
    json: vi.fn((payload: unknown) => { actual.payload = payload; return res; }),
  };
  await handler({ body, user, params: {}, headers: {} } as unknown as AuthRequest, res as Response);
  expect(res.json).toHaveBeenCalledTimes(1);
  return actual;
}

beforeAll(() => {
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined); // controller logs the OTP
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  for (const fn of [
    ...Object.values(mocks.prisma.user), mocks.prisma.$connect, mocks.prisma.$disconnect,
    ...Object.values(mocks.bcrypt), ...Object.values(mocks.jwt), ...Object.values(mocks.mail), mocks.createNotification,
  ]) {
    fn.mockReset();
    fn.mockImplementation(() => { throw new Error('Unconfigured mock call: arrange this dependency.'); });
  }
});

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
});

describe('login — nhánh 2FA', () => {
  test('WB-OT-01 user bật 2FA → 200 requireOtp, lưu OTP 6 số hạn 10 phút, gửi mail, KHÔNG cấp token', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(USER_2FA);
    mocks.bcrypt.compare.mockResolvedValue(true);
    mocks.prisma.user.update.mockResolvedValue(USER_2FA);
    mocks.mail.sendLoginOtpEmail.mockResolvedValue({ success: true, previewUrl: false });
    const actual = await call(login, { email: 'user@example.com', password: 'secret' });
    expect(actual.statusCode).toBe(200);
    expect(actual.payload).toMatchObject({ requireOtp: true, tempUserId: 1, email: 'user@example.com' });
    expect(actual.payload).not.toHaveProperty('token');
    expect(mocks.jwt.sign).not.toHaveBeenCalled();
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 1 },
      data: { loginOtp: OTP_FROM_RANDOM_HALF, loginOtpExpiry: new Date(NOW.getTime() + TEN_MINUTES) },
    });
    expect(mocks.mail.sendLoginOtpEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ to: 'user@example.com', otp: OTP_FROM_RANDOM_HALF, expiryMinutes: 10 }),
    );
  });

  test('WB-OT-02 gửi mail OTP lỗi → vẫn 200 requireOtp, không lộ token', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(USER_2FA);
    mocks.bcrypt.compare.mockResolvedValue(true);
    mocks.prisma.user.update.mockResolvedValue(USER_2FA);
    mocks.mail.sendLoginOtpEmail.mockRejectedValue(new Error('SMTP down'));
    const actual = await call(login, { email: 'user@example.com', password: 'secret' });
    expect(actual.payload).toMatchObject({ requireOtp: true });
    expect(mocks.jwt.sign).not.toHaveBeenCalled();
  });

  test('WB-OT-03 thiếu mật khẩu → 400, không truy vấn DB', async () => {
    const actual = await call(login, { email: 'user@example.com' });
    expect(actual.statusCode).toBe(400);
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test('WB-OT-04 email được trim + lowercase trước khi tra cứu', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    await call(login, { email: '  User@Example.COM ', password: 'secret' });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { email: 'user@example.com' } });
  });

  test('WB-OT-05 lỗi DB khi đăng nhập → 500 thông điệp chung', async () => {
    mocks.prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    const actual = await call(login, { email: 'user@example.com', password: 'secret' });
    expect(actual).toEqual({ statusCode: 500, payload: { error: 'Đăng nhập thất bại, vui lòng thử lại sau' } });
  });
});

describe('verifyOtp', () => {
  const withOtp = (expiry: Date, otp: string | null = '123456') => makeUser({ twoFactorEnabled: true, loginOtp: otp, loginOtpExpiry: expiry });

  test('WB-OT-06 thiếu otp → 400, không truy vấn', async () => {
    const actual = await call(verifyOtp, { tempUserId: 1 });
    expect(actual.statusCode).toBe(400);
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test('WB-OT-07 tempUserId không phải số → 400', async () => {
    const actual = await call(verifyOtp, { tempUserId: 'abc', otp: '123456' });
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mã định danh tạm thời không hợp lệ' } });
  });

  test('WB-OT-08 user không tồn tại → 404', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const actual = await call(verifyOtp, { tempUserId: 9, otp: '123456' });
    expect(actual.statusCode).toBe(404);
  });

  test('WB-OT-09 OTP sai → 400, không cấp token, không xóa OTP', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(withOtp(new Date(NOW.getTime() + TEN_MINUTES)));
    const actual = await call(verifyOtp, { tempUserId: 1, otp: '000000' });
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.' } });
    expect(mocks.jwt.sign).not.toHaveBeenCalled();
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  test('WB-OT-10 OTP đúng nhưng hết hạn 1 ms → 400 hết hạn, không cấp token', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(withOtp(new Date(NOW.getTime() - 1)));
    const actual = await call(verifyOtp, { tempUserId: 1, otp: '123456' });
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mã OTP đã hết hạn. Vui lòng đăng nhập lại để nhận mã mới.' } });
    expect(mocks.jwt.sign).not.toHaveBeenCalled();
  });

  test('WB-OT-11 OTP đúng, còn hạn (có khoảng trắng) → xóa OTP, cấp token 1h, DTO không có mật khẩu', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(withOtp(new Date(NOW.getTime() + TEN_MINUTES)));
    mocks.prisma.user.update.mockResolvedValue(makeUser());
    mocks.jwt.sign.mockReturnValue(TOKEN);
    const actual = await call(verifyOtp, { tempUserId: '1', otp: ' 123456 ' });
    expect(actual.statusCode).toBe(200);
    expect(actual.payload.token).toBe(TOKEN);
    expect(actual.payload.user).not.toHaveProperty('password');
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 }, data: { loginOtp: null, loginOtpExpiry: null } });
    expect(mocks.jwt.sign).toHaveBeenCalledExactlyOnceWith(
      { userId: 1, email: 'user@example.com', role: 'USER' }, 'unit-test-secret-never-used-for-real-tokens', { expiresIn: '1h' },
    );
  });

  test('WB-OT-12 biên: loginOtpExpiry đúng bằng thời điểm hiện tại → vẫn chấp nhận (so sánh "<")', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(withOtp(new Date(NOW)));
    mocks.prisma.user.update.mockResolvedValue(makeUser());
    mocks.jwt.sign.mockReturnValue(TOKEN);
    const actual = await call(verifyOtp, { tempUserId: 1, otp: '123456' });
    expect(actual.statusCode).toBe(200);
  });

  test('WB-OT-13 dùng lại OTP sau khi đã xác thực (loginOtp = null) → 400', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(withOtp(new Date(NOW.getTime() + TEN_MINUTES), null));
    const actual = await call(verifyOtp, { tempUserId: 1, otp: '123456' });
    expect(actual.statusCode).toBe(400);
    expect(mocks.jwt.sign).not.toHaveBeenCalled();
  });
});

describe('resendLoginOtp', () => {
  test('WB-OT-14 thiếu tempUserId → 400', async () => {
    expect((await call(resendLoginOtp, {})).statusCode).toBe(400);
  });

  test('WB-OT-15 tempUserId không tồn tại → 404, không ghi OTP', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    expect((await call(resendLoginOtp, { tempUserId: 5 })).statusCode).toBe(404);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  test('WB-OT-16 gửi lại → sinh OTP mới hạn 10 phút và gửi mail', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(USER_2FA);
    mocks.prisma.user.update.mockResolvedValue(USER_2FA);
    mocks.mail.sendLoginOtpEmail.mockResolvedValue({ success: true });
    const actual = await call(resendLoginOtp, { tempUserId: 1 });
    expect(actual.statusCode).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 1 }, data: { loginOtp: OTP_FROM_RANDOM_HALF, loginOtpExpiry: new Date(NOW.getTime() + TEN_MINUTES) },
    });
    expect(mocks.mail.sendLoginOtpEmail).toHaveBeenCalledTimes(1);
  });
});

describe('toggleTwoFactor', () => {
  const ACTOR = { userId: 1, email: 'user@example.com', role: 'USER' };

  test('WB-OT-17 chưa xác thực → 401', async () => {
    expect((await call(toggleTwoFactor, { enabled: true })).statusCode).toBe(401);
  });

  test('WB-OT-18 enabled=true tường minh → cập nhật twoFactorEnabled = true', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(makeUser({ twoFactorEnabled: false }));
    mocks.prisma.user.update.mockResolvedValue({ id: 1, twoFactorEnabled: true });
    const actual = await call(toggleTwoFactor, { enabled: true }, ACTOR);
    expect(actual.payload).toMatchObject({ twoFactorEnabled: true });
    expect(mocks.prisma.user.update.mock.calls[0][0].data).toEqual({ twoFactorEnabled: true });
  });

  test('WB-OT-19 không gửi enabled → đảo trạng thái hiện tại (true → false)', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(makeUser({ twoFactorEnabled: true }));
    mocks.prisma.user.update.mockResolvedValue({ id: 1, twoFactorEnabled: false });
    const actual = await call(toggleTwoFactor, {}, ACTOR);
    expect(actual.payload).toMatchObject({ twoFactorEnabled: false });
  });

  test('WB-OT-20 user không tồn tại → 404', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    expect((await call(toggleTwoFactor, { enabled: true }, ACTOR)).statusCode).toBe(404);
  });
});
