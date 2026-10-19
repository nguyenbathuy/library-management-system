/**
 * Mục tiêu: kiểm thử đơn vị bookController: danh sách sách, thêm sách (tạo mới / tự gộp kho), sửa, xóa, nhập Excel,
 *   tải file mẫu, tải e-book (handler) và gợi ý sách.
 * Kỹ thuật: hộp trắng phủ nhánh + phân vùng tương đương (trường bắt buộc, số lượng bản sao, loại dòng Excel) +
 *   phân tích giá trị biên (copies 0/1/âm, limit 10 gợi ý, ngưỡng 6 ứng viên). Prisma được mock TRƯỚC khi import controller;
 *   file Excel được dựng bằng thư viện xlsx thật trong bộ nhớ (không ghi đĩa).
 * Ranh giới: chỉ chứng minh controller → lời gọi Prisma; KHÔNG chứng minh ghi SQLite, ràng buộc UNIQUE, hay middleware
 *   multer (xem tests/integration/book.api.test.ts). Không kiểm thử giao diện (gợi ý theo người dùng, form thêm sách).
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): BOOK-03 (gợi ý), BOOK-04 (thêm 2 bản, 2 barcode khác nhau), BOOK-05 (dữ liệu thiếu/
 *   không hợp lệ), BOOK-06 (thêm lại cùng ISBN → cộng bản sao), BOOK-07 (sửa, tăng số bản), BOOK-08 (e-book),
 *   BOOK-10 (xóa), EXCEL-01..03 (mẫu, nhập hợp lệ, dòng lỗi/trùng ISBN).
 * test.fails: NEW FINDING FIND-08 (copies = 0 bị đổi thành 1 thay vì báo lỗi, trái BOOK-05),
 *   FIND-09 (sửa sách với ISBN dạng số khi tăng bản sao → HTTP 500).
 */
import * as XLSX from 'xlsx';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { callHandler, resetMocks } from '../../helpers/unitHarness';

const mocks = vi.hoisted(() => {
  const d = (...names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const prisma = {
    book: d('findMany', 'findUnique', 'findFirst', 'create', 'update', 'delete'),
    category: d('upsert'),
    author: d('upsert'),
    publisher: d('upsert'),
    bookItem: d('findUnique', 'create', 'count', 'findMany', 'deleteMany'),
    loan: d('findMany', 'deleteMany'),
    reservation: d('deleteMany'),
    auditLog: d('create'),
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { prisma, PrismaClient: vi.fn(function UnitPrismaClient() { return prisma; }) };
});

vi.mock('@prisma/client', () => ({ PrismaClient: mocks.PrismaClient }));

import { PrismaClient } from '@prisma/client';
import {
  createBook, deleteBook, downloadImportTemplate, getBookRecommendations, getBooks, importBooks, updateBook,
  uploadEbookHandler,
} from '../../../src/controllers/bookController';

const ADMIN = { userId: 1, email: 'admin@test.local', role: 'ADMIN' };
const READER = { userId: 2, email: 'reader@test.local', role: 'USER' };

const fullBook = (overrides: Record<string, unknown> = {}) => ({
  id: 100, title: 'Sách mới', isbn: '978-604-1-19820-3', publishedYear: '2022', pageCount: 120, language: 'Tiếng Việt',
  description: 'Mô tả', coverImage: 'c.png', ebookUrl: null, authorId: 5, categoryId: 6, publisherId: 7,
  author: { name: 'Tác giả' }, category: { name: 'Thể loại' }, publisher: { name: 'NXB' },
  items: [
    { id: 1, barcode: 'BC-198203-001', location: 'Khu A - Kệ 1', status: 'AVAILABLE' },
    { id: 2, barcode: 'BC-198203-002', location: 'Khu A - Kệ 1', status: 'BORROWED' },
  ],
  ...overrides,
});

const validBody = (overrides: Record<string, unknown> = {}) => ({
  title: '  Bong bóng lên trời ', author: ' Nguyễn Nhật Ánh ', isbn: ' 978-604-1-19820-3 ', category: ' Truyện ngắn ', copies: 2,
  ...overrides,
});

function xlsxBuffer(rows: Array<Record<string, unknown>>): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}
const uploaded = (rows: Array<Record<string, unknown>>, originalname = 'nhap.xlsx') => ({ buffer: xlsxBuffer(rows), originalname });

const allMocks = () => [
  ...Object.values(mocks.prisma.book), mocks.prisma.category.upsert, mocks.prisma.author.upsert, mocks.prisma.publisher.upsert,
  ...Object.values(mocks.prisma.bookItem), ...Object.values(mocks.prisma.loan), mocks.prisma.reservation.deleteMany,
  mocks.prisma.auditLog.create, mocks.prisma.$transaction, mocks.prisma.$connect, mocks.prisma.$disconnect,
];

beforeAll(() => {
  expect(PrismaClient).toBe(mocks.PrismaClient);
  expect(mocks.PrismaClient).toHaveBeenCalledTimes(1);
  expect(mocks.PrismaClient.mock.results[0].value).toBe(mocks.prisma);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  resetMocks(allMocks());
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(mocks.prisma));
  mocks.prisma.category.upsert.mockResolvedValue({ id: 6 });
  mocks.prisma.author.upsert.mockResolvedValue({ id: 5 });
  mocks.prisma.publisher.upsert.mockResolvedValue({ id: 7 });
  mocks.prisma.bookItem.findUnique.mockResolvedValue(null);
  mocks.prisma.bookItem.create.mockResolvedValue({ id: 1 });
});

afterAll(() => {
  expect(mocks.prisma.$connect).not.toHaveBeenCalled();
  expect(mocks.prisma.$disconnect).not.toHaveBeenCalled();
});

const barcodes = () => mocks.prisma.bookItem.create.mock.calls.map(([arg]) => arg.data.barcode);

// ================================================================ getBooks
describe('getBooks — định dạng phản hồi (BOOK-01, BOOK-02)', () => {
  test('UT-BOOK-01 tính copies/available (không phân biệt hoa thường), status, tác giả/thể loại/NXB, danh sách bản sao', async () => {
    mocks.prisma.book.findMany.mockResolvedValue([
      fullBook({ items: [{ id: 1, barcode: 'A', location: 'K', status: 'available' }, { id: 2, barcode: 'B', location: 'K', status: 'BORROWED' }] }),
    ]);
    const res = await callHandler(getBooks);
    expect(res.statusCode).toBe(200);
    expect(res.payload[0]).toMatchObject({
      id: 100, title: 'Sách mới', author: 'Tác giả', category: 'Thể loại', publisher: 'NXB', copies: 2, available: 1, status: 'Available', ebookUrl: null,
    });
    expect(res.payload[0].items).toEqual([
      { id: 1, barcode: 'A', location: 'K', status: 'available' }, { id: 2, barcode: 'B', location: 'K', status: 'BORROWED' },
    ]);
    expect(mocks.prisma.book.findMany.mock.calls[0][0].orderBy).toEqual({ id: 'asc' });
  });

  test('UT-BOOK-02 mọi bản đang mượn → available 0, status "Borrowed"; sách không có bản sao → copies 0', async () => {
    mocks.prisma.book.findMany.mockResolvedValue([
      fullBook({ id: 1, items: [{ id: 1, barcode: 'A', status: 'BORROWED' }] }),
      fullBook({ id: 2, items: undefined, author: null, category: null, publisher: null }),
    ]);
    const res = await callHandler(getBooks);
    expect(res.payload[0]).toMatchObject({ available: 0, status: 'Borrowed' });
    expect(res.payload[1]).toMatchObject({ copies: 0, available: 0, status: 'Borrowed', author: '', category: '', publisher: '', items: [] });
  });

  test('UT-BOOK-03 danh sách rỗng → []; lỗi DB → 500', async () => {
    mocks.prisma.book.findMany.mockResolvedValueOnce([]);
    expect((await callHandler(getBooks)).payload).toEqual([]);
    mocks.prisma.book.findMany.mockRejectedValueOnce(new Error('db'));
    expect((await callHandler(getBooks)).statusCode).toBe(500);
  });
});

// ================================================================ createBook
describe('createBook — POST /books (BOOK-04, BOOK-05, BOOK-06)', () => {
  function arrangeNew() {
    mocks.prisma.book.findFirst.mockResolvedValue(null);
    mocks.prisma.book.create.mockResolvedValue({ id: 100 });
    mocks.prisma.book.findUnique.mockResolvedValue(fullBook());
  }

  test('UT-BOOK-04 USER → 403, không ghi', async () => {
    const res = await callHandler(createBook, { body: validBody(), user: READER });
    expect(res.statusCode).toBe(403);
    expect(mocks.prisma.category.upsert).not.toHaveBeenCalled();
  });

  test.each([
    ['UT-BOOK-05a thiếu title', { title: '' }],
    ['UT-BOOK-05b thiếu author', { author: undefined }],
    ['UT-BOOK-05c thiếu isbn', { isbn: '' }],
    ['UT-BOOK-05d thiếu category', { category: null }],
  ])('%s (BOOK-05) → 400, không tạo sách', async (_id, patch) => {
    const res = await callHandler(createBook, { body: validBody(patch), user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('Thiếu thông tin bắt buộc');
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.book.create).not.toHaveBeenCalled();
  });

  test.each([
    ['UT-BOOK-06a copies âm (-1)', { copies: -1 }, 'Số lượng sách'],
    ['UT-BOOK-06b available âm', { available: -1 }, 'available phải >= 0'],
    ['UT-BOOK-06c available > copies', { copies: 2, available: 3 }, 'không thể lớn hơn'],
  ])('%s (BOOK-05) → 400, không tạo sách', async (_id, patch, message) => {
    const res = await callHandler(createBook, { body: validBody(patch), user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain(message);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  // NEW FINDING FIND-08 — BOOK-05: "nhập số lượng dưới 1 → không tạo sách và hiện lỗi". copies = 0 bị `Number(0) || 1`
  // đổi thành 1 và sách vẫn được tạo.
  test.fails('UT-BOOK-07 (BOOK-05, FIND-08) copies = 0 phải bị từ chối 400 và không tạo sách', async () => {
    arrangeNew();
    const res = await callHandler(createBook, { body: validBody({ copies: 0 }), user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.book.create).not.toHaveBeenCalled();
  });

  test('UT-BOOK-08 (BOOK-04) sách mới 2 bản → 201, 1 đầu sách + 2 bản sao AVAILABLE, barcode khác nhau, giá trị đã trim', async () => {
    arrangeNew();
    const res = await callHandler(createBook, { body: validBody(), user: ADMIN });
    expect(res.statusCode).toBe(201);
    expect(res.payload).toMatchObject({ isMerged: false, id: 100 });
    expect(res.payload.message).toContain('2 bản sao');
    expect(mocks.prisma.book.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.book.create.mock.calls[0][0].data).toMatchObject({
      title: 'Bong bóng lên trời', isbn: '978-604-1-19820-3', categoryId: 6, authorId: 5, publisherId: null, language: 'Tiếng Việt',
    });
    expect(mocks.prisma.category.upsert.mock.calls[0][0].where).toEqual({ name: 'Truyện ngắn' });
    expect(mocks.prisma.author.upsert.mock.calls[0][0].where).toEqual({ name: 'Nguyễn Nhật Ánh' });
    expect(barcodes()).toEqual(['BC-198203-001', 'BC-198203-002']);
    expect(new Set(barcodes()).size).toBe(2);
    for (const [arg] of mocks.prisma.bookItem.create.mock.calls) {
      expect(arg.data).toMatchObject({ bookId: 100, status: 'AVAILABLE', location: 'Khu A - Kệ 1' });
    }
    expect(mocks.prisma.publisher.upsert).not.toHaveBeenCalled();
  });

  test('UT-BOOK-09 trường tùy chọn được ánh xạ: NXB, năm, số trang, ngôn ngữ, mô tả, ảnh bìa, e-book', async () => {
    arrangeNew();
    await callHandler(createBook, {
      body: validBody({ copies: 1, publisher: ' NXB Kim Đồng ', publishedYear: 2022, pageCount: '120', language: 'Tiếng Anh', description: 'Mô tả', coverImage: 'x.png', ebookUrl: ' /uploads/ebooks/a.pdf ' }),
      user: ADMIN,
    });
    expect(mocks.prisma.publisher.upsert.mock.calls[0][0].where).toEqual({ name: 'NXB Kim Đồng' });
    expect(mocks.prisma.book.create.mock.calls[0][0].data).toMatchObject({
      publisherId: 7, publishedYear: '2022', pageCount: 120, language: 'Tiếng Anh', description: 'Mô tả', coverImage: 'x.png', ebookUrl: '/uploads/ebooks/a.pdf',
    });
  });

  test('UT-BOOK-10 copies không phải số / chuỗi số được xử lý: "abc" → 1 bản; "3" → 3 bản', async () => {
    arrangeNew();
    await callHandler(createBook, { body: validBody({ copies: 'abc' }), user: ADMIN });
    expect(barcodes()).toHaveLength(1);
    mocks.prisma.bookItem.create.mockClear();
    await callHandler(createBook, { body: validBody({ copies: '3' }), user: ADMIN });
    expect(barcodes()).toHaveLength(3);
  });

  test('UT-BOOK-11 available được kiểm tra hợp lệ nhưng mọi bản sao mới đều AVAILABLE (ghi nhận hành vi hiện tại)', async () => {
    arrangeNew();
    await callHandler(createBook, { body: validBody({ copies: 3, available: 1 }), user: ADMIN });
    expect(mocks.prisma.bookItem.create.mock.calls.map(([arg]) => arg.data.status)).toEqual(['AVAILABLE', 'AVAILABLE', 'AVAILABLE']);
  });

  test('UT-BOOK-12 barcode đã tồn tại trong DB → bỏ qua số đó, dùng số kế tiếp (không bao giờ trùng)', async () => {
    arrangeNew();
    mocks.prisma.bookItem.findUnique.mockImplementation(async ({ where }: any) => (where.barcode === 'BC-198203-001' ? { id: 9 } : null));
    await callHandler(createBook, { body: validBody({ copies: 2 }), user: ADMIN });
    expect(barcodes()).toEqual(['BC-198203-002', 'BC-198203-003']);
  });

  test('UT-BOOK-13 ISBN không có chữ số → tiền tố barcode dự phòng "BOOK"', async () => {
    arrangeNew();
    await callHandler(createBook, { body: validBody({ isbn: 'ABC', copies: 1 }), user: ADMIN });
    expect(barcodes()).toEqual(['BC-BOOK-001']);
  });

  test('UT-BOOK-14 (BOOK-06) thêm lại cùng ISBN → 200 isMerged, cộng bản sao nối tiếp, KHÔNG tạo đầu sách thứ hai', async () => {
    mocks.prisma.book.findFirst.mockResolvedValue(fullBook({ isbn: '978-604-1-19820-3' }));
    mocks.prisma.book.findUnique.mockResolvedValue(fullBook({ items: new Array(4).fill({ id: 1, barcode: 'x', status: 'AVAILABLE' }) }));
    const res = await callHandler(createBook, { body: validBody({ copies: 2 }), user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(res.payload.isMerged).toBe(true);
    expect(res.payload.message).toContain('cộng gộp thêm 2 bản sao');
    expect(mocks.prisma.book.create).not.toHaveBeenCalled();
    // sách cũ đang có 2 bản (fullBook mặc định) → bản mới bắt đầu từ số 3
    expect(barcodes()).toEqual(['BC-198203-003', 'BC-198203-004']);
    expect(mocks.prisma.book.findFirst.mock.calls[0][0].where.OR).toEqual([
      { isbn: '978-604-1-19820-3' }, { title: 'Bong bóng lên trời', authorId: 5 },
    ]);
  });

  test('UT-BOOK-15 gộp kho: barcode trùng thì nhảy số kế tiếp', async () => {
    mocks.prisma.book.findFirst.mockResolvedValue(fullBook());
    mocks.prisma.book.findUnique.mockResolvedValue(fullBook());
    mocks.prisma.bookItem.findUnique.mockImplementation(async ({ where }: any) => (where.barcode === 'BC-198203-003' ? { id: 9 } : null));
    await callHandler(createBook, { body: validBody({ copies: 1 }), user: ADMIN });
    expect(barcodes()).toEqual(['BC-198203-004']);
  });

  test('UT-BOOK-16 ISBN có sẵn trong DB không phải chữ số → tiền tố dự phòng "BOOK" khi gộp kho', async () => {
    mocks.prisma.book.findFirst.mockResolvedValue(fullBook({ isbn: 'ISBN-X', items: [] }));
    mocks.prisma.book.findUnique.mockResolvedValue(fullBook());
    await callHandler(createBook, { body: validBody({ copies: 1 }), user: ADMIN });
    expect(barcodes()).toEqual(['BC-BOOK-001']);
  });

  test.each([
    ['UT-BOOK-17a lỗi Prisma P2002 → 400 "ISBN đã tồn tại"', { code: 'P2002' }, 400, 'ISBN đã tồn tại'],
    ['UT-BOOK-17b lỗi khác → 500', new Error('db'), 500, 'Không thể tạo sách mới'],
  ])('%s', async (_id, failure, status, message) => {
    mocks.prisma.category.upsert.mockRejectedValue(failure);
    const res = await callHandler(createBook, { body: validBody(), user: ADMIN });
    expect(res.statusCode).toBe(status);
    expect(res.payload.error).toBe(message);
  });
});

// ================================================================ updateBook
describe('updateBook — PUT /books/:id (BOOK-07)', () => {
  const arrangeExisting = (book = fullBook()) => {
    mocks.prisma.book.findUnique.mockResolvedValue(book);
    mocks.prisma.book.update.mockResolvedValue(book);
  };

  test('UT-BOOK-18 USER → 403; id không phải số → 400; không tìm thấy → 404', async () => {
    expect((await callHandler(updateBook, { params: { id: '100' }, body: {}, user: READER })).statusCode).toBe(403);
    expect((await callHandler(updateBook, { params: { id: 'abc' }, body: {}, user: ADMIN })).statusCode).toBe(400);
    mocks.prisma.book.findUnique.mockResolvedValue(null);
    expect((await callHandler(updateBook, { params: { id: '100' }, body: {}, user: ADMIN })).statusCode).toBe(404);
    expect(mocks.prisma.book.update).not.toHaveBeenCalled();
  });

  test('UT-BOOK-19 (BOOK-07) đổi tên + mô tả: chỉ các trường được gửi mới vào dữ liệu cập nhật', async () => {
    arrangeExisting();
    const res = await callHandler(updateBook, { params: { id: '100' }, body: { title: '  Tên mới ', description: 'Mô tả mới' }, user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.book.update.mock.calls[0][0]).toEqual({ where: { id: 100 }, data: { title: 'Tên mới', description: 'Mô tả mới' } });
    expect(mocks.prisma.bookItem.create).not.toHaveBeenCalled();
  });

  test('UT-BOOK-20 các trường rỗng/falsy được chuẩn hóa: năm/số trang/ngôn ngữ/e-book → null; NXB rỗng → publisherId null', async () => {
    arrangeExisting();
    await callHandler(updateBook, {
      params: { id: '100' }, user: ADMIN,
      body: { isbn: ' 123 ', publishedYear: '', pageCount: 0, language: '', ebookUrl: '', coverImage: 'n.png', publisher: '' },
    });
    expect(mocks.prisma.book.update.mock.calls[0][0].data).toEqual({
      isbn: '123', publishedYear: null, pageCount: null, language: null, ebookUrl: null, coverImage: 'n.png', publisherId: null,
    });
  });

  test('UT-BOOK-21 các trường có giá trị được ép kiểu; category/author/publisher được upsert và gán id', async () => {
    arrangeExisting();
    await callHandler(updateBook, {
      params: { id: '100' }, user: ADMIN,
      body: { publishedYear: 2023, pageCount: '200', language: 'Tiếng Anh', ebookUrl: ' /e.pdf ', category: ' Mới ', author: ' Ai đó ', publisher: ' NXB Mới ' },
    });
    expect(mocks.prisma.book.update.mock.calls[0][0].data).toEqual({
      publishedYear: '2023', pageCount: 200, language: 'Tiếng Anh', ebookUrl: '/e.pdf', categoryId: 6, authorId: 5, publisherId: 7,
    });
    expect(mocks.prisma.category.upsert.mock.calls[0][0].where).toEqual({ name: 'Mới' });
    expect(mocks.prisma.author.upsert.mock.calls[0][0].where).toEqual({ name: 'Ai đó' });
    expect(mocks.prisma.publisher.upsert.mock.calls[0][0].where).toEqual({ name: 'NXB Mới' });
  });

  test('UT-BOOK-22 (BOOK-07) tăng số lượng 2 → 3: tạo đúng 1 bản mới (barcode -003), bản cũ không bị chạm', async () => {
    arrangeExisting();
    await callHandler(updateBook, { params: { id: '100' }, body: { copies: 3 }, user: ADMIN });
    expect(barcodes()).toEqual(['BC-198203-003']);
    expect(mocks.prisma.bookItem.create.mock.calls[0][0].data).toMatchObject({ bookId: 100, status: 'AVAILABLE' });
  });

  test('UT-BOOK-23 tăng số lượng kèm ISBN mới (chuỗi) → barcode dùng ISBN mới', async () => {
    arrangeExisting();
    await callHandler(updateBook, { params: { id: '100' }, body: { isbn: '111-222-333-444', copies: 3 }, user: ADMIN });
    expect(barcodes()).toEqual(['BC-333444-003']);
  });

  test.each([
    ['UT-BOOK-24a copies bằng số hiện có', 2],
    ['UT-BOOK-24b copies nhỏ hơn số hiện có (giảm không được hỗ trợ — ghi nhận hành vi hiện tại)', 1],
    ['UT-BOOK-24c copies = 0', 0],
    ['UT-BOOK-24d copies âm', -3],
    ['UT-BOOK-24e copies không phải số', 'abc'],
  ])('%s → không tạo/xóa bản sao', async (_id, copies) => {
    arrangeExisting();
    const res = await callHandler(updateBook, { params: { id: '100' }, body: { copies }, user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.bookItem.create).not.toHaveBeenCalled();
  });

  // NEW FINDING FIND-09 — ISBN gửi dạng số: `(isbn || existingBook.isbn).replace` ném TypeError → HTTP 500.
  test.fails('UT-BOOK-25 (FIND-09) sửa với ISBN dạng số và tăng bản sao phải thành công (200), không ném lỗi 500', async () => {
    arrangeExisting();
    const res = await callHandler(updateBook, { params: { id: '100' }, body: { isbn: 9786041198203, copies: 3 }, user: ADMIN });
    expect(res.statusCode).toBe(200);
  });

  test.each([
    ['UT-BOOK-26a P2025 → 404', { code: 'P2025' }, 404, 'Không tìm thấy sách'],
    ['UT-BOOK-26b P2002 → 400', { code: 'P2002' }, 400, 'ISBN đã tồn tại'],
    ['UT-BOOK-26c lỗi khác → 500', new Error('db'), 500, 'Không thể cập nhật sách'],
  ])('%s', async (_id, failure, status, message) => {
    mocks.prisma.book.findUnique.mockResolvedValue(fullBook());
    mocks.prisma.book.update.mockRejectedValue(failure);
    const res = await callHandler(updateBook, { params: { id: '100' }, body: { title: 'x' }, user: ADMIN });
    expect(res.statusCode).toBe(status);
    expect(res.payload.error).toBe(message);
  });
});

// ================================================================ deleteBook
describe('deleteBook — DELETE /books/:id (BOOK-10)', () => {
  test('UT-BOOK-27 USER → 403; id không phải số → 400', async () => {
    expect((await callHandler(deleteBook, { params: { id: '100' }, user: READER })).statusCode).toBe(403);
    expect((await callHandler(deleteBook, { params: { id: 'abc' }, user: ADMIN })).statusCode).toBe(400);
    expect(mocks.prisma.bookItem.count).not.toHaveBeenCalled();
  });

  test('UT-BOOK-28 có bản đang BORROWED → 400 nêu số cuốn, KHÔNG xóa gì', async () => {
    mocks.prisma.bookItem.count.mockResolvedValue(2);
    const res = await callHandler(deleteBook, { params: { id: '100' }, user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('2 cuốn đang được mượn');
    expect(mocks.prisma.bookItem.count.mock.calls[0][0].where).toEqual({ bookId: 100, status: 'BORROWED' });
    expect(mocks.prisma.book.delete).not.toHaveBeenCalled();
    expect(mocks.prisma.loan.deleteMany).not.toHaveBeenCalled();
  });

  test('UT-BOOK-29 (BOOK-10) sách chưa phát sinh phiếu: xóa bản sao, đặt trước rồi đầu sách theo đúng thứ tự', async () => {
    const order: string[] = [];
    mocks.prisma.bookItem.count.mockResolvedValue(0);
    mocks.prisma.bookItem.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.prisma.loan.deleteMany.mockImplementation(async () => { order.push('loan'); });
    mocks.prisma.bookItem.deleteMany.mockImplementation(async () => { order.push('items'); });
    mocks.prisma.reservation.deleteMany.mockImplementation(async () => { order.push('reservation'); });
    mocks.prisma.book.delete.mockImplementation(async () => { order.push('book'); });
    const res = await callHandler(deleteBook, { params: { id: '100' }, user: ADMIN });
    expect(res.statusCode).toBe(200);
    expect(order).toEqual(['loan', 'items', 'reservation', 'book']);
    expect(mocks.prisma.loan.deleteMany.mock.calls[0][0]).toEqual({ where: { bookItemId: { in: [1, 2] } } });
    expect(mocks.prisma.book.delete.mock.calls[0][0]).toEqual({ where: { id: 100 } });
  });

  test('UT-BOOK-30 sách không có bản sao → bỏ qua xóa phiếu/bản sao nhưng vẫn xóa đặt trước và đầu sách', async () => {
    mocks.prisma.bookItem.count.mockResolvedValue(0);
    mocks.prisma.bookItem.findMany.mockResolvedValue([]);
    mocks.prisma.reservation.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.book.delete.mockResolvedValue({});
    expect((await callHandler(deleteBook, { params: { id: '100' }, user: ADMIN })).statusCode).toBe(200);
    expect(mocks.prisma.loan.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.bookItem.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.reservation.deleteMany).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['UT-BOOK-31a P2025 → 404', { code: 'P2025' }, 404],
    ['UT-BOOK-31b lỗi khác → 500', new Error('db'), 500],
  ])('%s', async (_id, failure, status) => {
    mocks.prisma.bookItem.count.mockRejectedValue(failure);
    expect((await callHandler(deleteBook, { params: { id: '100' }, user: ADMIN })).statusCode).toBe(status);
  });
});

// ================================================================ importBooks
describe('importBooks — POST /books/import (EXCEL-02, EXCEL-03)', () => {
  function arrangeImport() {
    mocks.prisma.book.findUnique.mockResolvedValue(null);
    mocks.prisma.book.create.mockImplementation(async ({ data }: any) => ({ id: 200, ...data }));
    mocks.prisma.auditLog.create.mockResolvedValue({ id: 1 });
  }
  const row = (overrides: Record<string, unknown> = {}) => ({
    'Tiêu đề': 'Sách Excel', 'Tác giả': 'Tác giả A', 'Thể loại': 'Loại A', ISBN: '978-604-58-1111-1', 'Số lượng': 2, ...overrides,
  });

  test('UT-EXC-01 USER → 403; không có file → 400', async () => {
    expect((await callHandler(importBooks, { user: READER, file: uploaded([row()]) })).statusCode).toBe(403);
    const res = await callHandler(importBooks, { user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('chọn file Excel');
  });

  test('UT-EXC-02 file chỉ có tiêu đề, không có dòng dữ liệu → 400 "trống"', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Tiêu đề', 'Tác giả', 'Thể loại', 'ISBN']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'S');
    const res = await callHandler(importBooks, { user: ADMIN, file: { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), originalname: 'trong.xlsx' } });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('trống');
  });

  test('UT-EXC-03 (EXCEL-02) dòng hợp lệ (tiêu đề tiếng Việt) → nhập thành công 2 bản sao, ghi AuditLog IMPORT_EXCEL', async () => {
    arrangeImport();
    const res = await callHandler(importBooks, { user: ADMIN, file: uploaded([row()]) });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ success: true, importedCount: 1, totalCopiesCreated: 2, skippedCount: 0, totalRows: 1 });
    expect(res.payload.imported).toEqual([{ title: 'Sách Excel', isbn: '978-604-58-1111-1', copies: 2 }]);
    expect(res.payload.message).toContain('toàn bộ');
    expect(barcodes()).toEqual(['BC-811111-001', 'BC-811111-002']);
    const audit = mocks.prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: 'IMPORT_EXCEL', adminId: 1 });
    expect(JSON.parse(audit.details)).toMatchObject({ fileName: 'nhap.xlsx', totalRows: 1, importedCount: 1, totalCopies: 2, skippedCount: 0 });
  });

  test('UT-EXC-04 tiêu đề cột tiếng Anh / không dấu / khác hoa thường đều được ánh xạ; trường tùy chọn được lưu', async () => {
    arrangeImport();
    const res = await callHandler(importBooks, {
      user: ADMIN,
      file: uploaded([{
        TITLE: 'Book EN', 'tac gia': 'Author EN', Category: 'Cat', isbn: '555', copies: 1,
        publisher: 'Pub', 'Năm XB': 2020, pages: 99, Language: ' English ', 'mô tả': ' Desc ', cover: ' http://c ',
      }]),
    });
    expect(res.payload.importedCount).toBe(1);
    expect(mocks.prisma.book.create.mock.calls[0][0].data).toMatchObject({
      title: 'Book EN', isbn: '555', publishedYear: '2020', pageCount: 99, language: 'English', description: 'Desc', coverImage: 'http://c', publisherId: 7,
    });
  });

  test.each([
    ['UT-EXC-05a copies = 0', 0, 1],
    ['UT-EXC-05b copies âm', -4, 1],
    ['UT-EXC-05c copies không phải số', 'abc', 1],
    ['UT-EXC-05d copies "3"', '3', 3],
  ])('%s → %i bản sao (tối thiểu 1)', async (_id, copies, expected) => {
    arrangeImport();
    const res = await callHandler(importBooks, { user: ADMIN, file: uploaded([row({ 'Số lượng': copies })]) });
    expect(res.payload.totalCopiesCreated).toBe(expected);
  });

  test.each([
    ['UT-EXC-06a thiếu Tiêu đề', { 'Tiêu đề': undefined }, '(Chưa có tiêu đề)'],
    ['UT-EXC-06b thiếu ISBN', { ISBN: undefined }, 'Sách Excel'],
    ['UT-EXC-06c thiếu Tác giả', { 'Tác giả': undefined }, 'Sách Excel'],
    ['UT-EXC-06d thiếu Thể loại', { 'Thể loại': undefined }, 'Sách Excel'],
  ])('%s (EXCEL-03) → dòng bị bỏ qua kèm lý do, không tạo sách', async (_id, patch, title) => {
    arrangeImport();
    const res = await callHandler(importBooks, { user: ADMIN, file: uploaded([row(patch), row({ ISBN: '999-1', 'Tiêu đề': 'Dòng tốt' })]) });
    expect(res.payload).toMatchObject({ importedCount: 1, skippedCount: 1 });
    expect(res.payload.skipped[0]).toMatchObject({ row: 2, title });
    expect(res.payload.skipped[0].reason).toContain('Thiếu trường bắt buộc');
    expect(res.payload.message).toContain('bỏ qua 1');
  });

  test('UT-EXC-07 (EXCEL-03) ISBN trùng sách đã có trong thư viện → bỏ qua, nêu tên sách đã có', async () => {
    arrangeImport();
    mocks.prisma.book.findUnique.mockResolvedValue({ id: 1, title: 'Sách đã có' });
    const res = await callHandler(importBooks, { user: ADMIN, file: uploaded([row()]) });
    expect(res.payload).toMatchObject({ importedCount: 0, skippedCount: 1 });
    expect(res.payload.skipped[0].reason).toContain('"Sách đã có"');
    expect(mocks.prisma.book.create).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  test('UT-EXC-08 (EXCEL-03) ISBN lặp trong cùng file (kể cả khác khoảng trắng) → dòng sau bị bỏ qua', async () => {
    arrangeImport();
    const res = await callHandler(importBooks, {
      user: ADMIN, file: uploaded([row({ ISBN: '978 604 1' }), row({ ISBN: '978604 1', 'Tiêu đề': 'Bản lặp' })]),
    });
    expect(res.payload).toMatchObject({ importedCount: 1, skippedCount: 1 });
    expect(res.payload.skipped[0]).toMatchObject({ row: 3, title: 'Bản lặp' });
    expect(res.payload.skipped[0].reason).toContain('Trùng lặp');
  });

  test.each([
    ['UT-EXC-09a lỗi có message', new Error('khóa UNIQUE'), 'khóa UNIQUE'],
    ['UT-EXC-09b lỗi không có message', {}, 'Lỗi không xác định'],
  ])('%s: lỗi DB ở một dòng → dòng đó bị bỏ qua, các dòng khác vẫn được nhập', async (_id, failure, text) => {
    arrangeImport();
    mocks.prisma.category.upsert.mockRejectedValueOnce(failure);
    const res = await callHandler(importBooks, { user: ADMIN, file: uploaded([row({ ISBN: '1' }), row({ ISBN: '2', 'Tiêu đề': 'Dòng 2' })]) });
    expect(res.payload).toMatchObject({ importedCount: 1, skippedCount: 1 });
    expect(res.payload.skipped[0].reason).toContain(text);
  });

  test('UT-EXC-10 ISBN không có chữ số → tiền tố barcode dùng id sách vừa tạo', async () => {
    arrangeImport();
    await callHandler(importBooks, { user: ADMIN, file: uploaded([row({ ISBN: 'ABC', 'Số lượng': 1 })]) });
    expect(barcodes()).toEqual(['BC-200-001']);
  });

  test('UT-EXC-11 lỗi ghi AuditLog (ngoài vòng lặp) → 500', async () => {
    arrangeImport();
    mocks.prisma.auditLog.create.mockRejectedValue(new Error('audit down'));
    const res = await callHandler(importBooks, { user: ADMIN, file: uploaded([row()]) });
    expect(res.statusCode).toBe(500);
    expect(res.payload.error).toBe('audit down');
  });
});

// ================================================================ downloadImportTemplate / uploadEbookHandler
describe('downloadImportTemplate (EXCEL-01)', () => {
  test('UT-EXC-12 trả file .xlsx hợp lệ với 3 dòng mẫu và các cột hướng dẫn', async () => {
    const res = await callHandler(downloadImportTemplate);
    expect(res.headers['Content-Type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['Content-Disposition']).toContain('mau_nhap_sach_thu_vien.xlsx');
    const workbook = XLSX.read(res.sent as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['Tiêu đề', 'Tác giả', 'Thể loại', 'ISBN', 'Số lượng bản sao']));
  });

  test('UT-EXC-13 file mẫu có thể nhập lại được: mọi dòng mẫu đều hợp lệ khi chạy importBooks', async () => {
    const template = await callHandler(downloadImportTemplate);
    mocks.prisma.book.findUnique.mockResolvedValue(null);
    mocks.prisma.book.create.mockImplementation(async ({ data }: any) => ({ id: 1, ...data }));
    mocks.prisma.auditLog.create.mockResolvedValue({ id: 1 });
    const res = await callHandler(importBooks, { user: ADMIN, file: { buffer: template.sent, originalname: 'mau.xlsx' } });
    expect(res.payload).toMatchObject({ importedCount: 3, skippedCount: 0, totalCopiesCreated: 12 });
  });

  test('UT-EXC-14 lỗi tạo file → 500', async () => {
    const spy = vi.spyOn(XLSX.utils, 'json_to_sheet').mockImplementationOnce(() => { throw new Error('xlsx'); });
    const res = await callHandler(downloadImportTemplate);
    expect(res.statusCode).toBe(500);
    spy.mockRestore();
  });
});

describe('uploadEbookHandler — POST /books/upload-ebook (BOOK-08)', () => {
  test('UT-EBK-01 USER → 403; ADMIN không gửi file → 400', async () => {
    expect((await callHandler(uploadEbookHandler, { user: READER, file: { filename: 'a.pdf' } })).statusCode).toBe(403);
    const res = await callHandler(uploadEbookHandler, { user: ADMIN });
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toContain('PDF hoặc EPUB');
  });

  test('UT-EBK-02 ADMIN + file hợp lệ → trả ebookUrl, tên gốc và kích thước', async () => {
    const res = await callHandler(uploadEbookHandler, { user: ADMIN, file: { filename: 'ebook-1.pdf', originalname: 'Sách.pdf', size: 1234 } });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ ebookUrl: '/uploads/ebooks/ebook-1.pdf', fileName: 'Sách.pdf', size: 1234 });
  });

  test('UT-EBK-03 lỗi bất ngờ khi đọc file → 500', async () => {
    const req: any = { user: ADMIN };
    Object.defineProperty(req, 'file', { get() { throw new Error('disk'); } });
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    await uploadEbookHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ================================================================ getBookRecommendations
describe('getBookRecommendations — GET /books/recommendations (BOOK-03)', () => {
  const book = (id: number, categoryId: number | null, authorId: number | null, extra: Record<string, unknown> = {}) =>
    fullBook({ id, title: `Sách ${id}`, categoryId, authorId, items: [{ id: id * 10, barcode: `B${id}`, status: 'AVAILABLE' }], ...extra });
  const loanOfBook = (b: any) => ({ bookItem: { bookId: b.id, book: { ...b, category: { name: 'Thể loại X' }, author: { name: 'Tác giả Y' } } } });

  test('UT-REC-01 (BOOK-03) khách / người chưa có lịch sử → TRENDING: sắp theo lượt mượn rồi số bản còn, tối đa 10', async () => {
    const pool = [book(1, 1, 1), book(2, 1, 1), book(3, 1, 1, { items: [{ status: 'AVAILABLE' }, { status: 'AVAILABLE' }] })];
    mocks.prisma.loan.findMany.mockResolvedValue([{ bookItem: { bookId: 2 } }, { bookItem: { bookId: 2 } }, { bookItem: { bookId: 1 } }, { bookItem: null }]);
    mocks.prisma.book.findMany.mockResolvedValue(pool);
    const res = await callHandler(getBookRecommendations, {});
    expect(res.payload).toMatchObject({ success: true, type: 'TRENDING' });
    expect(res.payload.reason).toContain('thịnh hành');
    // 2 có 2 lượt, 1 có 1 lượt, 3 có 0 lượt
    expect(res.payload.books.map((b: any) => b.id)).toEqual([2, 1, 3]);
    expect(res.payload.books.every((b: any) => b.recommendationBadge === 'Thịnh hành' && b.recommendationReason === 'Được nhiều bạn đọc yêu thích')).toBe(true);
    // Khách không có userId → chỉ 1 lần loan.findMany (toàn bộ phiếu để đếm lượt mượn)
    expect(mocks.prisma.loan.findMany).toHaveBeenCalledTimes(1);
  });

  test('UT-REC-02 đồng hạng lượt mượn → ưu tiên sách còn nhiều bản hơn', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([]);
    mocks.prisma.book.findMany.mockResolvedValue([
      book(1, 1, 1, { items: [{ status: 'AVAILABLE' }] }),
      book(2, 1, 1, { items: [{ status: 'AVAILABLE' }, { status: 'AVAILABLE' }, { status: 'BORROWED' }] }),
      book(3, 1, 1, { items: undefined }),
    ]);
    const res = await callHandler(getBookRecommendations, {});
    expect(res.payload.books.map((b: any) => b.id)).toEqual([2, 1, 3]);
  });

  test('UT-REC-03 trending giới hạn 10 sách', async () => {
    mocks.prisma.loan.findMany.mockResolvedValue([]);
    mocks.prisma.book.findMany.mockResolvedValue(Array.from({ length: 15 }, (_, i) => book(i + 1, 1, 1)));
    expect((await callHandler(getBookRecommendations, {})).payload.books).toHaveLength(10);
  });

  test('UT-REC-04 (BOOK-03) người có lịch sử → PERSONALIZED, thể loại + tác giả hay mượn nhất, loại sách đã mượn, ≥ 6 ứng viên không cần bổ sung trending', async () => {
    const history = [book(1, 7, 8), book(2, 7, 8), book(3, 9, 10)];
    mocks.prisma.loan.findMany.mockResolvedValueOnce(history.map(loanOfBook));
    const candidates = Array.from({ length: 6 }, (_, i) => book(20 + i, 7, 99));
    mocks.prisma.book.findMany.mockResolvedValueOnce(candidates);
    const res = await callHandler(getBookRecommendations, { user: READER });
    expect(res.payload.type).toBe('PERSONALIZED');
    expect(res.payload.reason).toContain('Thể loại "Thể loại X" & Tác giả "Tác giả Y"');
    expect(res.payload.books).toHaveLength(6);
    expect(res.payload.books[0]).toMatchObject({ recommendationBadge: 'Phù hợp với bạn', recommendationReason: 'Cùng thể loại Thể loại X' });
    const where = mocks.prisma.book.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ id: { notIn: [1, 2, 3] } });
    expect(where.AND[1]).toEqual({ OR: [{ categoryId: 7 }, { authorId: 8 }] });
    expect(mocks.prisma.loan.findMany).toHaveBeenCalledTimes(1);
  });

  test('UT-REC-05 ứng viên cá nhân hóa < 6 → bổ sung trending (không trùng), nhãn phân biệt, tổng tối đa 10', async () => {
    mocks.prisma.loan.findMany
      .mockResolvedValueOnce([loanOfBook(book(1, 7, 8))])
      .mockResolvedValueOnce([{ bookItem: { bookId: 31 } }]);
    mocks.prisma.book.findMany
      .mockResolvedValueOnce([book(20, 7, 99), book(21, 55, 8)])
      .mockResolvedValueOnce([book(30, 1, 1), book(31, 1, 1)]);
    const res = await callHandler(getBookRecommendations, { user: READER });
    expect(res.payload.type).toBe('PERSONALIZED');
    expect(res.payload.books.map((b: any) => b.id)).toEqual([20, 21, 31, 30]);
    expect(res.payload.books[0]).toMatchObject({ recommendationBadge: 'Phù hợp với bạn', recommendationReason: 'Cùng thể loại Thể loại X' });
    // Sách 21 khác thể loại nhưng cùng tác giả → lý do theo tác giả
    expect(res.payload.books[1]).toMatchObject({ recommendationBadge: 'Phù hợp với bạn', recommendationReason: 'Tác giả Tác giả Y' });
    expect(res.payload.books[2].recommendationBadge).toBe('Thịnh hành');
    const trendingWhere = mocks.prisma.book.findMany.mock.calls[1][0].where;
    expect(trendingWhere.id.notIn.sort()).toEqual([1, 20, 21]);
  });

  test('UT-REC-06 có lịch sử nhưng không có ứng viên → chuyển sang TRENDING', async () => {
    mocks.prisma.loan.findMany.mockResolvedValueOnce([loanOfBook(book(1, 7, 8))]).mockResolvedValueOnce([]);
    mocks.prisma.book.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([book(40, 1, 1)]);
    const res = await callHandler(getBookRecommendations, { user: READER });
    expect(res.payload.type).toBe('TRENDING');
    expect(res.payload.books.map((b: any) => b.id)).toEqual([40]);
  });

  test.each([
    ['UT-REC-07a chỉ có thể loại (sách đã mượn không có tác giả)', book(1, 7, null), 'Dựa trên thể loại bạn thường mượn: "Thể loại X"', [{ categoryId: 7 }]],
    ['UT-REC-07b chỉ có tác giả (sách đã mượn không có thể loại)', book(1, null, 8), 'Dựa trên tác giả bạn yêu thích: "Tác giả Y"', [{ authorId: 8 }]],
  ])('%s → lý do và điều kiện OR tương ứng', async (_id, borrowed, reason, orConditions) => {
    mocks.prisma.loan.findMany.mockResolvedValueOnce([loanOfBook(borrowed)]).mockResolvedValueOnce([]);
    mocks.prisma.book.findMany.mockResolvedValueOnce([book(20, 7, 8)]).mockResolvedValueOnce([]);
    const res = await callHandler(getBookRecommendations, { user: READER });
    expect(res.payload.reason).toBe(reason);
    expect(mocks.prisma.book.findMany.mock.calls[0][0].where.AND[1]).toEqual({ OR: orConditions });
  });

  test('UT-REC-08 phiếu mượn không có thông tin sách bị bỏ qua khi đếm sở thích', async () => {
    mocks.prisma.loan.findMany.mockResolvedValueOnce([{ bookItem: null }, { bookItem: { book: null } }]).mockResolvedValueOnce([]);
    mocks.prisma.book.findMany.mockResolvedValueOnce([]);
    const res = await callHandler(getBookRecommendations, { user: READER });
    expect(res.payload.type).toBe('TRENDING');
  });

  test('UT-REC-09 thể loại/tác giả thiếu tên → tên rỗng, vẫn tạo được gợi ý', async () => {
    const noName = { bookItem: { bookId: 1, book: { ...book(1, 7, 8), category: null, author: null } } };
    mocks.prisma.loan.findMany.mockResolvedValueOnce([noName]).mockResolvedValueOnce([]);
    mocks.prisma.book.findMany.mockResolvedValueOnce([book(20, 7, 8)]).mockResolvedValueOnce([]);
    const res = await callHandler(getBookRecommendations, { user: READER });
    expect(res.payload.reason).toBe('Dựa trên sở thích đọc sách: Thể loại "" & Tác giả ""');
  });

  test('UT-REC-10 lỗi DB → 500 kèm message; lỗi không message → thông điệp mặc định', async () => {
    mocks.prisma.loan.findMany.mockRejectedValueOnce(new Error('db')).mockRejectedValueOnce({});
    expect((await callHandler(getBookRecommendations, {})).payload).toEqual({ error: 'db' });
    expect((await callHandler(getBookRecommendations, {})).payload).toEqual({ error: 'Không thể lấy danh sách gợi ý sách' });
  });
});
