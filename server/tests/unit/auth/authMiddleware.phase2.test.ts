import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../../src/middleware/auth';
import { ACTOR } from '../../fixtures/auth';
import designs from '../../fixtures/phase2-cases.json';
import { makeRequest, makeResponse } from '../../mocks/http';
import { callOffsets, dependencyCalls, snapshot, writeEvidence } from '../../support/phase2Evidence';

const mocks = vi.hoisted(() => ({ jwt: { verify: vi.fn(), sign: vi.fn() }, factoryLoaded: false }));
vi.mock('jsonwebtoken', () => {
  mocks.factoryLoaded = true;
  return { default: mocks.jwt };
});

// Middleware code remains real. It has no database dependency.
import { authenticateToken, authorizeAdmin, optionalAuthenticateToken } from '../../../src/middleware/auth';

type Middleware = (request: AuthRequest, response: Response, next: () => void) => unknown;
type VerifyCallback = (error: Error | null, user?: AuthRequest['user']) => void;
type Observation = { id: string; mockConfiguration: Record<string, unknown>; invocations: Record<string, unknown>[] };
let observation: Observation;
const traces: Record<string, unknown>[] = [];
const methods = { 'jwt.verify': mocks.jwt.verify, 'jwt.sign': mocks.jwt.sign };

async function invoke(name: string, middleware: Middleware, authorization?: string, user?: AuthRequest['user']) {
  const request = makeRequest({}, user);
  request.headers = authorization === undefined ? {} : { authorization };
  const response = makeResponse();
  const next = vi.fn();
  const offsets = callOffsets(methods);
  middleware(request, response.response, next);
  const responseWritten = response.spies.status.mock.calls.length + response.spies.json.mock.calls.length + response.spies.sendStatus.mock.calls.length > 0;
  observation.invocations.push({ function: name, input: { authorization: authorization ?? null, user: user ?? null },
    mockConfiguration: snapshot(observation.mockConfiguration),
    actual: { responseWritten, statusCode: responseWritten ? response.actual.statusCode : null,
      payload: response.actual.payload ?? null, nextCalls: next.mock.calls.length, user: request.user ?? null },
    calls: await dependencyCalls(methods, offsets) });
  return { request, response, next };
}

function validToken(decodedUser: AuthRequest['user']) {
  observation.mockConfiguration.verify = { error: null, decodedUser };
  mocks.jwt.verify.mockImplementation((_token: string, _secret: string, callback: VerifyCallback) => callback(null, decodedUser));
}

beforeAll(() => {
  expect(mocks.factoryLoaded).toBe(true);
  expect(vi.isMockFunction(mocks.jwt.verify)).toBe(true);
  expect(mocks.jwt.verify).not.toHaveBeenCalled();
  writeEvidence('phase2-middleware-isolation-gate.json', {
    observedAt: new Date().toISOString(), jwtFactoryLoaded: mocks.factoryLoaded,
    verifyIsMock: vi.isMockFunction(mocks.jwt.verify),
    databasePolicy: 'Direct middleware import has no Prisma dependency; global fail-closed alias remains enabled.',
  });
});

beforeEach((context) => {
  for (const method of Object.values(methods)) {
    method.mockReset();
    method.mockImplementation(() => { throw new Error('Unconfigured middleware mock call.'); });
  }
  const id = context.task.name.match(/WB-[A-Z]+-\d+/)?.[0];
  expect(designs.some((design) => design.id === id && design.oracle !== 'R')).toBe(true);
  observation = { id: id!, mockConfiguration: { default: 'deny unconfigured JWT calls' }, invocations: [] };
  context.onTestFinished(async (finished) => {
    expect(mocks.jwt.sign).not.toHaveBeenCalled();
    traces.push({ ...snapshot(observation), runnerStateAtFinishedHook: finished.task.result?.state,
      recordedAt: new Date().toISOString(), calls: await dependencyCalls(methods) });
  });
});
afterAll(() => writeEvidence('phase2-middleware-traces.json', traces));

describe('Authentication Phase 2 — authenticateToken', () => {
  test('WB-AT-01 authenticateToken rejects a missing Authorization header', async () => {
    // Arrange / Act
    const result = await invoke('authenticateToken', authenticateToken);
    // Assert
    expect(result.response.spies.sendStatus).toHaveBeenCalledExactlyOnceWith(401);
    expect(result.next).not.toHaveBeenCalled(); expect(mocks.jwt.verify).not.toHaveBeenCalled();
    expect(result.request.user).toBeUndefined();
  });

  test('WB-AT-02 authenticateToken rejects a Bearer header without a token', async () => {
    // Arrange / Act
    const result = await invoke('authenticateToken', authenticateToken, 'Bearer');
    // Assert
    expect(result.response.spies.sendStatus).toHaveBeenCalledExactlyOnceWith(401);
    expect(result.next).not.toHaveBeenCalled(); expect(mocks.jwt.verify).not.toHaveBeenCalled();
  });

  test('WB-AT-03 authenticateToken rejects invalid and expired verifier errors', async () => {
    // Arrange: two fault inputs exercise the same err branch, one Matrix testcase ID.
    for (const errorName of ['JsonWebTokenError', 'TokenExpiredError']) {
      const error = Object.assign(new Error(`Simulated ${errorName}`), { name: errorName });
      observation.mockConfiguration.verify = { error: { name: error.name, message: error.message }, decodedUser: null };
      mocks.jwt.verify.mockImplementation((_token: string, _secret: string, callback: VerifyCallback) => callback(error));
      // Act
      const result = await invoke('authenticateToken', authenticateToken, 'Bearer x');
      // Assert
      expect(result.response.spies.sendStatus).toHaveBeenCalledExactlyOnceWith(403);
      expect(result.next).not.toHaveBeenCalled(); expect(result.request.user).toBeUndefined();
    }
    expect(mocks.jwt.verify).toHaveBeenCalledTimes(2);
    expect(mocks.jwt.verify).toHaveBeenNthCalledWith(1, 'x', 'unit-test-secret-never-used-for-real-tokens', expect.any(Function));
    expect(mocks.jwt.verify).toHaveBeenNthCalledWith(2, 'x', 'unit-test-secret-never-used-for-real-tokens', expect.any(Function));
  });

  test('WB-AT-04 authenticateToken forwards a valid decoded user once', async () => {
    // Arrange: decoded payload has userId/email/role; no OTP flag is fabricated.
    const user = { ...ACTOR }; validToken(user);
    // Act
    const result = await invoke('authenticateToken', authenticateToken, 'Bearer x');
    // Assert
    expect(mocks.jwt.verify).toHaveBeenCalledExactlyOnceWith('x', 'unit-test-secret-never-used-for-real-tokens', expect.any(Function));
    expect(result.request.user).toBe(user); expect(result.next).toHaveBeenCalledExactlyOnceWith();
    expect(result.response.spies.sendStatus).not.toHaveBeenCalled(); expect(result.response.spies.json).not.toHaveBeenCalled();
  });
});

describe('Authentication Phase 2 — authorizeAdmin', () => {
  test('WB-AA-01 authorizeAdmin rejects an anonymous user', async () => {
    // Arrange / Act
    const result = await invoke('authorizeAdmin', authorizeAdmin);
    // Assert
    expect(result.response.actual).toEqual({ statusCode: 403, payload: { message: 'Forbidden' } });
    expect(result.response.spies.status).toHaveBeenCalledExactlyOnceWith(403);
    expect(result.response.spies.json).toHaveBeenCalledExactlyOnceWith({ message: 'Forbidden' });
    expect(result.next).not.toHaveBeenCalled(); expect(mocks.jwt.verify).not.toHaveBeenCalled();
  });

  test('WB-AA-02 authorizeAdmin rejects the USER role', async () => {
    // Arrange / Act
    const result = await invoke('authorizeAdmin', authorizeAdmin, undefined, { ...ACTOR });
    // Assert
    expect(result.response.actual).toEqual({ statusCode: 403, payload: { message: 'Forbidden' } });
    expect(result.response.spies.json).toHaveBeenCalledExactlyOnceWith({ message: 'Forbidden' });
    expect(result.next).not.toHaveBeenCalled();
  });

  test('WB-AA-03 authorizeAdmin allows the ADMIN role', async () => {
    // Arrange / Act
    const result = await invoke('authorizeAdmin', authorizeAdmin, undefined, { ...ACTOR, role: 'ADMIN' });
    // Assert
    expect(result.next).toHaveBeenCalledExactlyOnceWith();
    expect(result.response.spies.status).not.toHaveBeenCalled(); expect(result.response.spies.json).not.toHaveBeenCalled();
  });
});

describe('Authentication Phase 2 — optionalAuthenticateToken', () => {
  test('WB-OA-01 optionalAuthenticateToken allows an anonymous request', async () => {
    // Arrange / Act
    const result = await invoke('optionalAuthenticateToken', optionalAuthenticateToken);
    // Assert
    expect(result.next).toHaveBeenCalledExactlyOnceWith(); expect(mocks.jwt.verify).not.toHaveBeenCalled();
    expect(result.request.user).toBeUndefined(); expect(result.response.spies.sendStatus).not.toHaveBeenCalled();
  });

  test('WB-OA-02 optionalAuthenticateToken continues after an invalid token', async () => {
    // Arrange
    observation.mockConfiguration.verify = { error: { name: 'JsonWebTokenError' }, decodedUser: null };
    mocks.jwt.verify.mockImplementation((_token: string, _secret: string, callback: VerifyCallback) => callback(new Error('Simulated invalid optional token')));
    // Act
    const result = await invoke('optionalAuthenticateToken', optionalAuthenticateToken, 'Bearer x');
    // Assert
    expect(mocks.jwt.verify).toHaveBeenCalledExactlyOnceWith('x', 'unit-test-secret-never-used-for-real-tokens', expect.any(Function));
    expect(result.next).toHaveBeenCalledExactlyOnceWith(); expect(result.request.user).toBeUndefined();
    expect(result.response.spies.sendStatus).not.toHaveBeenCalled(); expect(result.response.spies.json).not.toHaveBeenCalled();
  });

  test('WB-OA-03 optionalAuthenticateToken attaches a valid decoded user', async () => {
    // Arrange
    const user = { ...ACTOR }; validToken(user);
    // Act
    const result = await invoke('optionalAuthenticateToken', optionalAuthenticateToken, 'Bearer x');
    // Assert
    expect(mocks.jwt.verify).toHaveBeenCalledExactlyOnceWith('x', 'unit-test-secret-never-used-for-real-tokens', expect.any(Function));
    expect(result.request.user).toBe(user); expect(result.next).toHaveBeenCalledExactlyOnceWith();
    expect(result.response.spies.status).not.toHaveBeenCalled(); expect(result.response.spies.sendStatus).not.toHaveBeenCalled();
  });
});
