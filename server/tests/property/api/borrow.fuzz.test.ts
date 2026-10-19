/**
 * Mục tiêu: P5 — fuzz đầu vào API bằng sinh dữ liệu ngẫu nhiên (fast-check) qua HTTP thật
 *   (supertest → Express → loanController → Prisma → SQLite cách ly, chạy bởi vitest.integration.config.ts).
 * Thuộc tính:
 *   P5a POST /api/loans/borrow-by-barcode với barcode/userId/days ngẫu nhiên (chuỗi, số nguyên, số thực,
 *       null, mảng, object, xen lẫn giá trị hợp lệ): server KHÔNG BAO GIỜ trả 5xx, và chỉ tạo Loan khi đầu vào
 *       hợp lệ (barcode tồn tại + userId là id độc giả thật).
 *   P5b POST /api/loans/:id/request-renew với :id ngẫu nhiên: không 5xx, không đổi renewalStatus của phiếu
 *       khi :id không trỏ đúng phiếu.
 * Cả hai thuộc tính hiện bị vi phạm (FIND-02/03/04) nên đánh dấu test.fails; phản ví dụ xem property-results.jsonl.
 * Mỗi thuộc tính chạy NUM_RUNS lượt (mặc định 500); phản ví dụ đã thu nhỏ + seed ghi vào property-results.jsonl.
 */
import fc from 'fast-check';
import request from 'supertest';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { buildApp } from '../../helpers/app';
import { bearer, createBook, createLoan, createUser, prisma, resetDatabase } from '../../helpers/factory';
import { assertIsolated } from '../../helpers/testDb';
import { checkProperty } from '../../support/propertyEvidence';

const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;
let validBarcode: string;
let renewLoanId: number;

// Giá trị "khó chịu" thường gặp khi fuzz JSON body.
const junk = fc.oneof(
  fc.string(), fc.integer(), fc.double(), fc.constant(null), fc.boolean(),
  fc.array(fc.integer(), { maxLength: 3 }), fc.dictionary(fc.string({ maxLength: 4 }), fc.integer(), { maxKeys: 2 }),
  fc.constantFrom('', ' ', '0', '-1', '1e3', '1.5', 'NaN', "' OR 1=1 --", '<script>', '١٢٣'),
);

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
  await resetDatabase();
  admin = await createUser({ email: 'admin@fuzz.local', role: 'ADMIN' });
  reader = await createUser({ email: 'reader@fuzz.local' });
  const book = await createBook('ISBN-FUZZ', 2);
  validBarcode = book.items[0].barcode;
  renewLoanId = (await createLoan(reader.id, book.items[1].id)).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('P5 — fuzz API mượn/gia hạn', () => {
  // NEW FINDING FIND-02: userId không phải số (vd "!") + barcode hợp lệ → HTTP 500 (PrismaClientValidationError).
  // NEW FINDING FIND-04: userId số thực (vd 1.5) vẫn được chấp nhận và tạo phiếu.
  test.fails('PBT-P5a borrow-by-barcode: không 5xx; chỉ tạo Loan khi barcode + userId hợp lệ', async () => {
    const barcode = fc.oneof(junk, fc.constant('__VALID__'));
    const userId = fc.oneof(junk, fc.constant('__READER__'));
    await checkProperty('PBT-P5a', fc.asyncProperty(barcode, userId, junk, async (rawBarcode, rawUserId, days) => {
      const body = {
        barcode: rawBarcode === '__VALID__' ? validBarcode : rawBarcode,
        userId: rawUserId === '__READER__' ? reader.id : rawUserId,
        days,
      };
      const before = await prisma.loan.count();
      const res = await request(app).post('/api/loans/borrow-by-barcode').set(bearer(admin)).send(body);
      const created = (await prisma.loan.count()) - before;
      const validInput = body.barcode === validBarcode && Number.isInteger(Number(body.userId)) && Number(body.userId) === reader.id
        && body.userId !== null && typeof body.userId !== 'boolean' && !Array.isArray(body.userId);
      if (created > 0) {
        // Khôi phục trạng thái cho lượt sau.
        await prisma.loan.deleteMany({ where: { bookItem: { barcode: validBarcode } } });
        await prisma.bookItem.update({ where: { barcode: validBarcode }, data: { status: 'AVAILABLE' } });
      }
      if (res.status >= 500) return false;
      return created === 0 || validInput;
    }));
  });

  // NEW FINDING FIND-03: :id vượt phạm vi số nguyên (vd 9223372036854776000) → HTTP 500.
  // NEW FINDING FIND-04: :id = "1.5" được ép kiểu và đổi renewalStatus của phiếu khác.
  test.fails('PBT-P5b request-renew với :id ngẫu nhiên: không 5xx, không đổi phiếu không liên quan', async () => {
    const id = fc.oneof(fc.string({ minLength: 1 }).map(encodeURIComponent), fc.integer().map(String), fc.double().map(String),
      fc.constantFrom('1.5', '1e3', '0x1', '-0', ' 1', 'Infinity'));
    await checkProperty('PBT-P5b', fc.asyncProperty(id, async (rawId) => {
      const res = await request(app).post(`/api/loans/${rawId}/request-renew`).set(bearer(reader)).send({ days: 14 });
      const loan = await prisma.loan.findUniqueOrThrow({ where: { id: renewLoanId } });
      if (loan.renewalStatus !== 'NONE') {
        await prisma.loan.update({ where: { id: renewLoanId }, data: { renewalStatus: 'NONE' } });
        if (Number(decodeURIComponent(rawId)) !== renewLoanId) return false;
      }
      return res.status < 500;
    }));
  });
});
