import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../../src/middleware/auth';
import { ACTOR, HASH, TOKEN, makeUser } from '../../fixtures/auth';
import designs from '../../fixtures/phase2-cases.json';
import { makeRequest, makeResponse } from '../../mocks/http';
import { callOffsets, dependencyCalls, snapshot, writeEvidence } from '../../support/phase2Evidence';

const mocks = vi.hoisted(() => {
  const prisma = {
    user: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    $connect: vi.fn(), $disconnect: vi.fn(), $transaction: vi.fn(),
  };
  return {
    prisma,
    PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }),
    bcrypt: { hash: vi.fn(), compare: vi.fn() },
    jwt: { sign: vi.fn(), verify: vi.fn() },
    sendPasswordResetOtpEmail: vi.fn(), createNotification: vi.fn(),
    factories: { prisma: false, bcrypt: false, jwt: false, mail: false, notification: false },
  };
});
vi.mock('@prisma/client', () => {
  mocks.factories.prisma = true;
  return { PrismaClient: mocks.PrismaClient };
});
vi.mock('bcryptjs', () => {
  mocks.factories.bcrypt = true;
  return { default: mocks.bcrypt };
});
vi.mock('jsonwebtoken', () => {
  mocks.factories.jwt = true;
  return { default: mocks.jwt };
});
vi.mock('../../../src/services/mailService', () => {
  mocks.factories.mail = true;
  return { sendPasswordResetOtpEmail: mocks.sendPasswordResetOtpEmail };
});
vi.mock('../../../src/services/notificationService', () => {
  mocks.factories.notification = true;
  return { createNotification: mocks.createNotification };
});

import { PrismaClient } from '@prisma/client';
import { login, changePassword, forgotPassword, resetPassword } from '../../../src/controllers/authController';

const CLOCK = new Date('2026-10-12T00:00:00.000Z');
const methods = {
  'user.create': mocks.prisma.user.create,
  'user.findUnique': mocks.prisma.user.findUnique,
  'user.findMany': mocks.prisma.user.findMany,
  'user.update': mocks.prisma.user.update,
  'prisma.$connect': mocks.prisma.$connect,
  'prisma.$disconnect': mocks.prisma.$disconnect,
  'prisma.$transaction': mocks.prisma.$transaction,
  'bcrypt.hash': mocks.bcrypt.hash,
  'bcrypt.compare': mocks.bcrypt.compare,
  'jwt.sign': mocks.jwt.sign,
  'jwt.verify': mocks.jwt.verify,
  'mail.sendPasswordResetOtpEmail': mocks.sendPasswordResetOtpEmail,
  'notification.createNotification': mocks.createNotification,
};
type Controller = (request: AuthRequest, response: Response) => unknown;
type Observation = { id: string; mockConfiguration: Record<string, unknown>; invocations: Record<string, unknown>[] };
let observation: Observation;
const traces: Record<string, unknown>[] = [];
const consoleErrors: unknown[][] = [];
let consoleSpy: ReturnType<typeof vi.spyOn>;
let randomSpy: ReturnType<typeof vi.spyOn> | undefined;

function foundUser(user: ReturnType<typeof makeUser> | null) {
  observation.mockConfiguration.findUnique = snapshot(user);
  mocks.prisma.user.findUnique.mockResolvedValue(user);
}
function matchingPassword(matches: boolean) {
  observation.mockConfiguration.bcryptCompare = matches;
  mocks.bcrypt.compare.mockResolvedValue(matches);
}
function frozenClock() {
  vi.useFakeTimers(); vi.setSystemTime(CLOCK);
  observation.mockConfiguration.clock = vi.getMockedSystemTime()?.toISOString();
}
function fixedOtpRandom() {
  randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
  observation.mockConfiguration.random = 0;
}
function expectNoCredentialWrite() {
  expect(mocks.bcrypt.hash).not.toHaveBeenCalled();
  expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  expect(mocks.createNotification).not.toHaveBeenCalled();
}

async function invoke(name: string, controller: Controller, body: Record<string, unknown>, actor?: AuthRequest['user']) {
  const response = makeResponse();
  const start = callOffsets(methods);
  const configuration = snapshot(observation.mockConfiguration);
  await controller(makeRequest(body, actor), response.response);
  expect(response.spies.json).toHaveBeenCalledTimes(1);
  observation.invocations.push({
    function: name, input: snapshot(body), actor: actor ?? null,
    mockConfiguration: configuration, actual: snapshot(response.actual),
    calls: await dependencyCalls(methods, start),
  });
  return response.actual;
}

beforeAll(() => {
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(vi.isMockFunction(PrismaClient)).toBe(true);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  expect(Object.values(mocks.factories)).toEqual([true, true, true, true, true]);
  for (const method of Object.values(methods)) expect(method).not.toHaveBeenCalled();
  consoleSpy = vi.spyOn(console, 'error').mockImplementation((...args) => consoleErrors.push(args));
  writeEvidence('phase2-controller-isolation-gate.json', {
    observedAt: new Date().toISOString(),
    constructorIsMock: vi.isMockFunction(PrismaClient),
    constructorCallsAtImport: mocks.PrismaClient.mock.calls.length,
    factories: mocks.factories,
    alias: 'server/tests/mocks/prismaGuard.ts',
  });
});

beforeEach((context) => {
  for (const method of Object.values(methods)) {
    method.mockReset();
    method.mockImplementation(() => { throw new Error('Unconfigured Phase 2 mock call.'); });
  }
  consoleErrors.length = 0;
  const id = context.task.name.match(/WB-[A-Z]+-\d+/)?.[0];
  expect(designs.some((design) => design.id === id && design.oracle !== 'R')).toBe(true);
  observation = { id: id!, mockConfiguration: { default: 'deny unconfigured calls' }, invocations: [] };
  context.onTestFinished(async (finished) => {
    expect(mocks.prisma.$connect).not.toHaveBeenCalled();
    expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    vi.useRealTimers(); randomSpy?.mockRestore(); randomSpy = undefined;
    traces.push({ ...snapshot(observation), runnerStateAtFinishedHook: finished.task.result?.state,
      recordedAt: new Date().toISOString(), consoleErrors: consoleErrors.map((args) => args.map(String)),
      calls: await dependencyCalls(methods) });
  });
});

afterAll(() => {
  try { writeEvidence('phase2-controller-traces.json', traces); }
  finally { vi.useRealTimers(); randomSpy?.mockRestore(); consoleSpy?.mockRestore(); }
});

describe('Authentication Phase 2 — login and password guards', () => {
  test('WB-LG-04 login preserves the stored ADMIN role in token and DTO', async () => {
    // Arrange
    foundUser(makeUser({ role: 'ADMIN', twoFactorEnabled: false })); matchingPassword(true);
    mocks.jwt.sign.mockReturnValue(TOKEN);
    observation.mockConfiguration.jwtSign = TOKEN;
    // Act
    const actual = await invoke('login', login, { email: 'user@example.com', password: 'oldpass' });
    // Assert
    expect(mocks.bcrypt.compare).toHaveBeenCalledExactlyOnceWith('oldpass', 'unit-test-stored-hash');
    expect(mocks.jwt.sign).toHaveBeenCalledExactlyOnceWith(
      { userId: 1, email: 'user@example.com', role: 'ADMIN' },
      'unit-test-secret-never-used-for-real-tokens', { expiresIn: '1h' },
    );
    // Oracle S re-baselined to commit 90f35a26 (2FA login contract); see git history for the previous oracle.
    expect(actual).toEqual({ statusCode: 200, payload: { requireOtp: false, token: TOKEN,
      user: { id: 1, email: 'user@example.com', name: 'Unit Test User', role: 'ADMIN', membershipTier: 'STANDARD', isBlacklisted: false, twoFactorEnabled: false } } });
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  test('WB-CP-05 changePassword rejects a missing user record', async () => {
    // Arrange
    foundUser(null);
    // Act
    const actual = await invoke('changePassword', changePassword, { currentPassword: 'oldpass', newPassword: 'abcdef' }, ACTOR);
    // Assert
    expect(actual).toEqual({ statusCode: 404, payload: { error: 'Không tìm thấy thông tin người dùng' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 } });
    expect(mocks.bcrypt.compare).not.toHaveBeenCalled(); expectNoCredentialWrite();
  });

  test('WB-CP-06 changePassword rejects an incorrect current password', async () => {
    // Arrange
    foundUser(makeUser()); matchingPassword(false);
    // Act
    const actual = await invoke('changePassword', changePassword, { currentPassword: 'wrongpass', newPassword: 'abcdef' }, ACTOR);
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mật khẩu hiện tại không chính xác' } });
    expect(mocks.bcrypt.compare).toHaveBeenCalledExactlyOnceWith('wrongpass', 'unit-test-stored-hash'); expectNoCredentialWrite();
  });

  test('WB-CP-07 changePassword rejects reusing the current password', async () => {
    // Arrange
    foundUser(makeUser()); matchingPassword(true);
    // Act
    const actual = await invoke('changePassword', changePassword, { currentPassword: 'oldpass', newPassword: 'oldpass' }, ACTOR);
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' } });
    expect(mocks.bcrypt.compare).toHaveBeenCalledExactlyOnceWith('oldpass', 'unit-test-stored-hash'); expectNoCredentialWrite();
  });
});

describe('Authentication Phase 2 — forgotPassword', () => {
  test('WB-FP-01 forgotPassword rejects an empty email before lookup', async () => {
    // Arrange / Act
    const actual = await invoke('forgotPassword', forgotPassword, { email: '' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Vui lòng cung cấp địa chỉ email hợp lệ' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetOtpEmail).not.toHaveBeenCalled(); expectNoCredentialWrite();
  });

  test('WB-FP-03 forgotPassword normalizes email and rejects an unknown user', async () => {
    // Arrange
    foundUser(null);
    // Act
    const actual = await invoke('forgotPassword', forgotPassword, { email: ' USER@EXAMPLE.COM ' });
    // Assert
    expect(actual).toEqual({ statusCode: 404, payload: { error: 'Email không tồn tại trong hệ thống' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { email: 'user@example.com' } });
    expect(mocks.sendPasswordResetOtpEmail).not.toHaveBeenCalled(); expectNoCredentialWrite();
  });

  test('WB-FP-04 forgotPassword stores a six-digit OTP with a fifteen-minute expiry', async () => {
    // Arrange
    frozenClock(); fixedOtpRandom(); foundUser(makeUser());
    mocks.prisma.user.update.mockResolvedValue(makeUser());
    mocks.sendPasswordResetOtpEmail.mockResolvedValue({ previewUrl: 'https://example.test/unit-preview' });
    observation.mockConfiguration.userUpdate = 'resolve';
    observation.mockConfiguration.mail = { resolve: { previewUrl: 'https://example.test/unit-preview' } };
    // Act
    const actual = await invoke('forgotPassword', forgotPassword, { email: 'user@example.com' });
    // Assert
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 },
      data: { resetOtp: '100000', resetOtpExpiry: new Date(CLOCK.getTime() + 900000) } });
    expect(mocks.sendPasswordResetOtpEmail).toHaveBeenCalledExactlyOnceWith({
      to: 'user@example.com', userName: 'Unit Test User', otp: '100000', expiryMinutes: 15,
    });
    expect(mocks.prisma.user.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendPasswordResetOtpEmail.mock.invocationCallOrder[0]);
    expect(actual).toEqual({ statusCode: 200, payload: {
      message: 'Mã xác thực OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư (kể cả hòm thư rác/spam).',
      previewUrl: 'https://example.test/unit-preview',
    } });
    expect(mocks.bcrypt.hash).not.toHaveBeenCalled(); expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  test('WB-FP-07 forgotPassword reports a mail failure after storing the OTP', async () => {
    // Arrange
    frozenClock(); fixedOtpRandom(); foundUser(makeUser());
    mocks.prisma.user.update.mockResolvedValue(makeUser());
    mocks.sendPasswordResetOtpEmail.mockRejectedValue(new Error('Simulated email delivery failure'));
    observation.mockConfiguration.userUpdate = 'resolve';
    observation.mockConfiguration.mail = { reject: 'Simulated email delivery failure' };
    // Act
    const actual = await invoke('forgotPassword', forgotPassword, { email: 'user@example.com' });
    // Assert
    expect(actual).toEqual({ statusCode: 500, payload: { error: 'Không thể gửi mã xác nhận OTP, vui lòng thử lại sau' } });
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 },
      data: { resetOtp: '100000', resetOtpExpiry: new Date(CLOCK.getTime() + 900000) } });
    expect(mocks.sendPasswordResetOtpEmail).toHaveBeenCalledExactlyOnceWith({
      to: 'user@example.com', userName: 'Unit Test User', otp: '100000', expiryMinutes: 15,
    });
    expect(mocks.prisma.user.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendPasswordResetOtpEmail.mock.invocationCallOrder[0]);
    expect(mocks.createNotification).not.toHaveBeenCalled(); expect(mocks.bcrypt.hash).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('Authentication Phase 2 — resetPassword guards and OTP reuse', () => {
  test('WB-RP-01 resetPassword rejects a missing email', async () => {
    // Arrange / Act
    const actual = await invoke('resetPassword', resetPassword, { email: '', otp: '123456', newPassword: 'abcdef' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled(); expectNoCredentialWrite();
  });

  test('WB-RP-02 resetPassword rejects a missing OTP', async () => {
    // Arrange / Act
    const actual = await invoke('resetPassword', resetPassword, { email: 'user@example.com', otp: '', newPassword: 'abcdef' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled(); expectNoCredentialWrite();
  });

  test('WB-RP-03 resetPassword rejects a missing new password', async () => {
    // Arrange / Act
    const actual = await invoke('resetPassword', resetPassword, { email: 'user@example.com', otp: '123456', newPassword: '' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled(); expectNoCredentialWrite();
  });

  test('WB-RP-05 resetPassword rejects a five-character password', async () => {
    // Arrange / Act
    const actual = await invoke('resetPassword', resetPassword, { email: 'user@example.com', otp: '123456', newPassword: 'abcde' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled(); expectNoCredentialWrite();
  });

  test('WB-RP-06 resetPassword rejects a missing user record', async () => {
    // Arrange
    foundUser(null);
    // Act
    const actual = await invoke('resetPassword', resetPassword, { email: 'user@example.com', otp: '123456', newPassword: 'abcdef' });
    // Assert
    expect(actual).toEqual({ statusCode: 404, payload: { error: 'Người dùng không tồn tại' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { email: 'user@example.com' } });
    expectNoCredentialWrite();
  });

  test('WB-RP-09 resetPassword rejects an OTP without expiry', async () => {
    // Arrange
    foundUser(makeUser({ resetOtpExpiry: null }));
    // Act
    const actual = await invoke('resetPassword', resetPassword, { email: 'user@example.com', otp: '123456', newPassword: 'abcdef' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mã OTP đã hết hạn, vui lòng yêu cầu gửi lại mã mới' } });
    expectNoCredentialWrite();
  });

  test('WB-RP-15 resetPassword rejects reusing an OTP cleared by the first reset', async () => {
    // Arrange: isolated mutable record, no SQLite. Return a copy on every lookup.
    frozenClock();
    const memoryRecord = makeUser({ resetOtpExpiry: new Date(CLOCK.getTime() + 1) });
    mocks.prisma.user.findUnique.mockImplementation(async () => structuredClone(memoryRecord));
    mocks.prisma.user.update.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      Object.assign(memoryRecord, args.data); return structuredClone(memoryRecord);
    });
    mocks.bcrypt.hash.mockResolvedValue(HASH);
    mocks.createNotification.mockResolvedValue({ id: 1 });
    observation.mockConfiguration.findUnique = snapshot(memoryRecord);
    observation.mockConfiguration.userUpdate = 'apply actual update.data to RAM record';
    observation.mockConfiguration.bcryptHash = HASH; observation.mockConfiguration.notification = 'resolve';
    const body = { email: 'user@example.com', otp: '123456', newPassword: 'abcdef' };
    // Act / Assert: first reset must clear both OTP fields through the real controller.
    const first = await invoke('resetPassword', resetPassword, body);
    expect(first.statusCode).toBe(200);
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 },
      data: { password: HASH, resetOtp: null, resetOtpExpiry: null } });
    expect(memoryRecord.resetOtp).toBeNull(); expect(memoryRecord.resetOtpExpiry).toBeNull();
    // Act / Assert: same input replays against the updated RAM state.
    observation.mockConfiguration.findUnique = snapshot(memoryRecord);
    const replay = await invoke('resetPassword', resetPassword, body);
    expect(replay).toEqual({ statusCode: 400, payload: { error: 'Mã OTP không chính xác' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(2);
    expect(mocks.bcrypt.hash).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.user.update).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
  });
});
