import { expect, type Locator, type Page } from '@playwright/test';

// Page Object: khu "Quét mã vạch sách" trong /borrowed (BorrowedBooks.tsx) — mượn/thu hồi bằng barcode.
// Thủ thư quét barcode cuốn sách rồi chọn độc giả trong danh sách (UI hiện không quét thẻ độc giả).
export class PosPage {
  readonly barcode: Locator;
  readonly lookup: Locator;
  readonly reader: Locator;
  readonly borrowButton: Locator;
  readonly confirmReturn: Locator;
  readonly success: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.barcode = page.getByPlaceholder(/Quét hoặc nhập mã vạch/);
    this.lookup = page.getByRole('button', { name: 'Tra cứu' });
    this.reader = page.locator('select').filter({ has: page.locator('option', { hasText: '-- Chọn độc giả --' }) });
    this.borrowButton = page.getByRole('button', { name: 'Cho mượn' }).last();
    this.confirmReturn = page.getByRole('button', { name: 'Xác nhận thu hồi' });
    this.success = page.locator('p.text-green-800');
    this.error = page.locator('p.text-red-800');
  }

  async goto() {
    await this.page.goto('/borrowed');
    await expect(this.page.getByRole('heading', { name: 'Quét mã vạch sách' })).toBeVisible();
  }

  async mode(mode: 'borrow' | 'return') {
    // Hai nút chuyển chế độ nằm đầu panel; nút "Cho mượn" thứ hai là nút xác nhận.
    await this.page.getByRole('button', { name: mode === 'borrow' ? 'Cho mượn' : 'Thu hồi', exact: true }).first().click();
  }

  async scan(barcode: string) {
    await this.barcode.fill(barcode);
    await this.barcode.press('Enter');
    await expect(this.page.getByText(barcode, { exact: true }).first()).toBeVisible();
  }

  async borrowFor(readerLabel: string) {
    await this.reader.selectOption({ label: readerLabel });
    await this.borrowButton.click();
  }
}
