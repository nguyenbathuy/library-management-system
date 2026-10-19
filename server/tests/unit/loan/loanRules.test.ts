/**
 * Mục tiêu: kiểm thử đơn vị các quy tắc nghiệp vụ mượn/trả đã tách khỏi loanController
 *   (server/src/utils/loanRules.ts): tiền phạt trễ hạn, hạn trả theo hạng, hạn sau gia hạn.
 * Kỹ thuật: phân vùng tương đương (trả sớm / đúng hạn / trễ) + phân tích giá trị biên
 *   (trễ 1 ms, đúng 1/2/3/5/30 ngày, qua nửa đêm, năm nhuận), hàm thuần nên không cần mock.
 * Oracle: đặc tả Chương 2 (5.000 VNĐ/ngày; STANDARD 14 / PREMIUM 30 / LECTURER 60 ngày) và
 *   brief của nhóm (gia hạn +14 ngày; phạt = ceil(số ngày trễ) × 5.000).
 * Liên kết hộp đen (theo brief, chưa đối chiếu nội dung từng ca Chương 3): RET-02/03/04, BOR-09.
 * Ca `test.fails` = đặc tả đúng nhưng hệ thống hiện sai → bộ test vẫn xanh, lỗi vẫn được ghi nhận.
 * Múi giờ cố định Asia/Ho_Chi_Minh (vitest.backend.config.ts) để phép cộng ngày lặp lại được.
 */
import { describe, expect, test } from 'vitest';
import {
  calculateDueDate,
  calculateFine,
  calculateRenewedDueDate,
  daysUntilDue,
  FINE_PER_DAY,
} from '../../../src/utils/loanRules';

const DAY = 24 * 60 * 60 * 1000;
const DUE = new Date('2026-10-20T10:00:00+07:00');
const after = (ms: number) => new Date(DUE.getTime() + ms);
const wholeDaysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY);

describe('calculateFine — phân vùng tương đương và giá trị biên', () => {
  test('UT-FINE-01 trả sớm 3 ngày → 0 đ', () => {
    expect(calculateFine(DUE, after(-3 * DAY))).toBe(0);
  });

  test('UT-FINE-02 trả đúng thời điểm dueDate (cùng giờ phút giây) → 0 đ', () => {
    expect(calculateFine(DUE, new Date(DUE))).toBe(0);
  });

  test.each([
    ['UT-FINE-03', 1, 5000],
    ['UT-FINE-04', 2, 10000],
    ['UT-FINE-05', 3, 15000],
    ['UT-FINE-06', 5, 25000],
    ['UT-FINE-07', 30, 150000],
  ])('%s trễ tròn %i ngày → %i đ', (_id, days, expected) => {
    expect(calculateFine(DUE, after(days * DAY))).toBe(expected);
  });

  test('UT-FINE-08 năm nhuận: hạn 28/02/2028, trả 01/03/2028 cùng giờ → trễ 2 ngày = 10.000 đ', () => {
    const due = new Date('2028-02-28T09:00:00+07:00');
    const returned = new Date('2028-03-01T09:00:00+07:00');
    expect(calculateFine(due, returned)).toBe(10000);
  });

  test('UT-FINE-09 mức phạt tùy chỉnh: 1.000 đ/ngày × trễ 3 ngày → 3.000 đ', () => {
    expect(calculateFine(DUE, after(3 * DAY), 1000)).toBe(3000);
  });

  test('UT-FINE-10 hằng số mức phạt mặc định đúng đặc tả 5.000 đ/ngày', () => {
    expect(FINE_PER_DAY).toBe(5000);
  });

  // NEW FINDING FIND-01 (cần nhóm xác nhận): trễ chưa đủ 24 giờ hiện bị làm tròn về 0 ngày,
  // trái với quy tắc ceil(số ngày trễ) × 5.000 trong brief.
  test.fails('UT-FINE-11 trễ 1 ms → theo đặc tả ceil = 1 ngày = 5.000 đ (FIND-01)', () => {
    expect(calculateFine(DUE, after(1))).toBe(5000);
  });

  test.fails('UT-FINE-12 trễ 1 ngày + 1 giờ → theo đặc tả ceil = 2 ngày = 10.000 đ (FIND-01)', () => {
    expect(calculateFine(DUE, after(DAY + 60 * 60 * 1000))).toBe(10000);
  });

  test.fails('UT-FINE-13 qua nửa đêm: hạn 23:59, trả 00:01 hôm sau → phạt 5.000 đ (FIND-01)', () => {
    const due = new Date('2026-10-20T23:59:00+07:00');
    const returned = new Date('2026-10-21T00:01:00+07:00');
    expect(calculateFine(due, returned)).toBe(5000);
  });
});

describe('daysUntilDue — dấu và làm tròn', () => {
  test('UT-DAYS-01 còn 2 ngày → 2; quá 2 ngày → -2; đúng hạn → 0', () => {
    expect(daysUntilDue(DUE, after(-2 * DAY))).toBe(2);
    expect(daysUntilDue(DUE, after(2 * DAY))).toBe(-2);
    expect(daysUntilDue(DUE, DUE)).toBe(0);
  });
});

describe('calculateDueDate — hạn trả theo hạng thành viên', () => {
  const BORROW = new Date('2026-10-14T08:30:00+07:00');

  test('UT-DUE-01 STANDARD → borrowDate + 14 ngày, giữ nguyên giờ mượn', () => {
    const due = calculateDueDate(BORROW, 'STANDARD');
    expect(wholeDaysBetween(BORROW, due)).toBe(14);
    expect(due.toISOString()).toBe('2026-10-28T01:30:00.000Z');
  });

  test('UT-DUE-02 không truyền hạng → mặc định như STANDARD (+14 ngày)', () => {
    expect(wholeDaysBetween(BORROW, calculateDueDate(BORROW))).toBe(14);
  });

  test('UT-DUE-03 qua ngày nhuận: mượn 20/02/2028 STANDARD → hạn 05/03/2028', () => {
    const due = calculateDueDate(new Date('2028-02-20T10:00:00+07:00'), 'STANDARD');
    expect(due.toISOString()).toBe('2028-03-05T03:00:00.000Z');
  });

  test('UT-DUE-04 không làm thay đổi đối tượng Date đầu vào', () => {
    const input = new Date(BORROW);
    calculateDueDate(input, 'STANDARD');
    expect(input.getTime()).toBe(BORROW.getTime());
  });

  // KNOWN BUG DEF-005: mọi hạng đều nhận +14 ngày.
  test.fails('UT-DUE-05 PREMIUM → borrowDate + 30 ngày (DEF-005)', () => {
    expect(wholeDaysBetween(BORROW, calculateDueDate(BORROW, 'PREMIUM'))).toBe(30);
  });

  // KNOWN BUG DEF-005
  test.fails('UT-DUE-06 LECTURER → borrowDate + 60 ngày (DEF-005)', () => {
    expect(wholeDaysBetween(BORROW, calculateDueDate(BORROW, 'LECTURER'))).toBe(60);
  });
});

describe('calculateRenewedDueDate — hạn mới khi duyệt gia hạn', () => {
  const CURRENT_DUE = new Date('2026-10-28T08:30:00+07:00');

  test('UT-RNW-01 không làm thay đổi dueDate đầu vào', () => {
    const input = new Date(CURRENT_DUE);
    calculateRenewedDueDate(input);
    expect(input.getTime()).toBe(CURRENT_DUE.getTime());
  });

  // Bổ sung sau mutation testing lần 1: hai ca DEF-008 là test.fails nên không "giết" được đột biến
  // đổi dấu/xóa thân hàm. Oracle trung tính (đúng cho cả +7 lẫn +14): gia hạn phải lùi hạn về sau, giữ giờ.
  test('UT-RNW-03 hạn mới sau hạn cũ ít nhất 1 ngày và giữ nguyên giờ trả', () => {
    const renewed = calculateRenewedDueDate(CURRENT_DUE);
    expect(wholeDaysBetween(CURRENT_DUE, renewed)).toBeGreaterThanOrEqual(1);
    expect(renewed.toISOString().slice(11)).toBe(CURRENT_DUE.toISOString().slice(11));
  });

  // KNOWN BUG DEF-008: hệ thống cộng +7 ngày.
  test.fails('UT-RNW-02 duyệt gia hạn → dueDate + 14 ngày (DEF-008)', () => {
    expect(wholeDaysBetween(CURRENT_DUE, calculateRenewedDueDate(CURRENT_DUE))).toBe(14);
  });
});
