import { expect, type Locator, type Page } from '@playwright/test';

// Page Object: luồng đặt trước sách.
//   - Độc giả: nút "Đặt trước" trên thẻ sách (/books); danh sách đặt trước + nút Hủy ở /profile.
//   - Thủ thư: bảng /borrowed?tab=reservations (nút "Báo có sách", "Đã nhận sách").
//   - Chuông thông báo ở Header (nút có title "Thông báo").
export class ReservationPage {
  constructor(private readonly page: Page) {}

  // ---- Độc giả: /books
  async gotoBooks(titleSearch: string) {
    await this.page.goto('/books');
    const search = this.page.getByPlaceholder('Tìm kiếm sách theo tên, tác giả, ISBN...');
    await expect(search).toBeVisible();
    await search.fill(titleSearch);
  }

  bookCard(title: string): Locator {
    return this.page.locator('h3', { hasText: title }).locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
  }

  reserveButton(title: string): Locator {
    return this.bookCard(title).getByRole('button', { name: 'Đặt trước' });
  }

  borrowButton(title: string): Locator {
    return this.bookCard(title).getByRole('button', { name: 'Mượn sách' });
  }

  // ---- Độc giả: /profile
  async gotoProfile() {
    await this.page.goto('/profile');
  }

  /** Dòng đặt trước của độc giả trong /profile (mỗi dòng là một div có tên sách). */
  myReservation(title: string): Locator {
    return this.page.locator('div.p-4', { has: this.page.locator('p.font-semibold', { hasText: title }) });
  }

  // ---- Thủ thư: /borrowed?tab=reservations
  async gotoAdminReservations() {
    await this.page.goto('/borrowed?tab=reservations');
    await expect(this.page.getByRole('columnheader', { name: 'Hành động của Thủ thư' })).toBeVisible();
  }

  adminRow(title: string, readerName: string): Locator {
    return this.page.locator('tr', { hasText: title }).filter({ hasText: readerName });
  }

  // ---- Chuông thông báo
  bell(): Locator {
    return this.page.getByTitle('Thông báo');
  }
}
