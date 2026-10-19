/**
 * Mục tiêu: kiểm thử tích hợp API kiểm kê kho (GET /api/inventory/expected, POST /api/inventory/verify)
 *   qua HTTP thật: supertest → Express → JWT/authorizeAdmin → inventoryController → Prisma → SQLite tạm.
 * Kỹ thuật: hộp đen mức API + kiểm tra trạng thái lưu trong DB (AuditLog); dữ liệu dựng bằng factory,
 *   bản sao "đang mượn" được dựng bằng phiếu mượn thật.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): INV-01 (kho dự kiến chỉ gồm AVAILABLE), INV-02 (barcode hợp lệ),
 *   INV-03 (quét trùng), INV-04 (thiếu/bất thường).
 * Ranh giới: không kiểm thử xuất Excel/PDF (xử lý ở frontend, DEF-003) và không kiểm thử giao diện quét mã.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../helpers/app';
import { bearer, createBook, createLoan, createUser, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;
let book: Awaited<ReturnType<typeof createBook>>;

const verify = (scannedBarcodes: unknown, as = admin) =>
  request(app).post('/api/inventory/verify').set(bearer(as)).send({ scannedBarcodes });

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN' });
  reader = await createUser({ email: 'reader@it.local' });
  book = await createBook('INV-IT-01', 4); // INV-IT-01-1 … INV-IT-01-4
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Phân quyền kiểm kê', () => {
  test('IT-INV-01 không có token → 401; USER → 403 (cả hai endpoint)', async () => {
    expect((await request(app).get('/api/inventory/expected')).status).toBe(401);
    expect((await request(app).post('/api/inventory/verify').send({ scannedBarcodes: [] })).status).toBe(401);
    expect((await request(app).get('/api/inventory/expected').set(bearer(reader))).status).toBe(403);
    expect((await request(app).post('/api/inventory/verify').set(bearer(reader)).send({ scannedBarcodes: [] })).status).toBe(403);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

describe('GET /api/inventory/expected — kho dự kiến (INV-01)', () => {
  test('IT-INV-02 (INV-01) chỉ liệt kê bản AVAILABLE, sắp theo barcode, kèm tên sách/tác giả/thể loại', async () => {
    const borrowedItem = book.items[1];
    await createLoan(reader.id, borrowedItem.id);
    await prisma.bookItem.update({ where: { id: book.items[3].id }, data: { status: 'LOST' } });
    const res = await request(app).get('/api/inventory/expected').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((i: any) => i.barcode)).toEqual(['INV-IT-01-1', 'INV-IT-01-3']);
    expect(res.body.items[0]).toMatchObject({ bookTitle: 'Sách INV-IT-01', author: 'Nhóm 8', category: 'Kiểm thử', location: 'Kệ IT', status: 'AVAILABLE' });
  });

  test('IT-INV-03 đường dẫn phụ /expected-items trả cùng kết quả', async () => {
    const a = await request(app).get('/api/inventory/expected').set(bearer(admin));
    const b = await request(app).get('/api/inventory/expected-items').set(bearer(admin));
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
  });

  test('IT-INV-04 mượn một bản thì kho dự kiến giảm đúng một bản', async () => {
    expect((await request(app).get('/api/inventory/expected').set(bearer(admin))).body.total).toBe(4);
    await createLoan(reader.id, book.items[0].id);
    expect((await request(app).get('/api/inventory/expected').set(bearer(admin))).body.total).toBe(3);
  });
});

describe('POST /api/inventory/verify — đối chiếu (INV-02, INV-03, INV-04)', () => {
  test('IT-INV-05 (INV-02) quét đủ các bản AVAILABLE → tất cả "hợp lệ", độ chính xác 100.0', async () => {
    const res = await verify(book.items.map((i) => i.barcode));
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ totalExpected: 4, matchedCount: 4, missingCount: 0, anomalousCount: 0, accuracyRate: '100.0' });
  });

  test('IT-INV-06 (INV-04) quét một phần + mã lạ + bản đang mượn → thiếu / bất thường đúng nhóm', async () => {
    await createLoan(reader.id, book.items[3].id); // INV-IT-01-4 BORROWED
    const res = await verify(['INV-IT-01-1', 'INV-IT-01-4', 'MA-LA-999']);
    expect(res.status).toBe(200);
    expect(res.body.matched.map((m: any) => m.barcode)).toEqual(['INV-IT-01-1']);
    expect(res.body.missing.map((m: any) => m.barcode).sort()).toEqual(['INV-IT-01-2', 'INV-IT-01-3']);
    const kinds = Object.fromEntries(res.body.anomalous.map((a: any) => [a.barcode, a.issueType]));
    expect(kinds).toEqual({ 'INV-IT-01-4': 'BORROWED', 'MA-LA-999': 'NOT_FOUND' });
    expect(res.body.summary).toMatchObject({ totalExpected: 3, totalScanned: 3, matchedCount: 1, missingCount: 2, anomalousCount: 2, accuracyRate: '33.3' });
  });

  test('IT-INV-07 (INV-03) quét trùng / khác hoa-thường / có khoảng trắng chỉ tính một lần', async () => {
    const res = await verify(['INV-IT-01-1', 'inv-it-01-1', '  INV-IT-01-1 ', '']);
    expect(res.body.summary).toMatchObject({ totalScanned: 1, matchedCount: 1 });
  });

  test('IT-INV-08 đối chiếu không làm thay đổi trạng thái bất kỳ bản sao nào', async () => {
    const before = await prisma.bookItem.findMany({ orderBy: { id: 'asc' } });
    await verify(['INV-IT-01-1', 'MA-LA']);
    expect(await prisma.bookItem.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });

  test('IT-INV-09 mỗi lần đối chiếu ghi 1 AuditLog INVENTORY_CHECK với adminId và số liệu', async () => {
    await verify(['INV-IT-01-1']);
    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'INVENTORY_CHECK', adminId: admin.id });
    expect(JSON.parse(logs[0].details)).toMatchObject({ totalExpected: 4, totalScanned: 1, matchedCount: 1, missingCount: 3 });
  });

  test.each([
    ['chuỗi', 'INV-IT-01-1'],
    ['số', 5],
    ['null', null],
    ['object', { a: 1 }],
  ])('IT-INV-10 scannedBarcodes dạng %s → 400, không ghi AuditLog', async (_label, value) => {
    const res = await verify(value);
    expect(res.status).toBe(400);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  test('IT-INV-11 không gửi body scannedBarcodes → coi như chưa quét: mọi bản AVAILABLE đều "thiếu"', async () => {
    const res = await request(app).post('/api/inventory/verify').set(bearer(admin)).send({});
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ totalScanned: 0, missingCount: 4, matchedCount: 0, accuracyRate: '0.0' });
  });

  test('IT-INV-12 kho rỗng: đối chiếu không lỗi, độ chính xác mặc định 100.0', async () => {
    await resetDatabase();
    admin = await createUser({ email: 'admin2@it.local', role: 'ADMIN' });
    const res = await verify([]);
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ totalExpected: 0, accuracyRate: '100.0' });
  });
});
