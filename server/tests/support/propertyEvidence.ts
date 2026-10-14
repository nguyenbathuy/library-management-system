import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';

// Số lần sinh ngẫu nhiên mỗi thuộc tính; seed ngẫu nhiên mỗi lượt, đặt FC_SEED để tái hiện.
export const NUM_RUNS = Number(process.env.FC_NUM_RUNS ?? 500);
const SEED = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined;

/**
 * Chạy một thuộc tính bằng fc.check, ghi kết quả (seed, số lượt, phản ví dụ đã thu nhỏ) vào
 * <LMS_WB_RUN_DIR>/property-results.jsonl, rồi ném lỗi nếu thuộc tính bị vi phạm.
 */
export async function checkProperty<Ts>(id: string, property: fc.IProperty<Ts> | fc.IAsyncProperty<Ts>, numRuns = NUM_RUNS) {
  const details = await fc.check(property as fc.IAsyncProperty<Ts>, { numRuns, seed: SEED, endOnFailure: false });
  const record = {
    id,
    recordedAt: new Date().toISOString(),
    failed: details.failed,
    numRuns: details.numRuns,
    numShrinks: details.numShrinks,
    seed: details.seed,
    counterexamplePath: details.counterexamplePath,
    counterexample: details.counterexample === null ? null : JSON.parse(JSON.stringify(details.counterexample, (_k, v) => (v instanceof Date ? v.toISOString() : v))),
    error: details.errorInstance ? String(details.errorInstance).split('\n')[0] : null,
  };
  const directory = process.env.LMS_WB_RUN_DIR ?? process.env.LMS_IT_RUN_DIR;
  if (directory) {
    mkdirSync(directory, { recursive: true });
    appendFileSync(resolve(directory, 'property-results.jsonl'), `${JSON.stringify(record)}\n`);
  }
  if (details.failed) throw new Error(fc.defaultReportMessage(details) ?? `${id} failed`);
  return record;
}
