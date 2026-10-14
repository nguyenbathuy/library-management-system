import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AuthRequest } from '../../../src/middleware/auth';
import type { Response } from 'express';
import { ACTOR, CLOCK, HASH, TOKEN, makeUser } from '../../fixtures/auth';
import designs from '../../fixtures/phase1-cases.json';
import { makeRequest, makeResponse } from '../../mocks/http';

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
    sendPasswordResetOtpEmail: vi.fn(),
    createNotification: vi.fn(),
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

// All factories above are hoisted by Vitest; Prisma additionally has a fail-closed alias.
import { PrismaClient } from '@prisma/client';
import { register, login, changePassword, resetPassword } from '../../../src/controllers/authController';

type Controller = (request: AuthRequest, response: Response) => unknown;
type Observation = {
  id: string;
  input?: Record<string, unknown>;
  actor?: AuthRequest['user'];
  actual?: ReturnType<typeof makeResponse>['actual'];
  mockConfiguration: Record<string, unknown>;
};
let observation: Observation;
const traces: Record<string, unknown>[] = [];
const consoleErrors: unknown[][] = [];
let consoleSpy: ReturnType<typeof vi.spyOn>;

function foundUser(user: ReturnType<typeof makeUser> | null) {
  observation.mockConfiguration.findUnique = user;
  mocks.prisma.user.findUnique.mockResolvedValue(user);
}

function matchingPassword(matches: boolean) {
  observation.mockConfiguration.bcryptCompare = matches;
  mocks.bcrypt.compare.mockResolvedValue(matches);
}

function successfulHash() {
  observation.mockConfiguration.bcryptHash = HASH;
  mocks.bcrypt.hash.mockResolvedValue(HASH);
}

function successfulUpdate() {
  observation.mockConfiguration.userUpdate = 'resolve';
  observation.mockConfiguration.notification = 'resolve';
  mocks.prisma.user.update.mockResolvedValue(makeUser());
  mocks.createNotification.mockResolvedValue({ id: 1 });
}

async function invoke(controller: Controller, body: Record<string, unknown>, actor?: AuthRequest['user']) {
  const request = makeRequest(body, actor);
  const response = makeResponse();
  observation.input = structuredClone(body);
  observation.actor = actor ? { ...actor } : undefined;
  observation.actual = response.actual;
  await controller(request, response.response);
  expect(response.spies.json).toHaveBeenCalledTimes(1);
  return response.actual;
}

function expectNoCredentialWrite() {
  expect(mocks.bcrypt.hash).not.toHaveBeenCalled();
  expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  expect(mocks.createNotification).not.toHaveBeenCalled();
}

beforeAll(() => {
  // Mandatory gate BEFORE any testcase invokes application code.
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(vi.isMockFunction(PrismaClient)).toBe(true);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  expect(Object.values(mocks.factories)).toEqual([true, true, true, true, true]);
  for (const method of Object.values(mocks.prisma.user)) {
    expect(vi.isMockFunction(method)).toBe(true);
    expect(method).not.toHaveBeenCalled();
  }
  consoleSpy = vi.spyOn(console, 'error').mockImplementation((...args) => consoleErrors.push(args));
  const directory = process.env.LMS_WB_RUN_DIR!;
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'isolation-gate.json'), JSON.stringify({
    observedAt: new Date().toISOString(),
    mockedConstructor: true,
    controllerImportConstructorCalls: mocks.PrismaClient.mock.calls.length,
    constructorReturnedExpectedMock: true,
    factories: mocks.factories,
    databaseCallsBeforeTests: 0,
    prismaAlias: 'server/tests/mocks/prismaGuard.ts',
    startupPolicy: 'Only authController.ts imported; no index.ts, route bootstrap, seed or migration import.',
  }, null, 2));
});

beforeEach((context) => {
  for (const method of [
    ...Object.values(mocks.prisma.user), mocks.prisma.$connect, mocks.prisma.$disconnect,
    ...Object.values(mocks.bcrypt), ...Object.values(mocks.jwt),
    mocks.sendPasswordResetOtpEmail, mocks.createNotification,
  ]) {
    method.mockReset();
    method.mockImplementation(() => { throw new Error('Unconfigured mock call: test must arrange this dependency.'); });
  }
  consoleErrors.length = 0;
  const id = context.task.name.match(/WB-[A-Z]+-\d+/)?.[0];
  expect(id).toBeDefined();
  expect(designs.some((design) => design.id === id && design.oracle !== 'R')).toBe(true);
  observation = { id: id!, mockConfiguration: { default: 'deny unconfigured calls' } };
  context.onTestFinished(async (finished) => {
    expect(mocks.prisma.$connect).not.toHaveBeenCalled();
    expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetOtpEmail).not.toHaveBeenCalled();
    const calls: Record<string, unknown> = {};
    for (const [name, method] of Object.entries({
      'user.create': mocks.prisma.user.create,
      'user.findUnique': mocks.prisma.user.findUnique,
      'user.findMany': mocks.prisma.user.findMany,
      'user.update': mocks.prisma.user.update,
      'prisma.$connect': mocks.prisma.$connect,
      'prisma.$disconnect': mocks.prisma.$disconnect,
      'bcrypt.hash': mocks.bcrypt.hash,
      'bcrypt.compare': mocks.bcrypt.compare,
      'jwt.sign': mocks.jwt.sign,
      'mail.sendPasswordResetOtpEmail': mocks.sendPasswordResetOtpEmail,
      'notification.createNotification': mocks.createNotification,
    })) {
      const outcomes = await Promise.allSettled(method.mock.results.map(async (result) => {
        if (result.type === 'throw') throw result.value;
        return await result.value;
      }));
      calls[name] = {
        arguments: method.mock.calls,
        outcomes: outcomes.map((outcome) => outcome.status === 'fulfilled'
          ? { status: outcome.status, value: outcome.value }
          : { status: outcome.status, error: String(outcome.reason), code: outcome.reason?.code }),
      };
    }
    vi.useRealTimers();
    traces.push({
      ...observation,
      runnerStateAtFinishedHook: finished.task.result?.state,
      recordedAt: new Date().toISOString(),
      consoleErrors: consoleErrors.map((args) => args.map(String)),
      calls,
    });
  });
});

afterAll(() => {
  try {
    expect(mocks.prisma.$connect).not.toHaveBeenCalled();
    expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
    expect(mocks.sendPasswordResetOtpEmail).not.toHaveBeenCalled();
    writeFileSync(resolve(process.env.LMS_WB_RUN_DIR!, 'case-traces.json'), JSON.stringify(traces, null, 2));
  } finally {
    vi.useRealTimers();
    consoleSpy?.mockRestore();
  }
});

describe('Authentication Phase 1 — public registration', () => {
  test('WB-RG-01 register hashes password and creates a USER', async () => {
    // Arrange
    successfulHash();
    observation.mockConfiguration.userCreate = 'resolve';
    mocks.prisma.user.create.mockResolvedValue(makeUser());
    const body = { email: 'user@example.com', name: 'Unit Test User', password: 'oldpass' };
    // Act
    const actual = await invoke(register, body);
    // Assert
    expect(actual).toEqual({ statusCode: 201, payload: { message: 'User created' } });
    expect(mocks.bcrypt.hash).toHaveBeenCalledExactlyOnceWith('oldpass', 10);
    expect(mocks.prisma.user.create).toHaveBeenCalledExactlyOnceWith({
      data: { email: body.email, name: body.name, password: HASH, role: 'USER' },
    });
    expect(mocks.prisma.user.create.mock.calls[0][0].data.password).not.toBe(body.password);
  });

  test('WB-RG-02 register rejects a duplicate email', async () => {
    // Arrange
    successfulHash();
    observation.mockConfiguration.userCreate = { reject: 'P2002' };
    mocks.prisma.user.create.mockRejectedValue(Object.assign(new Error('Simulated duplicate email'), { code: 'P2002' }));
    // Act
    const actual = await invoke(register, { email: 'user@example.com', name: 'Unit Test User', password: 'oldpass' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'User already exists' } });
    expect(mocks.prisma.user.create).toHaveBeenCalledTimes(1);
  });
});

describe('Authentication Phase 1 — login', () => {
  test('WB-LG-01 login short-circuits when user does not exist', async () => {
    // Arrange
    foundUser(null);
    // Act
    const actual = await invoke(login, { email: 'user@example.com', password: 'oldpass' });
    // Assert
    expect(actual).toEqual({ statusCode: 401, payload: { error: 'Invalid credentials' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { email: 'user@example.com' } });
    expect(mocks.bcrypt.compare).not.toHaveBeenCalled();
    expect(mocks.jwt.sign).not.toHaveBeenCalled();
  });

  test('WB-LG-02 login rejects an incorrect password', async () => {
    // Arrange
    foundUser(makeUser());
    matchingPassword(false);
    // Act
    const actual = await invoke(login, { email: 'user@example.com', password: 'wrongpass' });
    // Assert
    expect(actual).toEqual({ statusCode: 401, payload: { error: 'Invalid credentials' } });
    expect(mocks.bcrypt.compare).toHaveBeenCalledExactlyOnceWith('wrongpass', 'unit-test-stored-hash');
    expect(mocks.jwt.sign).not.toHaveBeenCalled();
  });

  test('WB-LG-03 login returns a one-hour token and safe user DTO', async () => {
    // Arrange
    foundUser(makeUser());
    matchingPassword(true);
    observation.mockConfiguration.jwtSign = TOKEN;
    mocks.jwt.sign.mockReturnValue(TOKEN);
    // Act
    const actual = await invoke(login, { email: 'user@example.com', password: 'oldpass' });
    // Assert
    expect(mocks.jwt.sign).toHaveBeenCalledExactlyOnceWith(
      { userId: 1, email: 'user@example.com', role: 'USER' },
      'unit-test-secret-never-used-for-real-tokens', { expiresIn: '1h' },
    );
    expect(actual).toEqual({ statusCode: 200, payload: {
      token: TOKEN, user: { id: 1, email: 'user@example.com', name: 'Unit Test User', role: 'USER', membershipTier: 'STANDARD', isBlacklisted: false },
    } });
    expect((actual.payload as { user: unknown }).user).not.toHaveProperty('password');
    expect((actual.payload as { user: unknown }).user).not.toHaveProperty('resetOtp');
  });
});

describe('Authentication Phase 1 — changePassword', () => {
  test('WB-CP-01 changePassword requires an authenticated user', async () => {
    // Arrange: no actor; every dependency denies unconfigured calls.
    // Act
    const actual = await invoke(changePassword, { currentPassword: 'oldpass', newPassword: 'abcdef' });
    // Assert
    expect(actual).toEqual({ statusCode: 401, payload: { error: 'Unauthorized' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expectNoCredentialWrite();
  });

  test('WB-CP-02 changePassword rejects a missing current password', async () => {
    // Arrange / Act
    const actual = await invoke(changePassword, { currentPassword: '', newPassword: 'abcdef' }, ACTOR);
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expectNoCredentialWrite();
  });

  test('WB-CP-03 changePassword rejects a missing new password', async () => {
    // Arrange / Act
    const actual = await invoke(changePassword, { currentPassword: 'oldpass', newPassword: '' }, ACTOR);
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expectNoCredentialWrite();
  });

  test('WB-CP-04 changePassword rejects five characters', async () => {
    // Arrange / Act
    const actual = await invoke(changePassword, { currentPassword: 'oldpass', newPassword: 'abcde' }, ACTOR);
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mật khẩu mới phải có độ dài tối thiểu 6 ký tự' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expectNoCredentialWrite();
  });

  test('WB-CP-08 changePassword accepts six characters and sends notification', async () => {
    // Arrange
    foundUser(makeUser()); matchingPassword(true); successfulHash(); successfulUpdate();
    // Act
    const actual = await invoke(changePassword, { currentPassword: 'oldpass', newPassword: 'abcdef' }, ACTOR);
    // Assert
    expect(actual).toEqual({ statusCode: 200, payload: { message: 'Đổi mật khẩu thành công!' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 } });
    expect(mocks.bcrypt.compare).toHaveBeenCalledExactlyOnceWith('oldpass', 'unit-test-stored-hash');
    expect(mocks.bcrypt.hash).toHaveBeenCalledExactlyOnceWith('abcdef', 10);
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 }, data: { password: HASH } });
    expect(mocks.createNotification).toHaveBeenCalledExactlyOnceWith({
      userId: 1, title: 'Đổi mật khẩu thành công', message: 'Mật khẩu tài khoản của bạn vừa được cập nhật thành công.',
    });
    expect(mocks.prisma.user.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.createNotification.mock.invocationCallOrder[0]);
  });

  test('WB-CP-09 changePassword reports an update failure with seven characters', async () => {
    // Arrange
    foundUser(makeUser()); matchingPassword(true); successfulHash();
    observation.mockConfiguration.userUpdate = { reject: 'Simulated unit update failure' };
    mocks.prisma.user.update.mockRejectedValue(new Error('Simulated unit update failure'));
    // Act
    const actual = await invoke(changePassword, { currentPassword: 'oldpass', newPassword: 'abcdefg' }, ACTOR);
    // Assert
    expect(actual).toEqual({ statusCode: 500, payload: { error: 'Không thể cập nhật mật khẩu, vui lòng thử lại sau' } });
    expect(mocks.bcrypt.hash).toHaveBeenCalledExactlyOnceWith('abcdefg', 10);
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 }, data: { password: HASH } });
    expect(mocks.createNotification).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('Authentication Phase 1 — resetPassword', () => {
  test('WB-RP-04 resetPassword rejects a non-string password', async () => {
    // Arrange / Act
    const actual = await invoke(resetPassword, { email: 'user@example.com', otp: '123456', newPassword: 123456 });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expectNoCredentialWrite();
  });

  test('WB-RP-08 resetPassword rejects an incorrect OTP', async () => {
    // Arrange
    foundUser(makeUser());
    // Act
    const actual = await invoke(resetPassword, { email: 'user@example.com', otp: '999999', newPassword: 'abcdef' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mã OTP không chính xác' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { email: 'user@example.com' } });
    expectNoCredentialWrite();
  });

  test('WB-RP-10 resetPassword rejects an OTP expired by one millisecond', async () => {
    // Arrange
    vi.useFakeTimers(); vi.setSystemTime(CLOCK);
    observation.mockConfiguration.clock = CLOCK.toISOString();
    foundUser(makeUser({ resetOtpExpiry: new Date(CLOCK.getTime() - 1) }));
    // Act
    const actual = await invoke(resetPassword, { email: 'user@example.com', otp: '123456', newPassword: 'abcdef' });
    // Assert
    expect(actual).toEqual({ statusCode: 400, payload: { error: 'Mã OTP đã hết hạn, vui lòng yêu cầu gửi lại mã mới' } });
    expectNoCredentialWrite();
  });

  test('WB-RP-12 resetPassword normalizes input and clears a valid OTP', async () => {
    // Arrange
    vi.useFakeTimers(); vi.setSystemTime(CLOCK);
    observation.mockConfiguration.clock = CLOCK.toISOString();
    foundUser(makeUser()); successfulHash(); successfulUpdate();
    // Act
    const actual = await invoke(resetPassword, { email: ' USER@EXAMPLE.COM ', otp: ' 123456 ', newPassword: 'abcdef' });
    // Assert
    expect(actual).toEqual({ statusCode: 200, payload: { message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { email: 'user@example.com' } });
    expect(mocks.bcrypt.hash).toHaveBeenCalledExactlyOnceWith('abcdef', 10);
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 1 }, data: { password: HASH, resetOtp: null, resetOtpExpiry: null },
    });
    expect(mocks.createNotification).toHaveBeenCalledExactlyOnceWith({
      userId: 1, title: 'Đặt lại mật khẩu thành công', message: 'Mật khẩu tài khoản của bạn đã được đặt lại thành công qua mã xác thực OTP.',
    });
    expect(mocks.prisma.user.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.createNotification.mock.invocationCallOrder[0]);
  });
});
