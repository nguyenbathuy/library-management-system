import { expect, type Locator, type Page } from '@playwright/test';

// Page Object: /books (BooksManagement.tsx) — tra cứu, số bản khả dụng "Còn x/y", form thêm sách.
export class BooksPage {
  readonly search: Locator;
  readonly addButton: Locator;
  readonly modal: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.search = page.getByPlaceholder('Tìm kiếm sách theo tên, tác giả, ISBN...');
    this.addButton = page.getByRole('button', { name: 'Thêm sách mới' });
    this.modal = page.locator('form').filter({ has: page.getByRole('button', { name: 'Thêm sách', exact: true }) });
    this.submit = page.getByRole('button', { name: 'Thêm sách', exact: true });
  }

  async goto() {
    await this.page.goto('/books');
    await expect(this.search).toBeVisible();
  }

  /** Ô nhập theo nhãn (nhãn không có htmlFor nên dùng CSS "label + input"). */
  field(label: string) {
    return this.modal.locator(`label:has-text("${label}") + input`);
  }

  card(title: string) {
    return this.page.locator('h3', { hasText: title }).locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
  }

  async remaining(title: string) {
    await this.search.fill(title);
    return this.card(title).getByText(/^Còn \d+\/\d+$/);
  }
}
