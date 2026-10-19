import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../../src/middleware/auth';
import { HASH, makeUser } from '../../fixtures/auth';
import designs from '../../fixtures/phase3-cases.json';
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
import { register, getAllUsers, getMe, toggleBlacklist } from '../../../src/controllers/authController';
import { authenticateToken, authorizeAdmin } from '../../../src/middleware/auth';
import authRouter from '../../../src/routes/authRoutes';

const ADMIN = { userId: 1, email: 'admin@example.test', role: 'ADMIN' };
const USER = { userId: 2, email: 'member@example.test', role: 'USER' };
const MEMBER_BODY = {
  name: 'Synthetic Member', email: 'member@example.test', password: 'unit-password', role: 'USER',
};
const PUBLIC_SELECT = {
  id: true, email: true, name: true, role: true,
  membershipTier: true, isBlacklisted: true, createdAt: true,
};
// getMe additionally selects twoFactorEnabled since commit 90f35a26 (oracle S re-baselined).
const ME_SELECT = { ...PUBLIC_SELECT, twoFactorEnabled: true };
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
type Handler = (request: AuthRequest, response: Response, next: NextFunction) => unknown;
type Controller = (request: AuthRequest, response: Response) => unknown;
type RegisteredRoute = {
  path: string;
  methods: Record<string, boolean>;
  stack: { handle: Handler }[];
};
type Observation = {
  id: string; mockConfiguration: Record<string, unknown>; invocations: Record<string, unknown>[];
};
let observation: Observation;
const traces: Record<string, unknown>[] = [];
const consoleErrors: unknown[][] = [];
let consoleSpy: ReturnType<typeof vi.spyOn>;

function memberDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 2, email: 'member@example.test', name: 'Synthetic Member', role: 'USER',
    membershipTier: 'LECTURER', isBlacklisted: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'), ...overrides,
  };
}
function storedMember(overrides: Record<string, unknown> = {}) {
  return makeUser({ ...memberDto(), ...overrides });
}
function foundUser(value: ReturnType<typeof makeUser> | null) {
  observation.mockConfiguration.findUnique = snapshot(value);
  mocks.prisma.user.findUnique.mockResolvedValue(value);
}
function queryResults(values: ReturnType<typeof memberDto>[]) {
  observation.mockConfiguration.findMany = snapshot(values);
  mocks.prisma.user.findMany.mockResolvedValue(values);
}
function blacklistUpdate(newStatus: boolean) {
  const updated = memberDto({ isBlacklisted: newStatus });
  observation.mockConfiguration.userUpdate = snapshot(updated);
  mocks.prisma.user.update.mockResolvedValue(updated);
  return updated;
}
function request(body: Record<string, unknown>, actor?: AuthRequest['user'], id = '2') {
  const req = makeRequest(body, actor);
  req.params = { id };
  return req;
}
function captureResponse(response: ReturnType<typeof makeResponse>) {
  const responseWritten = response.spies.json.mock.calls.length + response.spies.sendStatus.mock.calls.length > 0;
  return {
    responseWritten,
    statusCode: responseWritten ? response.actual.statusCode : null,
    payload: responseWritten ? snapshot({ value: response.actual.payload }).value ?? null : null,
  };
}
async function invoke(name: string, controller: Controller, req: AuthRequest) {
  const response = makeResponse();
  const start = callOffsets(methods);
  let rejection: unknown;
  try {
    await controller(req, response.response);
    expect(response.spies.json).toHaveBeenCalledTimes(1);
    return captureResponse(response);
  } catch (error) {
    rejection = error;
    throw error;
  } finally {
    observation.invocations.push({
      function: name, input: snapshot(req.body), params: snapshot(req.params), actor: req.user ?? null,
      mockConfiguration: snapshot(observation.mockConfiguration), actual: captureResponse(response),
      rejection: rejection ? String(rejection) : null, calls: await dependencyCalls(methods, start),
    });
  }
}
function expectNoMemberWrite() {
  expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  expect(mocks.prisma.user.update).not.toHaveBeenCalled();
}
function registeredRoute(method: string, path: string): RegisteredRoute {
  // Read registration from the real Router. This unit helper does not call Router.handle,
  // dispatch an HTTP request, start a server, or mock the handlers under test.
  const layers = (authRouter as unknown as { stack: { route?: RegisteredRoute }[] }).stack;
  const matches = layers.filter(({ route }) => route?.path === path && route.methods[method]);
  expect(matches).toHaveLength(1);
  return matches[0].route!;
}
async function invokeMemberRoute(method: string, path: string, req: AuthRequest, terminal: Controller) {
  const route = registeredRoute(method, path);
  const handlers = route.stack.map(({ handle }) => handle);
  expect(handlers).toEqual([authenticateToken, authorizeAdmin, terminal]);
  const response = makeResponse();
  const start = callOffsets(methods);
  const executedHandlers: string[] = [];
  const nextCalls: Record<string, number> = {};
  let continueToNext = true;
  for (const handler of handlers) {
    if (!continueToNext) break;
    continueToNext = false;
    const next = vi.fn(() => { continueToNext = true; });
    executedHandlers.push(handler.name);
    await handler(req, response.response, next as NextFunction);
    nextCalls[handler.name] = next.mock.calls.length;
  }
  const actual = captureResponse(response);
  observation.invocations.push({
    function: `${method.toUpperCase()} ${path}`, input: snapshot(req.body), params: snapshot(req.params),
    authorization: req.headers.authorization ?? null, actorAfter: req.user ?? null,
    registeredHandlers: handlers.map((handler) => handler.name), executedHandlers, nextCalls,
    mockConfiguration: snapshot(observation.mockConfiguration), actual,
    calls: await dependencyCalls(methods, start),
  });
  return { actual, executedHandlers, nextCalls };
}
function verifiedJwt(actor: typeof ADMIN | typeof USER) {
  observation.mockConfiguration.verify = { error: null, decodedUser: actor };
  mocks.jwt.verify.mockImplementation((_token, _secret, callback) => callback(null, { ...actor }));
}
function tokenRequest(body: Record<string, unknown> = {}) {
  const req = request(body);
  req.headers.authorization = 'Bearer unit-member-token';
  return req;
}

beforeAll(() => {
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(vi.isMockFunction(PrismaClient)).toBe(true);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  expect(Object.values(mocks.factories)).toEqual([true, true, true, true, true]);
  for (const method of Object.values(methods)) expect(method).not.toHaveBeenCalled();
  consoleSpy = vi.spyOn(console, 'error').mockImplementation((...args) => consoleErrors.push(args));
  writeEvidence('phase3-member-isolation-gate.json', {
    observedAt: new Date().toISOString(), constructorIsMock: true,
    constructorCallsAtImport: mocks.PrismaClient.mock.calls.length, factories: mocks.factories,
    alias: 'server/tests/mocks/prismaGuard.ts', routerImportedWithoutProductionBootstrap: true,
  });
});
beforeEach((context) => {
  for (const method of Object.values(methods)) {
    method.mockReset();
    method.mockImplementation(() => { throw new Error('Unconfigured Phase 3 mock call.'); });
  }
  consoleErrors.length = 0;
  const id = context.task.name.match(/WB-[A-Z]+-\d+/)?.[0];
  expect(designs.some((design) => design.id === id && design.oracle !== 'R')).toBe(true);
  observation = { id: id!, mockConfiguration: { default: 'deny unconfigured calls' }, invocations: [] };
  context.onTestFinished(async (finished) => {
    for (const method of [mocks.prisma.$connect, mocks.prisma.$disconnect, mocks.prisma.$transaction,
      mocks.bcrypt.compare, mocks.jwt.sign, mocks.sendPasswordResetOtpEmail, mocks.createNotification]) {
      expect(method).not.toHaveBeenCalled();
    }
    traces.push({ ...snapshot(observation), runnerStateAtFinishedHook: finished.task.result?.state,
      recordedAt: new Date().toISOString(), consoleErrors: consoleErrors.map((args) => args.map(String)),
      calls: await dependencyCalls(methods) });
  });
});
afterAll(() => {
  try { writeEvidence('phase3-member-traces.json', traces); }
  finally { consoleSpy?.mockRestore(); }
});

describe('Member Management Phase 3 — creation and confirmed tier regression', () => {
  test('WB-RG-03 register propagates a hash rejection before any create', async () => {
    // Arrange — source-level exception boundary, not a new HTTP error policy.
    const fault = new Error('Simulated hash failure');
    observation.mockConfiguration.hash = { reject: String(fault) };
    mocks.bcrypt.hash.mockRejectedValue(fault);
    // Act / Assert
    await expect(invoke('register', register, request(MEMBER_BODY, ADMIN))).rejects.toBe(fault);
    expect(mocks.bcrypt.hash).toHaveBeenCalledExactlyOnceWith(MEMBER_BODY.password, 10);
    expectNoMemberWrite();
  });
  // KNOWN BUG DEF-002: register ép cứng membershipTier, bỏ hạng được chọn.
  test.fails('WB-RG-04 register must preserve the selected LECTURER tier — DEF-002', async () => {
    // Arrange — the returned mock row is never used as evidence of persistence.
    mocks.bcrypt.hash.mockResolvedValue(HASH);
    mocks.prisma.user.create.mockResolvedValue(makeUser());
    observation.mockConfiguration = { hash: HASH, userCreate: 'resolve; no native persistence' };
    const body = { ...MEMBER_BODY, membershipTier: 'LECTURER' };
    // Act
    const actual = await invoke('register', register, request(body, ADMIN));
    // Assert — spec oracle kept; marked test.fails so the suite stays green while DEF-002 is open.
    expect(actual).toMatchObject({ statusCode: 201, payload: { message: 'User created' } });
    expect(mocks.bcrypt.hash).toHaveBeenCalledExactlyOnceWith(body.password, 10);
    expect(mocks.prisma.user.create).toHaveBeenCalledExactlyOnceWith({
      data: { email: body.email, name: body.name, password: HASH, role: 'USER', membershipTier: 'LECTURER' },
    });
  });
  // KNOWN BUG DEF-002
  test.fails('WB-RG-05 register must preserve the selected PREMIUM tier — DEF-002', async () => {
    // Arrange
    mocks.bcrypt.hash.mockResolvedValue(HASH);
    mocks.prisma.user.create.mockResolvedValue(makeUser());
    observation.mockConfiguration = { hash: HASH, userCreate: 'resolve; no native persistence' };
    const body = { ...MEMBER_BODY, membershipTier: 'PREMIUM' };
    // Act
    const actual = await invoke('register', register, request(body, ADMIN));
    // Assert
    expect(actual).toMatchObject({ statusCode: 201, payload: { message: 'User created' } });
    expect(mocks.bcrypt.hash).toHaveBeenCalledExactlyOnceWith(body.password, 10);
    expect(mocks.prisma.user.create).toHaveBeenCalledExactlyOnceWith({
      data: { email: body.email, name: body.name, password: HASH, role: 'USER', membershipTier: 'PREMIUM' },
    });
  });
});

describe('Member Management Phase 3 — list and identity DTOs', () => {
  test('WB-GU-01 getAllUsers returns an empty list with explicit safe select and ordering', async () => {
    queryResults([]);
    const actual = await invoke('getAllUsers', getAllUsers, request({}, ADMIN));
    expect(actual).toEqual({ responseWritten: true, statusCode: 200, payload: [] });
    expect(mocks.prisma.user.findMany).toHaveBeenCalledExactlyOnceWith({ select: PUBLIC_SELECT, orderBy: { id: 'asc' } });
    expectNoMemberWrite();
  });
  test('WB-GU-02 getAllUsers forwards mixed role tier and blacklist DTOs without requesting secrets', async () => {
    const dtos = [memberDto(), memberDto({ id: 3, email: 'second@example.test', role: 'ADMIN', membershipTier: 'STANDARD', isBlacklisted: true })];
    queryResults(dtos);
    const actual = await invoke('getAllUsers', getAllUsers, request({}, ADMIN));
    expect(actual.payload).toEqual(snapshot(dtos));
    expect(mocks.prisma.user.findMany).toHaveBeenCalledExactlyOnceWith({ select: PUBLIC_SELECT, orderBy: { id: 'asc' } });
    expectNoMemberWrite();
  });
  test('WB-GU-03 getAllUsers propagates a lookup rejection without writing a response', async () => {
    const fault = new Error('Simulated member list failure');
    mocks.prisma.user.findMany.mockRejectedValue(fault);
    observation.mockConfiguration.findMany = { reject: String(fault) };
    await expect(invoke('getAllUsers', getAllUsers, request({}, ADMIN))).rejects.toBe(fault);
    expect(mocks.prisma.user.findMany).toHaveBeenCalledExactlyOnceWith({ select: PUBLIC_SELECT, orderBy: { id: 'asc' } });
    expect(observation.invocations[0].actual).toEqual({ responseWritten: false, statusCode: null, payload: null });
    expectNoMemberWrite();
  });
  test('WB-ME-01 getMe rejects a missing identity before any query', async () => {
    const actual = await invoke('getMe', getMe, request({}));
    expect(actual).toEqual({ responseWritten: true, statusCode: 401, payload: { error: 'Not authenticated' } });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expectNoMemberWrite();
  });
  test('WB-ME-02 getMe rejects an identity whose member no longer exists', async () => {
    foundUser(null);
    const actual = await invoke('getMe', getMe, request({}, USER));
    expect(actual).toEqual({ responseWritten: true, statusCode: 404, payload: { error: 'User not found' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: USER.userId }, select: ME_SELECT });
    expectNoMemberWrite();
  });
  test('WB-ME-03 getMe selects public fields for the JWT userId and returns its tier', async () => {
    const dto = memberDto();
    observation.mockConfiguration.findUnique = snapshot(dto);
    mocks.prisma.user.findUnique.mockResolvedValue(dto);
    const actual = await invoke('getMe', getMe, request({}, USER));
    expect(actual).toEqual({ responseWritten: true, statusCode: 200, payload: snapshot(dto) });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: USER.userId }, select: ME_SELECT });
    expectNoMemberWrite();
  });
  test('WB-ME-04 getMe propagates a database rejection without inventing an HTTP result', async () => {
    const fault = new Error('Simulated member identity failure');
    mocks.prisma.user.findUnique.mockRejectedValue(fault);
    observation.mockConfiguration.findUnique = { reject: String(fault) };
    await expect(invoke('getMe', getMe, request({}, USER))).rejects.toBe(fault);
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: USER.userId }, select: ME_SELECT });
    expect(observation.invocations[0].actual).toEqual({ responseWritten: false, statusCode: null, payload: null });
    expectNoMemberWrite();
  });
});

describe('Member Management Phase 3 — blacklist guards and state', () => {
  test('WB-TB-01 toggleBlacklist returns 404 and does not update a missing member', async () => {
    foundUser(null);
    const actual = await invoke('toggleBlacklist', toggleBlacklist, request({ isBlacklisted: true }, ADMIN));
    expect(actual).toEqual({ responseWritten: true, statusCode: 404, payload: { error: 'Không tìm thấy người dùng' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: 2 } });
    expectNoMemberWrite();
  });
  test('WB-TB-02 toggleBlacklist refuses a self update', async () => {
    foundUser(storedMember({ id: ADMIN.userId, role: ADMIN.role, email: ADMIN.email }));
    const actual = await invoke('toggleBlacklist', toggleBlacklist, request({ isBlacklisted: true }, ADMIN, '1'));
    expect(actual).toEqual({ responseWritten: true, statusCode: 400, payload: { error: 'Không thể tự đưa chính tài khoản của bạn vào danh sách đen' } });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: 1 } });
    expectNoMemberWrite();
  });
  test('WB-TB-03 toggleBlacklist explicitly blocks an active member', async () => {
    foundUser(storedMember({ isBlacklisted: false }));
    const updated = blacklistUpdate(true);
    const actual = await invoke('toggleBlacklist', toggleBlacklist, request({ isBlacklisted: true }, ADMIN));
    expect(actual.payload).toEqual({ message: 'Đã đưa độc giả "Synthetic Member" vào Danh sách Đen (chặn mượn sách).', user: snapshot(updated) });
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 2 }, data: { isBlacklisted: true }, select: PUBLIC_SELECT });
  });
  test('WB-TB-04 toggleBlacklist explicitly unblocks a blacklisted member', async () => {
    foundUser(storedMember({ isBlacklisted: true }));
    const updated = blacklistUpdate(false);
    const actual = await invoke('toggleBlacklist', toggleBlacklist, request({ isBlacklisted: false }, ADMIN));
    expect(actual.payload).toEqual({ message: 'Đã mở khóa và gỡ độc giả "Synthetic Member" khỏi Danh sách Đen.', user: snapshot(updated) });
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 2 }, data: { isBlacklisted: false }, select: PUBLIC_SELECT });
  });
  test('WB-TB-05 toggleBlacklist toggles false to true when the flag is omitted', async () => {
    foundUser(storedMember({ isBlacklisted: false }));
    blacklistUpdate(true);
    const actual = await invoke('toggleBlacklist', toggleBlacklist, request({}, ADMIN));
    expect(actual.statusCode).toBe(200);
    expect(actual.payload).toMatchObject({ user: { isBlacklisted: true } });
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 2 }, data: { isBlacklisted: true }, select: PUBLIC_SELECT });
  });
  test('WB-TB-06 toggleBlacklist toggles true to false when the flag is omitted', async () => {
    foundUser(storedMember({ isBlacklisted: true }));
    blacklistUpdate(false);
    const actual = await invoke('toggleBlacklist', toggleBlacklist, request({}, ADMIN));
    expect(actual.statusCode).toBe(200);
    expect(actual.payload).toMatchObject({ user: { isBlacklisted: false } });
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 2 }, data: { isBlacklisted: false }, select: PUBLIC_SELECT });
  });
  test('WB-TB-08 toggleBlacklist reports a rejected update as 500', async () => {
    foundUser(storedMember());
    mocks.prisma.user.update.mockRejectedValue(new Error('Simulated blacklist update failure'));
    observation.mockConfiguration.userUpdate = { reject: 'Simulated blacklist update failure' };
    const actual = await invoke('toggleBlacklist', toggleBlacklist, request({ isBlacklisted: true }, ADMIN));
    expect(actual).toEqual({ responseWritten: true, statusCode: 500, payload: { error: 'Không thể cập nhật trạng thái danh sách đen' } });
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 2 }, data: { isBlacklisted: true }, select: PUBLIC_SELECT });
    expect(consoleErrors).toHaveLength(1);
  });
  test('WB-TB-09 toggleBlacklist reports a rejected lookup as 500 without an update', async () => {
    mocks.prisma.user.findUnique.mockRejectedValue(new Error('Simulated blacklist lookup failure'));
    observation.mockConfiguration.findUnique = { reject: 'Simulated blacklist lookup failure' };
    const actual = await invoke('toggleBlacklist', toggleBlacklist, request({ isBlacklisted: true }, ADMIN));
    expect(actual).toEqual({ responseWritten: true, statusCode: 500, payload: { error: 'Không thể cập nhật trạng thái danh sách đen' } });
    expect(consoleErrors).toHaveLength(1);
    expectNoMemberWrite();
  });
});

describe('Member Management Phase 3 — registered permission chains (unit wiring)', () => {
  test('WB-MR-01 GET users blocks an anonymous caller before query', async () => {
    const result = await invokeMemberRoute('get', '/users', request({}), getAllUsers);
    expect(result.actual).toEqual({ responseWritten: true, statusCode: 401, payload: null });
    expect(result.executedHandlers).toEqual(['authenticateToken']);
    expect(mocks.jwt.verify).not.toHaveBeenCalled();
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
    expectNoMemberWrite();
  });
  test('WB-MR-02 GET users blocks a JWT verifier error before query', async () => {
    const fault = new Error('Simulated invalid member JWT');
    mocks.jwt.verify.mockImplementation((_token, _secret, callback) => callback(fault));
    observation.mockConfiguration.verify = { reject: String(fault) };
    const result = await invokeMemberRoute('get', '/users', tokenRequest(), getAllUsers);
    expect(result.actual).toEqual({ responseWritten: true, statusCode: 403, payload: null });
    expect(result.executedHandlers).toEqual(['authenticateToken']);
    expect(mocks.jwt.verify).toHaveBeenCalledExactlyOnceWith('unit-member-token', process.env.JWT_SECRET, expect.any(Function));
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
    expectNoMemberWrite();
  });
  test('WB-MR-03 GET users blocks a verified USER before query', async () => {
    verifiedJwt(USER);
    const result = await invokeMemberRoute('get', '/users', tokenRequest(), getAllUsers);
    expect(result.actual).toEqual({ responseWritten: true, statusCode: 403, payload: { message: 'Forbidden' } });
    expect(result.executedHandlers).toEqual(['authenticateToken', 'authorizeAdmin']);
    expect(result.nextCalls).toEqual({ authenticateToken: 1, authorizeAdmin: 0 });
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
    expectNoMemberWrite();
  });
  test('WB-MR-04 GET users allows a verified ADMIN through the registered query handler', async () => {
    verifiedJwt(ADMIN);
    const dtos = [memberDto()];
    queryResults(dtos);
    const result = await invokeMemberRoute('get', '/users', tokenRequest(), getAllUsers);
    expect(result.actual).toEqual({ responseWritten: true, statusCode: 200, payload: snapshot(dtos) });
    expect(result.executedHandlers).toEqual(['authenticateToken', 'authorizeAdmin', 'getAllUsers']);
    expect(result.nextCalls).toEqual({ authenticateToken: 1, authorizeAdmin: 1, getAllUsers: 0 });
    expect(mocks.prisma.user.findMany).toHaveBeenCalledExactlyOnceWith({ select: PUBLIC_SELECT, orderBy: { id: 'asc' } });
    expectNoMemberWrite();
  });
  test('WB-MR-05 PATCH blacklist blocks a verified USER before any lookup or update', async () => {
    verifiedJwt(USER);
    const result = await invokeMemberRoute('patch', '/users/:id/blacklist', tokenRequest({ isBlacklisted: true }), toggleBlacklist);
    expect(result.actual).toEqual({ responseWritten: true, statusCode: 403, payload: { message: 'Forbidden' } });
    expect(result.executedHandlers).toEqual(['authenticateToken', 'authorizeAdmin']);
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expectNoMemberWrite();
  });
  test('WB-MR-06 PATCH blacklist allows a verified ADMIN to update another member', async () => {
    verifiedJwt(ADMIN);
    foundUser(storedMember({ isBlacklisted: false }));
    blacklistUpdate(true);
    const result = await invokeMemberRoute('patch', '/users/:id/blacklist', tokenRequest({ isBlacklisted: true }), toggleBlacklist);
    expect(result.actual.statusCode).toBe(200);
    expect(result.actual.payload).toMatchObject({ user: { id: 2, isBlacklisted: true } });
    expect(result.executedHandlers).toEqual(['authenticateToken', 'authorizeAdmin', 'toggleBlacklist']);
    expect(result.nextCalls).toEqual({ authenticateToken: 1, authorizeAdmin: 1, toggleBlacklist: 0 });
    expect(mocks.prisma.user.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 2 }, data: { isBlacklisted: true }, select: PUBLIC_SELECT });
  });
  test('WB-MR-07 PATCH blacklist blocks an anonymous caller before any lookup or update', async () => {
    const result = await invokeMemberRoute('patch', '/users/:id/blacklist', request({ isBlacklisted: true }), toggleBlacklist);
    expect(result.actual).toEqual({ responseWritten: true, statusCode: 401, payload: null });
    expect(result.executedHandlers).toEqual(['authenticateToken']);
    expect(mocks.jwt.verify).not.toHaveBeenCalled();
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expectNoMemberWrite();
  });
});
