/**
 * Mục tiêu: kiểm thử đơn vị inventoryController (kiểm kê kho): getExpectedInventory và verifyInventory.
 * Kỹ thuật: hộp trắng (phủ câu lệnh/nhánh) kết hợp phân vùng tương đương cho trạng thái BookItem
 *   (AVAILABLE / Available / BORROWED / LOST / DAMAGED / khác) và loại bỏ trùng mã quét.
 *   Prisma được mock TRƯỚC khi import controller (vi.hoisted + vi.mock, alias prismaGuard chặn Prisma thật).
 * Ranh giới: chỉ chứng minh controller → lời gọi Prisma và định dạng phản hồi; KHÔNG chứng minh truy vấn SQLite
 *   thật (xem tests/integration/inventory.api.test.ts) và KHÔNG kiểm thử xuất Excel/PDF (nằm ở frontend, DEF-003).
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): INV-01 (kho dự kiến), INV-02 (barcode hợp lệ), INV-03 (quét trùng),
 *   INV-04 (thiếu/bất thường).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { callHandler, resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    bookItem: d('findMany'),
    auditLog: d('create'),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { prisma, PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }) };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));

import { PrismaClient } from '@prisma/client';
import { getExpectedInventory, verifyInventory } from '../../../src/controllers/inventoryController';

const ADMIN = { userId: 7, email: 'admin@test.local', role: 'ADMIN' };

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    barcode: 'BC-001',
    location: 'Kệ A',
    status: 'AVAILABLE',
    bookId: 10,
    book: {
      id: 10, title: 'Sách A', isbn: '111', coverImage: 'a.png',
      author: { name: 'Tác giả A' }, category: { name: 'Văn học' },
    },
    ...overrides,
  };
}

beforeAll(() => {
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  resetMocks([mocks.prisma.bookItem.findMany, mocks.prisma.auditLog.create, mocks.prisma.$connect, mocks.prisma.$disconnect]);
  mocks.prisma.auditLog.create.mockResolvedValue({ id: 1 });
});

afterAll(() => {
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

describe('getExpectedInventory — kho dự kiến (INV-01)', () => {
  test('UT-INV-01 chỉ truy vấn bản sao AVAILABLE/Available, sắp theo barcode, trả total + items đã định dạng', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item(), item({ id: 2, barcode: 'BC-002' })]);
    const res = await callHandler(getExpectedInventory, { user: ADMIN });

    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.bookItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['AVAILABLE', 'Available'] } },
      orderBy: { barcode: 'asc' },
    }));
    expect(res.payload.total).toBe(2);
    expect(res.payload.items[0]).toEqual({
      id: 1, barcode: 'BC-001', location: 'Kệ A', status: 'AVAILABLE', bookId: 10,
      bookTitle: 'Sách A', isbn: '111', author: 'Tác giả A', category: 'Văn học', coverImage: 'a.png',
    });
  });

  test('UT-INV-02 thiếu vị trí / sách / tác giả → giá trị mặc định (Khu A - Kệ 1, Chưa có tiêu đề, chuỗi rỗng)', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item({ location: null, book: null })]);
    const res = await callHandler(getExpectedInventory, { user: ADMIN });
    expect(res.payload.items[0]).toMatchObject({
      location: 'Khu A - Kệ 1', bookTitle: 'Chưa có tiêu đề', isbn: '', author: '', category: '',
    });
    expect(res.payload.items[0].coverImage).toBeUndefined();
  });

  test('UT-INV-03 kho trống → total 0, items rỗng', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([]);
    const res = await callHandler(getExpectedInventory, { user: ADMIN });
    expect(res.payload).toEqual({ total: 0, items: [] });
  });

  test.each([
    ['UT-INV-04a lỗi có message → trả đúng message', new Error('DB down'), 'DB down'],
    ['UT-INV-04b lỗi không có message → thông điệp mặc định', {}, 'Không thể lấy danh sách kho dự kiến'],
  ])('%s (HTTP 500)', async (_id, failure, message) => {
    mocks.prisma.bookItem.findMany.mockRejectedValue(failure);
    const res = await callHandler(getExpectedInventory, { user: ADMIN });
    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ error: message });
  });
});

describe('verifyInventory — đầu vào', () => {
  test.each([
    ['UT-INV-05a chuỗi', 'BC-001'],
    ['UT-INV-05b số', 123],
    ['UT-INV-05c null', null],
    ['UT-INV-05d object', { a: 1 }],
  ])('%s: scannedBarcodes không phải mảng → 400, không truy vấn DB', async (_id, scannedBarcodes) => {
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes }, user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('mảng');
    expect(mocks.prisma.bookItem.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test('UT-INV-06 không gửi scannedBarcodes (mặc định []) → mọi bản AVAILABLE là "thiếu", độ chính xác 0.0', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item(), item({ id: 2, barcode: 'BC-002' })]);
    const res = await callHandler(verifyInventory, { body: {}, user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(res.payload.summary).toMatchObject({ totalExpected: 2, totalScanned: 0, matchedCount: 0, missingCount: 2, anomalousCount: 0, accuracyRate: '0.0' });
    expect(res.payload.missing.map((m: any) => m.barcode)).toEqual(['BC-001', 'BC-002']);
  });
});

describe('verifyInventory — phân loại đối chiếu (INV-02, INV-03, INV-04)', () => {
  test('UT-INV-07 (INV-02) barcode AVAILABLE được quét → nhóm "hợp lệ", không thiếu, độ chính xác 100.0', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item()]);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001'] }, user: ADMIN });
    expect(res.payload.matched).toHaveLength(1);
    expect(res.payload.matched[0]).toMatchObject({ barcode: 'BC-001', bookTitle: 'Sách A', author: 'Tác giả A', category: 'Văn học' });
    expect(res.payload.missing).toEqual([]);
    expect(res.payload.anomalous).toEqual([]);
    expect(res.payload.summary.accuracyRate).toBe('100.0');
  });

  test('UT-INV-08 (INV-03) quét trùng + khác hoa/thường + khoảng trắng + chuỗi rỗng/null → chỉ tính một lần', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item()]);
    const res = await callHandler(verifyInventory, {
      body: { scannedBarcodes: ['BC-001', 'bc-001', '  BC-001  ', '', '   ', null, undefined] },
      user: ADMIN,
    });
    expect(res.payload.summary).toMatchObject({ totalScanned: 1, matchedCount: 1, missingCount: 0 });
    expect(res.payload.matched).toHaveLength(1);
  });

  test('UT-INV-09 (INV-04) mã lạ không có trong DB → nhóm "bất thường" NOT_FOUND', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item()]);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001', 'XYZ-999'] }, user: ADMIN });
    expect(res.payload.anomalous).toHaveLength(1);
    expect(res.payload.anomalous[0]).toMatchObject({
      barcode: 'XYZ-999', issueType: 'NOT_FOUND', dbStatus: 'KHÔNG TỒN TẠI', bookTitle: 'Không xác định', location: 'Chưa xếp kệ',
    });
    expect(res.payload.summary.anomalousCount).toBe(1);
  });

  test('UT-INV-10 (INV-04) chỉ quét một phần → bản chưa quét vào "thiếu", độ chính xác = hợp lệ / dự kiến', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([
      item({ id: 1, barcode: 'BC-001' }), item({ id: 2, barcode: 'BC-002' }), item({ id: 3, barcode: 'BC-003' }),
    ]);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001'] }, user: ADMIN });
    expect(res.payload.missing.map((m: any) => m.barcode)).toEqual(['BC-002', 'BC-003']);
    expect(res.payload.summary).toMatchObject({ totalExpected: 3, matchedCount: 1, missingCount: 2, accuracyRate: '33.3' });
  });

  test.each([
    ['UT-INV-11a', 'BORROWED', 'BORROWED'],
    ['UT-INV-11b', 'LOST', 'LOST'],
    ['UT-INV-11c', 'DAMAGED', 'DAMAGED'],
  ])('%s trạng thái DB %s nhưng xuất hiện trên kệ → bất thường, lý do nêu rõ trạng thái', async (_id, status, expected) => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item({ status })]);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001'] }, user: ADMIN });
    expect(res.payload.anomalous[0]).toMatchObject({ barcode: 'BC-001', issueType: expected, dbStatus: expected });
    expect(res.payload.anomalous[0].reason).toContain(expected);
    expect(res.payload.matched).toEqual([]);
    // Bản không AVAILABLE không bao giờ bị tính là "thiếu".
    expect(res.payload.missing).toEqual([]);
    expect(res.payload.summary.totalExpected).toBe(0);
  });

  test('UT-INV-12 trạng thái lạ (ví dụ RESERVED) → bất thường với lý do mặc định', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item({ status: 'RESERVED' })]);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001'] }, user: ADMIN });
    expect(res.payload.anomalous[0]).toMatchObject({ issueType: 'RESERVED', reason: 'Trạng thái bất thường' });
  });

  test('UT-INV-13 trạng thái "Available" (viết thường chữ sau) được coi như AVAILABLE cho cả hợp lệ lẫn thiếu', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item({ id: 1, barcode: 'BC-001', status: 'Available' }), item({ id: 2, barcode: 'BC-002', status: 'Available' })]);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001'] }, user: ADMIN });
    expect(res.payload.matched.map((m: any) => m.barcode)).toEqual(['BC-001']);
    expect(res.payload.missing.map((m: any) => m.barcode)).toEqual(['BC-002']);
  });

  test('UT-INV-14 DB rỗng và không quét gì → độ chính xác mặc định 100.0 (tránh chia cho 0)', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([]);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: [] }, user: ADMIN });
    expect(res.payload.summary).toMatchObject({ totalExpected: 0, totalScanned: 0, accuracyRate: '100.0' });
  });

  test('UT-INV-15 bản sao thiếu thông tin sách/vị trí → dùng giá trị mặc định ở cả nhóm thiếu và bất thường', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([
      item({ id: 1, barcode: 'BC-001', location: null, book: null }),
      item({ id: 2, barcode: 'BC-002', status: 'LOST', location: null, book: null }),
    ]);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-002'] }, user: ADMIN });
    expect(res.payload.missing[0]).toMatchObject({ bookTitle: 'Chưa có tiêu đề', author: '', category: '', location: 'Khu A - Kệ 1' });
    expect(res.payload.anomalous[0]).toMatchObject({ bookTitle: 'Chưa có tiêu đề', location: 'Khu A - Kệ 1' });
  });
});

describe('verifyInventory — AuditLog và lỗi hệ thống', () => {
  test('UT-INV-16 ghi AuditLog INVENTORY_CHECK với adminId của người gọi và số liệu tổng hợp', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item(), item({ id: 2, barcode: 'BC-002' })]);
    await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001', 'LẠ-1'] }, user: ADMIN });
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const data = mocks.prisma.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ action: 'INVENTORY_CHECK', adminId: 7 });
    expect(JSON.parse(data.details)).toMatchObject({
      totalExpected: 2, totalScanned: 2, matchedCount: 1, missingCount: 1, anomalousCount: 1, accuracyRate: '50.0%',
    });
  });

  test('UT-INV-17 không có req.user → adminId dự phòng = 1', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([]);
    await callHandler(verifyInventory, { body: { scannedBarcodes: [] } });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.adminId).toBe(1);
  });

  test('UT-INV-18 ghi AuditLog lỗi vẫn không làm hỏng kết quả đối chiếu (HTTP 200)', async () => {
    mocks.prisma.bookItem.findMany.mockResolvedValue([item()]);
    mocks.prisma.auditLog.create.mockRejectedValue(new Error('audit down'));
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001'] }, user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(res.payload.summary.matchedCount).toBe(1);
  });

  test.each([
    ['UT-INV-19a', new Error('boom'), 'boom'],
    ['UT-INV-19b', {}, 'Lỗi khi đối chiếu kiểm kê kho sách'],
  ])('%s truy vấn BookItem lỗi → HTTP 500', async (_id, failure, message) => {
    mocks.prisma.bookItem.findMany.mockRejectedValue(failure);
    const res = await callHandler(verifyInventory, { body: { scannedBarcodes: ['BC-001'] }, user: ADMIN });
    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ error: message });
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
