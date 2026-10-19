import type { Response } from 'express';
import { vi } from 'vitest';
import type { AuthRequest } from '../../src/middleware/auth';

export function makeRequest(
  body: Record<string, unknown>,
  user?: AuthRequest['user'],
): AuthRequest {
  return { body, user, params: {}, headers: {} } as AuthRequest;
}

export function makeResponse() {
  const actual: { statusCode: number; payload?: unknown } = { statusCode: 200 };
  const response = {
    status: vi.fn((statusCode: number) => {
      actual.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((payload: unknown) => {
      actual.payload = payload;
      return response;
    }),
    sendStatus: vi.fn((statusCode: number) => {
      actual.statusCode = statusCode;
      return response;
    }),
  };
  return { response: response as unknown as Response, actual, spies: response };
}
