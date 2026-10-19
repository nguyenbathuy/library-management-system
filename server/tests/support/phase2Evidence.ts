import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Mock } from 'vitest';

export function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'function') return '[callback]';
    if (item instanceof Error) return { name: item.name, message: item.message };
    return item;
  }));
}

export function writeEvidence(name: string, data: unknown) {
  writeFileSync(resolve(process.env.LMS_WB_RUN_DIR!, name), JSON.stringify(data, null, 2));
}

export function callOffsets(methods: Record<string, Mock>): Record<string, number> {
  return Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, method.mock.calls.length]));
}

export async function dependencyCalls(methods: Record<string, Mock>, offsets: Record<string, number> = {}) {
  const calls: Record<string, unknown> = {};
  for (const [name, method] of Object.entries(methods)) {
    const start = offsets[name] ?? 0;
    const outcomes = await Promise.allSettled(method.mock.results.slice(start).map(async (result) => {
      if (result.type === 'throw') throw result.value;
      return await result.value;
    }));
    calls[name] = {
      arguments: snapshot(method.mock.calls.slice(start)),
      outcomes: outcomes.map((outcome) => outcome.status === 'fulfilled'
        ? { status: outcome.status, value: snapshot({ value: outcome.value }).value }
        : { status: outcome.status, error: String(outcome.reason), code: outcome.reason?.code }),
    };
  }
  return calls;
}
