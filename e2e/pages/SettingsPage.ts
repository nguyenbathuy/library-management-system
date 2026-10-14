import { expect, type Locator, type Page } from '@playwright/test';

// Page Object: /settings (Settings.tsx) — giao diện sáng/tối, ngôn ngữ, đổi mật khẩu.
export class SettingsPage {
  readonly language: Locator;
  private readonly pageErrors: string[] = [];

  constructor(private readonly page: Page) {
    this.language = page.locator('select').filter({ has: page.locator('option[value="en"]') });
    page.on('pageerror', (error) => this.pageErrors.push(error.message));
  }

  async goto() {
    await this.page.goto('/settings');
    try {
      await expect(this.language).toBeVisible();
    } catch (error) {
      // Nêu rõ lỗi runtime của trang (nếu có) thay vì chỉ "không tìm thấy phần tử".
      throw new Error(`Trang Cài đặt không hiển thị. Lỗi JavaScript trên trang: ${this.pageErrors.join(' | ') || 'không có'}\n${error}`);
    }
  }

  themeButton() {
    return this.page.getByRole('button', { name: /^(☀️|🌙) / });
  }

  async changePassword(current: string, next: string) {
    await this.page.getByRole('button', { name: 'Thay đổi' }).click();
    await this.page.getByPlaceholder('Nhập mật khẩu đang sử dụng').fill(current);
    await this.page.getByPlaceholder('Nhập mật khẩu mới').fill(next);
    await this.page.getByPlaceholder('Nhập lại mật khẩu mới').fill(next);
    await this.page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
  }
}
