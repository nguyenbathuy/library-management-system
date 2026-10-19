/**
 * Mục tiêu: kiểm thử tích hợp API quản lý sách (/api/books): danh sách, thêm (tạo mới / tự gộp kho), sửa, xóa,
 *   nhập Excel (multipart), tải file mẫu, tải e-book và gợi ý sách — qua HTTP thật trên SQLite tạm.
 * Kỹ thuật: hộp đen mức API + kiểm tra DB (Book, BookItem, AuditLog); phân vùng tương đương (vai trò, loại dòng Excel,
 *   định dạng file); file Excel dựng bằng xlsx trong bộ nhớ.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): BOOK-03 (gợi ý), BOOK-04 (thêm 2 bản, 2 barcode khác nhau), BOOK-05 (dữ liệu
 *   thiếu/không hợp lệ), BOOK-06 (thêm lại cùng ISBN), BOOK-07 (sửa + tăng bản sao), BOOK-08 (e-book), BOOK-10 (xóa),
 *   EXCEL-01..04 (mẫu, nhập hợp lệ, dòng lỗi/trùng, sai định dạng).
 * test.fails: NEW FINDING FIND-08 (copies = 0 bị đổi thành 1), FIND-15 (file sai định dạng → HTTP 500 thay vì 4xx),
 *   FIND-16 (USER tải e-book bị 403 nhưng file vẫn ghi vào đĩa vì multer chạy trước kiểm tra quyền).
 * Ranh giới: không kiểm thử giao diện (tìm kiếm/lọc BOOK-01, thẻ gợi ý, modal); file tĩnh /uploads do index.ts phục vụ nên
 *   không thuộc buildApp. File e-book thử nghiệm ghi vào server/public/uploads/ebooks (thư mục .gitignore) và được xóa sau mỗi ca.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../helpers/app';
import { bearer, createLoan, createUser, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const app = buildApp();
const EBOOK_DIR = fileURLToPath(new URL('../../public/uploads/ebooks', import.meta.url));
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;
let ebooksBefore: Set<string>;

const body = (overrides: Record<string, unknown> = {}) => ({
  title: 'Bong bóng lên trời', author: 'Nguyễn Nhật Ánh', isbn: '978-604-1-19820-3', category: 'Truyện ngắn', copies: 2, ...overrides,
});
const post = (data: unknown, as = admin) => request(app).post('/api/books').set(bearer(as)).send(data as object);
const itemsOf = (bookId: number) => prisma.bookItem.findMany({ where: { bookId }, orderBy: { id: 'asc' } });
const xlsx = (rows: Array<Record<string, unknown>>) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};
const importFile = (buffer: Buffer, filename = 'nhap.xlsx', contentType = XLSX_TYPE, as = admin) =>
  request(app).post('/api/books/import').set(bearer(as)).attach('file', buffer, { filename, contentType });
const ebookFiles = () => (existsSync(EBOOK_DIR) ? readdirSync(EBOOK_DIR) : []);

async function mkBook(isbn: string, category: string, author: string, copies = 2, title = `Sách ${isbn}`) {
  return prisma.book.create({
    data: {
      title, isbn,
      category: { connectOrCreate: { where: { name: category }, create: { name: category } } },
      author: { connectOrCreate: { where: { name: author }, create: { name: author } } },
      items: { create: Array.from({ length: copies }, (_, i) => ({ barcode: `${isbn}-${i + 1}` })) },
    },
    include: { items: { orderBy: { id: 'asc' } } },
  });
}

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN' });
  reader = await createUser({ email: 'reader@it.local' });
  ebooksBefore = new Set(ebookFiles());
});

afterEach(() => {
  // Xóa mọi file e-book do ca test vừa tạo (không đụng file có sẵn).
  for (const file of ebookFiles()) if (!ebooksBefore.has(file)) rmSync(`${EBOOK_DIR}/${file}`, { force: true });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/books — công khai', () => {
  test('IT-BOOK-01 không cần token; trả copies/available/status đúng theo bản sao đang mượn', async () => {
    const book = await mkBook('BK-IT-1', 'Văn học', 'Tác giả 1', 3);
    await createLoan(reader.id, book.items[0].id);
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ isbn: 'BK-IT-1', author: 'Tác giả 1', category: 'Văn học', copies: 3, available: 2, status: 'Available' });
    expect(res.body[0].items.map((i: any) => i.status).sort()).toEqual(['AVAILABLE', 'AVAILABLE', 'BORROWED']);
  });

  test('IT-BOOK-02 mọi bản đang mượn → status "Borrowed", available 0', async () => {
    const book = await mkBook('BK-IT-2', 'Văn học', 'Tác giả 1', 1);
    await createLoan(reader.id, book.items[0].id);
    expect((await request(app).get('/api/books')).body[0]).toMatchObject({ available: 0, status: 'Borrowed' });
  });
});

describe('POST /api/books — thêm sách (BOOK-04, BOOK-05, BOOK-06)', () => {
  test('IT-BOOK-03 không token → 401; USER → 403; DB không đổi', async () => {
    expect((await request(app).post('/api/books').send(body())).status).toBe(401);
    expect((await post(body(), reader)).status).toBe(403);
    expect(await prisma.book.count()).toBe(0);
  });

  test('IT-BOOK-04 (BOOK-04) thêm sách 2 bản → 201; DB có 1 đầu sách, 2 bản sao AVAILABLE với 2 barcode khác nhau', async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ isMerged: false, copies: 2, available: 2, author: 'Nguyễn Nhật Ánh', category: 'Truyện ngắn' });
    expect(await prisma.book.count()).toBe(1);
    const items = await itemsOf(res.body.id);
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.barcode)).size).toBe(2);
    expect(items.every((i) => i.status === 'AVAILABLE')).toBe(true);
  });

  test('IT-BOOK-05 trường tùy chọn (NXB, năm, số trang, ngôn ngữ, ảnh bìa, e-book) được lưu', async () => {
    const res = await post(body({ copies: 1, publisher: 'NXB Kim Đồng', publishedYear: 2022, pageCount: 120, language: 'Tiếng Việt', coverImage: 'http://x/c.png', ebookUrl: '/uploads/ebooks/a.pdf' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ publisher: 'NXB Kim Đồng', publishedYear: '2022', pageCount: 120, coverImage: 'http://x/c.png', ebookUrl: '/uploads/ebooks/a.pdf' });
  });

  test.each([
    ['thiếu title', { title: '' }],
    ['thiếu author', { author: '' }],
    ['thiếu isbn', { isbn: '' }],
    ['thiếu category', { category: '' }],
    ['copies âm', { copies: -1 }],
    ['available > copies', { copies: 2, available: 5 }],
    ['available âm', { available: -1 }],
  ])('IT-BOOK-06 (BOOK-05) %s → 400, không tạo sách', async (_label, patch) => {
    const res = await post(body(patch));
    expect(res.status).toBe(400);
    expect(await prisma.book.count()).toBe(0);
    expect(await prisma.bookItem.count()).toBe(0);
  });

  // NEW FINDING FIND-08 — BOOK-05 "nhập số lượng dưới 1 → không tạo sách và hiện lỗi"; copies = 0 hiện tạo 1 bản.
  test.fails('IT-BOOK-07 (BOOK-05, FIND-08) copies = 0 phải bị từ chối, không tạo sách', async () => {
    const res = await post(body({ copies: 0 }));
    expect(res.status).toBe(400);
    expect(await prisma.book.count()).toBe(0);
  });

  test('IT-BOOK-08 (BOOK-06) thêm lại cùng ISBN → 200 isMerged, vẫn 1 đầu sách, cộng thêm bản sao với barcode không trùng', async () => {
    await post(body());
    const res = await post(body({ copies: 3 }));
    expect(res.status).toBe(200);
    expect(res.body.isMerged).toBe(true);
    expect(await prisma.book.count()).toBe(1);
    const items = await itemsOf(res.body.id);
    expect(items).toHaveLength(5);
    expect(new Set(items.map((i) => i.barcode)).size).toBe(5);
  });

  test('IT-BOOK-09 cùng tiêu đề + tác giả nhưng ISBN khác cũng được gộp vào đầu sách cũ (Smart Merge, ghi nhận hành vi hiện tại)', async () => {
    const first = await post(body());
    const res = await post(body({ isbn: '000-111-222-333', copies: 1 }));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(first.body.id);
    expect(await prisma.book.count()).toBe(1);
  });

  test('IT-BOOK-10 hai đầu sách khác nhau có 6 chữ số cuối ISBN trùng nhau vẫn có barcode duy nhất (không lỗi UNIQUE)', async () => {
    const a = await post(body({ title: 'Sách A', isbn: '111-222-333-444', copies: 2 }));
    const b = await post(body({ title: 'Sách B', author: 'Tác giả B', isbn: '999-222-333-444', copies: 2 }));
    expect([a.status, b.status]).toEqual([201, 201]);
    const all = await prisma.bookItem.findMany();
    expect(all).toHaveLength(4);
    expect(new Set(all.map((i) => i.barcode)).size).toBe(4);
  });
});

describe('PUT /api/books/:id — sửa sách (BOOK-07)', () => {
  let bookId: number;
  beforeEach(async () => {
    bookId = (await post(body())).body.id;
  });
  const put = (data: unknown, as = admin, id: number | string = bookId) => request(app).put(`/api/books/${id}`).set(bearer(as)).send(data as object);

  test('IT-BOOK-11 (BOOK-07) đổi tên/mô tả và tăng 2 → 3: thông tin lưu, có 1 barcode mới, barcode cũ giữ nguyên', async () => {
    const before = (await itemsOf(bookId)).map((i) => i.barcode);
    const res = await put({ title: 'Tên đã sửa', description: 'Mô tả mới', copies: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Tên đã sửa', description: 'Mô tả mới', copies: 3 });
    const after = (await itemsOf(bookId)).map((i) => i.barcode);
    expect(after).toHaveLength(3);
    expect(after.slice(0, 2)).toEqual(before);
    expect(new Set(after).size).toBe(3);
  });

  test('IT-BOOK-12 đổi tác giả/thể loại/NXB: tạo bản ghi mới nếu chưa có và gán lại', async () => {
    const res = await put({ author: 'Tác giả mới', category: 'Thể loại mới', publisher: 'NXB mới' });
    expect(res.body).toMatchObject({ author: 'Tác giả mới', category: 'Thể loại mới', publisher: 'NXB mới' });
    expect(await prisma.author.count({ where: { name: 'Tác giả mới' } })).toBe(1);
  });

  test('IT-BOOK-13 USER → 403; không token → 401; id không tồn tại → 404; id không phải số → 400', async () => {
    expect((await put({ title: 'x' }, reader)).status).toBe(403);
    expect((await request(app).put(`/api/books/${bookId}`).send({ title: 'x' })).status).toBe(401);
    expect((await put({ title: 'x' }, admin, 99999)).status).toBe(404);
    expect((await put({ title: 'x' }, admin, 'abc')).status).toBe(400);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).title).toBe('Bong bóng lên trời');
  });

  test('IT-BOOK-14 đổi ISBN trùng sách khác → 400 "ISBN đã tồn tại", dữ liệu sách không đổi', async () => {
    await mkBook('KHAC-ISBN', 'Văn học', 'Người khác', 1);
    const res = await put({ isbn: 'KHAC-ISBN' });
    expect(res.status).toBe(400);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).isbn).toBe('978-604-1-19820-3');
  });

  test('IT-BOOK-15 giảm số lượng (2 → 1) không xóa bản sao nào (giảm chưa được hỗ trợ, ghi nhận hành vi hiện tại)', async () => {
    expect((await put({ copies: 1 })).status).toBe(200);
    expect(await itemsOf(bookId)).toHaveLength(2);
  });
});

describe('DELETE /api/books/:id — xóa sách (BOOK-10)', () => {
  test('IT-BOOK-16 (BOOK-10) sách chưa phát sinh phiếu mượn → xóa khỏi danh mục: Book và BookItem biến mất', async () => {
    const book = await mkBook('BK-DEL-1', 'Văn học', 'A', 2);
    const res = await request(app).delete(`/api/books/${book.id}`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(await prisma.book.findUnique({ where: { id: book.id } })).toBeNull();
    expect(await prisma.bookItem.count({ where: { bookId: book.id } })).toBe(0);
    expect((await request(app).get('/api/books')).body).toEqual([]);
  });

  test('IT-BOOK-17 xóa sách xóa luôn các yêu cầu đặt trước của sách đó', async () => {
    const book = await mkBook('BK-DEL-2', 'Văn học', 'A', 1);
    await prisma.reservation.create({ data: { userId: reader.id, bookId: book.id } });
    expect((await request(app).delete(`/api/books/${book.id}`).set(bearer(admin))).status).toBe(200);
    expect(await prisma.reservation.count()).toBe(0);
  });

  test('IT-BOOK-18 có bản đang được mượn → 400, sách + bản sao + phiếu mượn còn nguyên', async () => {
    const book = await mkBook('BK-DEL-3', 'Văn học', 'A', 2);
    await createLoan(reader.id, book.items[0].id);
    const res = await request(app).delete(`/api/books/${book.id}`).set(bearer(admin));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('1 cuốn đang được mượn');
    expect(await prisma.book.count()).toBe(1);
    expect(await prisma.bookItem.count()).toBe(2);
    expect(await prisma.loan.count()).toBe(1);
  });

  test('IT-BOOK-19 USER → 403; không token → 401; id không phải số → 400; id không tồn tại → 404', async () => {
    const book = await mkBook('BK-DEL-4', 'Văn học', 'A', 1);
    expect((await request(app).delete(`/api/books/${book.id}`).set(bearer(reader))).status).toBe(403);
    expect((await request(app).delete(`/api/books/${book.id}`)).status).toBe(401);
    expect((await request(app).delete('/api/books/abc').set(bearer(admin))).status).toBe(400);
    expect((await request(app).delete('/api/books/99999').set(bearer(admin))).status).toBe(404);
    expect(await prisma.book.count()).toBe(1);
  });
});

describe('Nhập Excel — /api/books/import-template, /api/books/import (EXCEL-01..04)', () => {
  test('IT-EXC-01 (EXCEL-01) tải file mẫu (không cần token, cả hai đường dẫn) → .xlsx mở được, có cột hướng dẫn', async () => {
    for (const url of ['/api/books/import-template', '/api/books/import/template']) {
      const res = await request(app).get(url).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(XLSX_TYPE);
      expect(res.headers['content-disposition']).toContain('.xlsx');
      const wb = XLSX.read(res.body as Buffer, { type: 'buffer' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['Tiêu đề', 'Tác giả', 'ISBN', 'Thể loại']));
    }
  });

  test('IT-EXC-02 (EXCEL-02) nhập 1 dòng mới, số lượng 2 → thành công; DB có sách với 2 bản; AuditLog IMPORT_EXCEL', async () => {
    const res = await importFile(xlsx([{ 'Tiêu đề': 'Sách Excel', 'Tác giả': 'Tác giả E', 'Thể loại': 'Loại E', ISBN: '978-604-58-1111-1', 'Số lượng': 2 }]));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, importedCount: 1, totalCopiesCreated: 2, skippedCount: 0 });
    const book = await prisma.book.findUniqueOrThrow({ where: { isbn: '978-604-58-1111-1' } });
    expect(await itemsOf(book.id)).toHaveLength(2);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'IMPORT_EXCEL' } });
    expect(log.adminId).toBe(admin.id);
  });

  test('IT-EXC-03 (EXCEL-03) dòng thiếu tiêu đề + dòng trùng ISBN đã có + dòng hợp lệ → chỉ dòng hợp lệ được tạo, dòng lỗi kèm lý do', async () => {
    await mkBook('TRUNG-ISBN', 'Văn học', 'Ai đó', 1, 'Sách đã có');
    const res = await importFile(xlsx([
      { 'Tiêu đề': '', 'Tác giả': 'A', 'Thể loại': 'L', ISBN: 'X-1' },
      { 'Tiêu đề': 'Sách trùng', 'Tác giả': 'A', 'Thể loại': 'L', ISBN: 'TRUNG-ISBN' },
      { 'Tiêu đề': 'Sách tốt', 'Tác giả': 'A', 'Thể loại': 'L', ISBN: 'OK-1', 'Số lượng': 1 },
    ]));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ importedCount: 1, skippedCount: 2, totalRows: 3 });
    expect(res.body.skipped.map((s: any) => s.row)).toEqual([2, 3]);
    expect(res.body.skipped[1].reason).toContain('Sách đã có');
    expect(await prisma.book.count()).toBe(2);
    expect(await prisma.book.findUnique({ where: { isbn: 'X-1' } })).toBeNull();
    // ISBN trùng không tạo thêm bản sao cho sách cũ
    expect(await prisma.bookItem.count({ where: { book: { isbn: 'TRUNG-ISBN' } } })).toBe(1);
  });

  test('IT-EXC-04 hai dòng cùng ISBN trong một file → chỉ dòng đầu được tạo', async () => {
    const res = await importFile(xlsx([
      { 'Tiêu đề': 'Một', 'Tác giả': 'A', 'Thể loại': 'L', ISBN: 'DUP-1' },
      { 'Tiêu đề': 'Hai', 'Tác giả': 'A', 'Thể loại': 'L', ISBN: 'DUP-1' },
    ]));
    expect(res.body).toMatchObject({ importedCount: 1, skippedCount: 1 });
    expect(await prisma.book.count()).toBe(1);
  });

  test('IT-EXC-05 USER → 403; không token → 401; không đính kèm file → 400; file không có dòng dữ liệu → 400', async () => {
    expect((await importFile(xlsx([{ 'Tiêu đề': 'a', 'Tác giả': 'b', 'Thể loại': 'c', ISBN: 'd' }]), 'a.xlsx', XLSX_TYPE, reader)).status).toBe(403);
    expect((await request(app).post('/api/books/import')).status).toBe(401);
    expect((await request(app).post('/api/books/import').set(bearer(admin))).status).toBe(400);
    const headerOnly = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(headerOnly, XLSX.utils.aoa_to_sheet([['Tiêu đề', 'Tác giả']]), 'S');
    expect((await importFile(XLSX.write(headerOnly, { type: 'buffer', bookType: 'xlsx' }))).status).toBe(400);
    expect(await prisma.book.count()).toBe(0);
  });

  // NEW FINDING FIND-15 — EXCEL-04: lỗi định dạng là lỗi của client (4xx). multer ném Error không có status nên Express
  // trả 500 kèm trang lỗi HTML.
  test.fails('IT-EXC-06 (EXCEL-04, FIND-15) file không phải .xlsx/.xls (.txt) phải bị từ chối bằng 4xx, không phải 500', async () => {
    const res = await importFile(Buffer.from('không phải excel'), 'ghi-chu.txt', 'text/plain');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await prisma.book.count()).toBe(0);
  });

  test('IT-EXC-07 (EXCEL-04) file .txt không bao giờ tạo sách (bất kể mã lỗi)', async () => {
    await importFile(Buffer.from('không phải excel'), 'ghi-chu.txt', 'text/plain');
    expect(await prisma.book.count()).toBe(0);
  });
});

describe('Tải e-book — POST /api/books/upload-ebook (BOOK-08)', () => {
  const upload = (buffer: Buffer, filename: string, contentType: string, as?: typeof admin) => {
    const req = request(app).post('/api/books/upload-ebook');
    return (as ? req.set(bearer(as)) : req).attach('file', buffer, { filename, contentType });
  };
  const pdf = Buffer.from('%PDF-1.4\n%test\n');

  test('IT-EBK-01 (BOOK-08) Admin tải PDF → 200, trả ebookUrl; file được lưu trên đĩa với tên duy nhất', async () => {
    const res = await upload(pdf, 'sach.pdf', 'application/pdf', admin);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fileName: 'sach.pdf', size: pdf.length });
    expect(res.body.ebookUrl).toMatch(/^\/uploads\/ebooks\/ebook-\d+-\d+\.pdf$/);
    expect(existsSync(`${EBOOK_DIR}/${res.body.ebookUrl.split('/').pop()}`)).toBe(true);
  });

  test('IT-EBK-02 Admin tải EPUB → 200', async () => {
    expect((await upload(Buffer.from('PK'), 'sach.epub', 'application/epub+zip', admin)).status).toBe(200);
  });

  test('IT-EBK-03 không token → 401; Admin không đính kèm file → 400', async () => {
    expect((await upload(pdf, 'sach.pdf', 'application/pdf')).status).toBe(401);
    expect((await request(app).post('/api/books/upload-ebook').set(bearer(admin))).status).toBe(400);
  });

  test('IT-EBK-04 USER tải e-book → 403', async () => {
    expect((await upload(pdf, 'sach.pdf', 'application/pdf', reader)).status).toBe(403);
  });

  // NEW FINDING FIND-16 — multer (uploadEbook) chạy TRƯỚC kiểm tra vai trò trong handler, nên file của USER vẫn được ghi.
  test.fails('IT-EBK-05 (FIND-16) USER bị từ chối thì file không được ghi vào đĩa', async () => {
    await upload(pdf, 'sach.pdf', 'application/pdf', reader);
    expect(ebookFiles().filter((f) => !ebooksBefore.has(f))).toEqual([]);
  });

  // NEW FINDING FIND-15 (định dạng sai → 500).
  test.fails('IT-EBK-06 (BOOK-08, FIND-15) định dạng không phải .pdf/.epub phải bị từ chối bằng 4xx, không phải 500', async () => {
    const res = await upload(Buffer.from('MZ'), 'virus.exe', 'application/octet-stream', admin);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('IT-EBK-07 file định dạng sai không bao giờ được lưu lên đĩa', async () => {
    await upload(Buffer.from('MZ'), 'virus.exe', 'application/octet-stream', admin);
    expect(ebookFiles().filter((f) => !ebooksBefore.has(f))).toEqual([]);
  });
});

describe('GET /api/books/recommendations (BOOK-03)', () => {
  const recs = (as?: typeof reader) => {
    const req = request(app).get('/api/books/recommendations');
    return as ? req.set(bearer(as)) : req;
  };

  test('IT-REC-01 (BOOK-03) khách / tài khoản mới chưa có lịch sử → TRENDING, sách được mượn nhiều xếp trước, nhãn "Thịnh hành"', async () => {
    const popular = await mkBook('REC-1', 'Văn học', 'A', 2);
    await mkBook('REC-2', 'Khoa học', 'B', 2);
    const other = await createUser({ email: 'other@it.local' });
    await createLoan(other.id, popular.items[0].id, { returnDate: new Date(), status: 'COMPLETED' });
    const guest = await recs();
    const fresh = await recs(reader);
    for (const res of [guest, fresh]) {
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, type: 'TRENDING' });
      expect(res.body.books[0].isbn).toBe('REC-1');
      expect(res.body.books.every((b: any) => b.recommendationBadge === 'Thịnh hành')).toBe(true);
    }
  });

  test('IT-REC-02 (BOOK-03) người có lịch sử mượn → PERSONALIZED: sách cùng thể loại/tác giả xếp trước, loại sách đã mượn, nhãn "Phù hợp với bạn"', async () => {
    const borrowed = await mkBook('H-1', 'Văn học', 'Tác giả X', 1);
    await mkBook('H-2', 'Văn học', 'Người khác', 1, 'Cùng thể loại');
    await mkBook('H-3', 'Khoa học', 'Tác giả X', 1, 'Cùng tác giả');
    await mkBook('H-4', 'Kỹ năng', 'Z', 1, 'Không liên quan');
    await createLoan(reader.id, borrowed.items[0].id, { returnDate: new Date(), status: 'COMPLETED' });
    const res = await recs(reader);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('PERSONALIZED');
    expect(res.body.reason).toContain('Văn học');
    const byIsbn = Object.fromEntries(res.body.books.map((b: any) => [b.isbn, b]));
    expect(byIsbn['H-1']).toBeUndefined(); // sách đã mượn không được gợi ý lại
    expect(byIsbn['H-2']).toMatchObject({ recommendationBadge: 'Phù hợp với bạn', recommendationReason: 'Cùng thể loại Văn học' });
    expect(byIsbn['H-3']).toMatchObject({ recommendationBadge: 'Phù hợp với bạn', recommendationReason: 'Tác giả Tác giả X' });
    expect(byIsbn['H-4']).toMatchObject({ recommendationBadge: 'Thịnh hành' });
    // Cá nhân hóa xếp trước phần bổ sung "thịnh hành".
    expect(res.body.books.map((b: any) => b.isbn).indexOf('H-4')).toBeGreaterThan(res.body.books.map((b: any) => b.isbn).indexOf('H-2'));
  });

  test('IT-REC-03 (BOOK-03) cùng một danh mục sách, người có lịch sử và người mới nhận danh sách KHÁC nhau', async () => {
    const borrowed = await mkBook('D-1', 'Văn học', 'Tác giả X', 1);
    await mkBook('D-2', 'Văn học', 'Người khác', 1);
    for (let i = 0; i < 6; i++) await mkBook(`D-F${i}`, 'Khoa học', `F${i}`, 1);
    await createLoan(reader.id, borrowed.items[0].id, { returnDate: new Date(), status: 'COMPLETED' });
    const newcomer = await createUser({ email: 'newcomer@it.local' });
    const history = await recs(reader);
    const fresh = await recs(newcomer);
    expect(history.body.type).toBe('PERSONALIZED');
    expect(fresh.body.type).toBe('TRENDING');
    expect(history.body.books.map((b: any) => b.isbn)).not.toEqual(fresh.body.books.map((b: any) => b.isbn));
  });

  test('IT-REC-04 danh sách gợi ý tối đa 10 sách', async () => {
    for (let i = 0; i < 14; i++) await mkBook(`MAX-${i}`, 'Văn học', `Tác giả ${i}`, 1);
    expect((await recs()).body.books).toHaveLength(10);
  });
});
