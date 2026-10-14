import { expect, type Locator, type Page } from '@playwright/test';

// Page Object: /members (MembersManagement.tsx) — modal "Thêm thành viên mới" (không phải <form>,
// nên trình duyệt KHÔNG tự kiểm tra type="email"; nút "Lưu thành viên" gọi thẳng /auth/register).
export class MembersPage {
  readonly addButton: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly save: Locator;
  readonly tier: Locator;

  constructor(private readonly page: Page) {
    this.addButton = page.getByRole('button', { name: 'Thêm thành viên' });
    this.name = page.getByPlaceholder('Nhập họ tên độc giả...');
    this.email = page.getByPlaceholder('example@email.com');
    this.save = page.getByRole('button', { name: 'Lưu thành viên' });
    this.tier = page.locator('select').filter({ has: page.locator('option[value="LECTURER"]') });
  }

  async goto() {
    await this.page.goto('/members');
    await expect(this.addButton).toBeVisible();
  }

  async addMember(name: string, email: string) {
    await this.addButton.click();
    await this.name.fill(name);
    await this.email.fill(email);
    await this.save.click();
  }
}
