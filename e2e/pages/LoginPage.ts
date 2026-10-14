import { expect, type Locator, type Page } from '@playwright/test';

// Page Object: màn hình /login (Login.tsx). Nhãn không gắn htmlFor nên dùng placeholder/role.
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByPlaceholder('user@library.com');
    this.password = page.getByPlaceholder('••••••••');
    this.submit = page.getByRole('button', { name: 'Đăng nhập', exact: true });
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.page.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  /** Đăng nhập và chờ rời khỏi /login. */
  async loginAs(email: string, password: string) {
    await this.goto();
    await this.login(email, password);
    await expect(this.page).not.toHaveURL(/\/login$/);
  }

  async logout(displayName: string) {
    await this.page.getByRole('button', { name: displayName }).click();
    await this.page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(this.page).toHaveURL(/\/login$/);
  }
}
