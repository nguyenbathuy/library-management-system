/**
 * Mục tiêu: E2E luồng gia hạn hai vai trò: độc giả gửi yêu cầu → thủ thư duyệt → độc giả thấy hạn mới.
 * Kỹ thuật: kiểm thử web tự động nhiều phiên đăng nhập trong một ca (test.step), Page Object
 *   LoginPage/ProfilePage. Oracle hạn mới = hạn cũ + 14 ngày (brief; Chương 2 ghi "+7/+14").
 * Liên kết hộp đen: EXT-01. KNOWN BUG DEF-008 (hệ thống cộng +7) → test.fail; các bước trước khi so
 *   sánh ngày phải chạy thành công (xem trace/known-bug run với E2E_SHOW_KNOWN_BUGS=1).
 */
import { expect, test } from '@playwright/test';
import { BOOKS, EXPECT_KNOWN_BUG, PASSWORD, USERS } from '../fixtures/testData';
import { LoginPage } from '../pages/LoginPage';
import { ProfilePage } from '../pages/ProfilePage';

const parseVi = (text: string) => {
  const [d, m, y] = text.split('/').map(Number);
  return new Date(y, m - 1, d);
};
const formatVi = (date: Date) => date.toLocaleDateString('vi-VN');

test('E2E-EXT-01 độc giả gửi gia hạn → thủ thư duyệt → độc giả thấy hạn trả mới = hạn cũ + 14 ngày', async ({ page }) => {
  test.fail(EXPECT_KNOWN_BUG, 'KNOWN BUG DEF-008: duyệt gia hạn cộng +7 ngày thay vì +14');
  const login = new LoginPage(page);
  const profile = new ProfilePage(page);
  let oldDue = '';

  await test.step('Độc giả gửi yêu cầu gia hạn', async () => {
    await login.loginAs(USERS.renew.email, PASSWORD);
    await profile.goto();
    oldDue = await profile.dueDate(BOOKS.renew.title);
    await profile.requestRenewal(BOOKS.renew.title);
    await expect(page.getByText(/Đã gửi yêu cầu gia hạn/).first()).toBeVisible();
    await login.logout(USERS.renew.name);
  });

  await test.step('Thủ thư duyệt gia hạn', async () => {
    await login.loginAs(USERS.admin.email, PASSWORD);
    await page.goto('/borrowed');
    const row = page.locator('tr', { hasText: BOOKS.renew.title });
    await row.getByRole('button', { name: 'Duyệt gia hạn' }).click();
    await expect(page.getByText(/Đã phê duyệt gia hạn/).first()).toBeVisible();
    await login.logout(USERS.admin.name);
  });

  await test.step('Độc giả thấy hạn trả mới', async () => {
    await login.loginAs(USERS.renew.email, PASSWORD);
    await profile.goto();
    const newDue = await profile.dueDate(BOOKS.renew.title);
    expect(newDue).not.toBe(oldDue);
    const expected = parseVi(oldDue);
    expected.setDate(expected.getDate() + 14);
    expect(newDue).toBe(formatVi(expected));
  });
});
