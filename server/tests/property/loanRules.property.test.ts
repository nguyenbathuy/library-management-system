/**
 * Mục tiêu: sinh test ngẫu nhiên (property-based testing) cho quy tắc tính phạt / hạn trả
 *   trong server/src/utils/loanRules.ts.
 * Kỹ thuật: fast-check sinh ngẫu nhiên ngày mượn/hạn/ngày trả (2020–2035, độ phân giải mili-giây)
 *   và hạng thành viên; mỗi thuộc tính chạy NUM_RUNS (mặc định 500) lượt; khi vi phạm, fast-check
 *   tự THU NHỎ (shrink) đầu vào về phản ví dụ tối giản và ghi seed để tái hiện.
 * Thuộc tính (theo brief): P1 trả không trễ → 0; P2 trả trễ → ceil(số ngày trễ) × 5.000 và > 0;
 *   P3 đơn điệu; P4 hạn trả = 14/30/60 ngày theo hạng. Bổ sung P0 tương đương với biểu thức inline
 *   trước khi tách hàm (bằng chứng refactor giữ nguyên hành vi) và P6 bội số của mức phạt.
 * Kết quả từng thuộc tính (seed, counterexample) ghi vào <run-dir>/property-results.jsonl.
 * P5 (fuzz API) nằm ở tests/property/api/borrow.fuzz.test.ts vì cần server + SQLite cách ly.
 */
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { calculateDueDate, calculateFine, calculateRenewedDueDate } from '../../src/utils/loanRules';
import { checkProperty } from '../support/propertyEvidence';

const DAY = 24 * 60 * 60 * 1000;
const date = fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2035-12-31T00:00:00Z'), noInvalidDate: true });
const tier = fc.constantFrom('STANDARD', 'PREMIUM', 'LECTURER');
const PERIOD: Record<string, number> = { STANDARD: 14, PREMIUM: 30, LECTURER: 60 };

// Biểu thức inline của loanController tại commit 90f35a26 (trước khi tách loanRules.ts).
function legacyReturnFine(due: Date, now: Date) {
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let calculatedFine = 0;
  if (diffDays < 0) calculatedFine = Math.max(calculatedFine, Math.abs(diffDays) * 5000);
  return calculatedFine;
}
function legacyDueDate(borrow: Date) {
  const dueDate = new Date(borrow);
  dueDate.setDate(dueDate.getDate() + 14);
  return dueDate;
}

describe('P0 — refactor giữ nguyên hành vi', () => {
  test('PBT-P0 calculateFine/calculateDueDate trùng biểu thức inline cũ trên mọi đầu vào', async () => {
    await checkProperty('PBT-P0', fc.property(date, fc.integer({ min: -90 * DAY, max: 90 * DAY }), tier, (due, offset, t) => {
      const returned = new Date(due.getTime() + offset);
      return calculateFine(due, returned) === legacyReturnFine(due, returned)
        && calculateDueDate(due, t).getTime() === legacyDueDate(due).getTime();
    }));
  });
});

describe('Tiền phạt trễ hạn', () => {
  test('PBT-P1 mọi returnDate ≤ dueDate → phạt = 0', async () => {
    await checkProperty('PBT-P1', fc.property(date, fc.integer({ min: 0, max: 365 * DAY }), (due, early) =>
      calculateFine(due, new Date(due.getTime() - early)) === 0));
  });

  // NEW FINDING FIND-01: fast-check thu nhỏ được phản ví dụ "trễ 1 ms → phạt 0".
  test.fails('PBT-P2 mọi returnDate > dueDate → phạt = ceil(số ngày trễ) × 5.000 và > 0 (FIND-01)', async () => {
    await checkProperty('PBT-P2', fc.property(date, fc.integer({ min: 1, max: 365 * DAY }), (due, late) => {
      const fine = calculateFine(due, new Date(due.getTime() + late));
      return fine === Math.ceil(late / DAY) * 5000 && fine > 0;
    }));
  });

  test('PBT-P2b trễ tròn k ngày (k ≥ 1) → phạt = k × 5.000', async () => {
    await checkProperty('PBT-P2b', fc.property(date, fc.integer({ min: 1, max: 365 }), (due, k) =>
      calculateFine(due, new Date(due.getTime() + k * DAY)) === k * 5000));
  });

  test('PBT-P3 đơn điệu: trả muộn hơn thì phạt không nhỏ hơn', async () => {
    await checkProperty('PBT-P3', fc.property(date, fc.integer({ min: -60 * DAY, max: 365 * DAY }), fc.integer({ min: 0, max: 60 * DAY }), (due, offset, extra) => {
      const first = new Date(due.getTime() + offset);
      const later = new Date(first.getTime() + extra);
      return calculateFine(due, later) >= calculateFine(due, first);
    }));
  });

  test('PBT-P6 phạt luôn là số nguyên không âm và là bội số của mức phạt/ngày', async () => {
    await checkProperty('PBT-P6', fc.property(date, date, fc.integer({ min: 1, max: 100000 }), (due, returned, rate) => {
      const fine = calculateFine(due, returned, rate);
      return Number.isInteger(fine) && fine >= 0 && fine % rate === 0;
    }));
  });
});

describe('Hạn trả', () => {
  test('PBT-P4a hạng STANDARD → đúng 14 ngày lịch, giữ nguyên giờ', async () => {
    await checkProperty('PBT-P4a', fc.property(date, (borrow) => {
      const due = calculateDueDate(borrow, 'STANDARD');
      return Math.round((due.getTime() - borrow.getTime()) / DAY) === 14 && due.getMinutes() === borrow.getMinutes();
    }));
  });

  // KNOWN BUG DEF-005
  test.fails('PBT-P4 mọi hạng → calculateDueDate(d, tier) − d = 14/30/60 ngày (DEF-005)', async () => {
    await checkProperty('PBT-P4', fc.property(date, tier, (borrow, t) =>
      Math.round((calculateDueDate(borrow, t).getTime() - borrow.getTime()) / DAY) === PERIOD[t]));
  });

  // KNOWN BUG DEF-008
  test.fails('PBT-P7 duyệt gia hạn → hạn mới = hạn cũ + 14 ngày (DEF-008)', async () => {
    await checkProperty('PBT-P7', fc.property(date, (due) =>
      Math.round((calculateRenewedDueDate(due).getTime() - due.getTime()) / DAY) === 14));
  });
});
