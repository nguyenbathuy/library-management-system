/**
 * Mục tiêu: E2E biểu mẫu quản trị — thêm đầu sách (hợp lệ / thiếu trường bắt buộc) và thêm thành viên
 *   với email sai định dạng.
 * Kỹ thuật: kiểm thử web tự động; phân vùng hợp lệ/không hợp lệ cho trường bắt buộc; oracle kiểm tra
 *   cả phản hồi giao diện lẫn dữ liệu sau khi tải lại trang.
 * Liên kết hộp đen: BOOK-04, BOOK-05, MEM-02 (DEF-001 → test.fail).
 */
import { expect, test } from '@playwright/test';
import { EXPECT_KNOWN_BUG, PASSWORD, USERS } from '../fixtures/testData';
import { BooksPage } from '../pages/BooksPage';
import { LoginPage } from '../pages/LoginPage';
import { MembersPage } from '../pages/MembersPage';

test.beforeEach(async ({ page }) => {
  await new LoginPage(page).loginAs(USERS.admin.email, PASSWORD);
});

test.describe('Thêm sách', () => {
  test('E2E-BOOK-04 thêm sách đủ trường bắt buộc → thông báo thành công, sách xuất hiện với Còn 2/2', async ({ page }) => {
    const books = new BooksPage(page);
    await books.goto();
    await books.addButton.click();
    await books.field('Tiêu đề').fill('E2E Sách thêm mới');
    await books.field('Tác giả').fill('Tác giả E2E');
    await books.field('ISBN').fill('ISBN-E2E-NEW-01');
    await books.field('Thể loại').fill('Kiểm thử E2E');
    await books.field('Số lượng').fill('2');
    await books.field('Còn lại').fill('2');
    const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/books$/.test(r.url()));
    await books.submit.click();
    expect((await created).ok()).toBe(true);
    await expect(page.getByText('Đã thêm sách mới và 2 bản sao vào kho')).toBeVisible();
    await page.reload();
    await expect(await books.remaining('E2E Sách thêm mới')).toHaveText('Còn 2/2');
  });

  test('E2E-BOOK-05 bỏ trống Tiêu đề → trình duyệt chặn gửi, không gọi API tạo sách', async ({ page }) => {
    const books = new BooksPage(page);
    const createRequests: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/api\/books$/.test(request.url())) createRequests.push(request.url());
    });
    await books.goto();
    await books.addButton.click();
    await books.field('Tác giả').fill('Tác giả E2E');
    await books.field('ISBN').fill('ISBN-E2E-NEW-02');
    await books.field('Thể loại').fill('Kiểm thử E2E');
    await books.submit.click();
    expect(await books.field('Tiêu đề').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    await expect(books.submit).toBeVisible();
    await page.waitForTimeout(1000);
    expect(createRequests).toEqual([]);
  });
});

test.describe('Thêm thành viên', () => {
  test('E2E-MEM-02 email thiếu "@" → phải bị chặn, không tạo tài khoản', async ({ page }) => {
    test.fail(EXPECT_KNOWN_BUG, 'KNOWN BUG DEF-001: form chấp nhận email sai định dạng');
    const members = new MembersPage(page);
    const badEmail = 'e2e-email-khong-hop-le';
    await members.goto();
    const register = page.waitForResponse((response) => response.url().endsWith('/api/auth/register'), { timeout: 5000 }).catch(() => null);
    await members.addMember('Thành viên email sai', badEmail);
    const response = await register;
    // Bị chặn = không gửi request, hoặc server từ chối (4xx).
    expect(response === null || response.status() >= 400, `register phải bị chặn; thực tế HTTP ${response?.status()}`).toBe(true);
    await page.reload();
    await expect(page.getByText(badEmail)).toHaveCount(0);
  });
});
