import type { Page } from '@playwright/test';

// Ảnh từng bước cho các ca tiêu biểu (BOR-01, RET-01, AUTH-04) đưa vào báo cáo.
export async function snap(page: Page, caseId: string, step: string) {
  // animations: 'disabled' tua hết hiệu ứng CSS (fade-in) để ảnh chụp đúng trạng thái cuối.
  await page.screenshot({ path: `test-results/e2e/screenshots/${caseId}/${step}.png`, animations: 'disabled' });
}
