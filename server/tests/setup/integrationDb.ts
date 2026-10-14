// Setup file chạy TRƯỚC mỗi file test tích hợp (trước khi file test import controller/route):
// - cấp một bản sao DB riêng và trỏ mọi PrismaClient của ứng dụng vào đó;
// - thay mailService bằng stub (không SMTP/Ethereal thật);
// - chặn HTTPS/TLS/fetch ra ngoài; supertest chỉ dùng HTTP loopback.
import https from 'node:https';
import tls from 'node:tls';
import { afterAll, beforeAll, expect, inject, vi } from 'vitest';
import { cloneDatabase, removeDatabase, toUrl } from '../helpers/testDb';

const dbFile = cloneDatabase(inject('templateDb'), `it-${process.pid}-${Date.now()}`);
process.env.LMS_TEST_DATABASE_FILE = dbFile;
process.env.LMS_TEST_DATABASE_URL = toUrl(dbFile);

vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  class IsolatedPrismaClient extends actual.PrismaClient {
    constructor(options: Record<string, unknown> = {}) {
      const url = process.env.LMS_TEST_DATABASE_URL;
      if (!url) throw new Error('LMS_TEST_DATABASE_URL missing: refusing to fall back to prisma/dev.db');
      super({ ...options, datasourceUrl: url });
    }
  }
  return { ...actual, PrismaClient: IsolatedPrismaClient };
});

export const mailCalls: Array<{ fn: string; args: unknown }> = [];
vi.mock('../../src/services/mailService', () => {
  const stub = (fn: string) => async (args: { to: string; subject?: string }) => {
    mailCalls.push({ fn, args });
    return { success: true, to: args.to, subject: fn };
  };
  return {
    getTransporter: async () => { throw new Error('Real mail transport is forbidden in integration tests'); },
    sendDueSoonReminderEmail: stub('sendDueSoonReminderEmail'),
    sendOverdueReminderEmail: stub('sendOverdueReminderEmail'),
    sendPasswordResetOtpEmail: stub('sendPasswordResetOtpEmail'),
    sendLoginOtpEmail: stub('sendLoginOtpEmail'),
  };
});

const deny = (): never => { throw new Error('Outbound HTTPS/TLS/fetch is forbidden in integration tests.'); };
const guards = [
  vi.spyOn(globalThis, 'fetch').mockImplementation(deny),
  vi.spyOn(https, 'request').mockImplementation(deny),
  vi.spyOn(https, 'get').mockImplementation(deny),
  vi.spyOn(tls, 'connect').mockImplementation(deny),
];

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterAll(async () => {
  for (const guard of guards) expect(guard).not.toHaveBeenCalled();
  removeDatabase(dbFile);
});
