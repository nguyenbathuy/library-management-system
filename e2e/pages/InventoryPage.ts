import { expect, type Locator, type Page } from '@playwright/test';

// Page Object: /inventory (InventoryCheck.tsx) — quét mã vạch, danh sách mã tạm, đối chiếu và 3 nhóm kết quả.
export class InventoryPage {
  readonly scanInput: Locator;
  readonly verifyButton: Locator;
  readonly scannedCount: Locator;

  constructor(private readonly page: Page) {
    this.scanInput = page.getByPlaceholder(/Quét mã vạch sách/);
    this.verifyButton = page.getByRole('button', { name: 'Hoàn tất đối chiếu kho' });
    this.scannedCount = page.getByText(/^Đã quét:/);
  }

  async goto() {
    await this.page.goto('/inventory');
    await expect(this.scanInput).toBeVisible();
  }

  async scan(barcode: string) {
    await this.scanInput.fill(barcode);
    await this.scanInput.press('Enter');
  }

  /** Nút thống kê của từng nhóm: "1. Sách hợp lệ", "2. Sách bị thiếu", "3. Sách bất thường". */
  groupTile(name: 'hợp lệ' | 'bị thiếu' | 'bất thường') {
    return this.page.getByRole('button', { name: new RegExp(`Sách ${name}`) });
  }

  async openGroup(name: 'hợp lệ' | 'bị thiếu' | 'bất thường') {
    await this.groupTile(name).click();
  }

  /** Dòng của bảng kết quả theo mã vạch (các mã vừa quét là <span>, không phải <tr>). */
  resultRow(barcode: string): Locator {
    return this.page.locator('tr', { hasText: barcode });
  }
}
