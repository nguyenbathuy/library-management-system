// Tiện ích dùng chung cho unit test controller (Prisma được mock ở từng file test, TRƯỚC khi import controller).
import type { Response } from 'express';
import { expect, vi } from 'vitest';
import type { AuthRequest } from '../../src/middleware/auth';

export type Handler = (req: AuthRequest, res: Response) => Promise<unknown> | unknown;

export interface CallInput {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  user?: AuthRequest['user'];
  method?: string;
  file?: unknown;
}

export interface CallResult {
  statusCode: number;
  payload?: any;
  /** Header đặt qua res.setHeader (dùng cho tải file). */
  headers: Record<string, string>;
  /** Nội dung gửi qua res.send (dùng cho tải file). */
  sent?: unknown;
}

/** Tạo bộ mock cho các delegate Prisma: mỗi hàm là vi.fn() (chưa cấu hình). */
export const delegate = (...names: string[]) =>
  Object.fromEntries(names.map((name) => [name, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>;

/** Gọi một handler Express với req/res giả và trả về mã HTTP + payload JSON đã gửi. */
export async function callHandler(handler: Handler, input: CallInput = {}): Promise<CallResult> {
  const actual: CallResult = { statusCode: 200, headers: {} };
  const res: any = {
    status: vi.fn((code: number) => { actual.statusCode = code; return res; }),
    json: vi.fn((payload: unknown) => { actual.payload = payload; return res; }),
    setHeader: vi.fn((name: string, value: string) => { actual.headers[name] = value; return res; }),
    send: vi.fn((body: unknown) => { actual.sent = body; return res; }),
  };
  const req = {
    body: input.body ?? {},
    params: input.params ?? {},
    query: input.query ?? {},
    method: input.method ?? 'GET',
    user: input.user,
    file: input.file,
    headers: {},
  } as unknown as AuthRequest;
  await handler(req, res as Response);
  expect(res.json.mock.calls.length + res.send.mock.calls.length, 'handler phải trả đúng một phản hồi').toBe(1);
  return actual;
}

/** Đặt lại mọi mock về trạng thái "chưa cấu hình": gọi mà chưa arrange sẽ ném lỗi (phát hiện phụ thuộc ngầm). */
export function resetMocks(mocks: Array<ReturnType<typeof vi.fn>>) {
  for (const fn of mocks) {
    fn.mockReset();
    fn.mockImplementation(() => { throw new Error('Unconfigured mock call: arrange this dependency.'); });
  }
}
