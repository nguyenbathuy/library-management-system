/**
 * Mục tiêu: E2E tùy chọn giao diện — chế độ tối và ngôn ngữ được lưu lại sau khi tải lại trang.
 * Kỹ thuật: kiểm thử web tự động; oracle = class "dark" trên <html>, nhãn menu đổi ngôn ngữ, giá trị
 *   localStorage ('theme', 'language') sau reload.
 * Liên kết hộp đen: SET-01. NEW FINDING FIND-05: trang /settings trắng do Settings.tsx dùng useEffect
 *   nhưng không import (regression từ commit 90f35a26) → test.fail cho tới khi được sửa.
 */
import { expect, test } from '@playwright/test';
import { EXPECT_KNOWN_BUG, PASSWORD, USERS } from '../fixtures/testData';
import { LoginPage } from '../pages/LoginPage';
import { SettingsPage } from '../pages/SettingsPage';

test('E2E-SET-01 bật chế độ tối + đổi ngôn ngữ sang English → reload vẫn giữ nguyên', async ({ page }) => {
  test.fail(EXPECT_KNOWN_BUG, 'NEW FINDING FIND-05: /settings crash "useEffect is not defined" (regression 90f35a26)');
  await new LoginPage(page).loginAs(USERS.admin.email, PASSWORD);
  const settings = new SettingsPage(page);
  await settings.goto();
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/\bdark\b/);

  await settings.themeButton().click();
  await expect(html).toHaveClass(/\bdark\b/);
  await settings.language.selectOption('en');
  await expect(page.getByRole('link', { name: 'Browse Catalog' })).toBeVisible();

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(page.getByRole('link', { name: 'Browse Catalog' })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem('theme'), localStorage.getItem('language')])).toEqual(['dark', 'en']);
});
