import { expect, type Locator, type Page } from '@playwright/test';

// Page Object: /profile (UserProfile.tsx) — bảng phiếu mượn của độc giả, nút "Gia hạn", cột "Hạn trả".
export class ProfilePage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/profile');
  }

  row(bookTitle: string): Locator {
    return this.page.locator('tr', { hasText: bookTitle });
  }

  /** Ô "Hạn trả" (cột thứ 3) hiển thị theo toLocaleDateString('vi-VN') → d/m/yyyy. */
  async dueDate(bookTitle: string) {
    const cell = this.row(bookTitle).locator('td').nth(2);
    await expect(cell).toHaveText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    return (await cell.innerText()).trim();
  }

  async requestRenewal(bookTitle: string) {
    await this.row(bookTitle).getByRole('button', { name: 'Gia hạn' }).click();
  }
}
