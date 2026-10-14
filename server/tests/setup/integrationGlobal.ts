// Vitest globalSetup cho kiểm thử tích hợp: tạo một lần DB mẫu (chỉ cấu trúc) dưới server/tests/tmp/.
import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { createTemplateDatabase, PRODUCTION_DB, TMP_DIR } from '../helpers/testDb';

const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

export default function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  const productionHashBefore = hash(PRODUCTION_DB);
  const template = createTemplateDatabase(`template-${process.pid}`);
  provide('templateDb', template);
  return () => {
    rmSync(TMP_DIR, { recursive: true, force: true });
    // Bảo toàn: dev.db không đổi trong suốt lượt chạy (không chứng minh là không có thao tác đọc).
    if (hash(PRODUCTION_DB) !== productionHashBefore) {
      throw new Error('server/prisma/dev.db changed during the integration run');
    }
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    templateDb: string;
  }
}
