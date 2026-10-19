/**
 * Mục tiêu: E2E xác thực & phân quyền trên trình duyệt thật (Chromium) với frontend + backend thật.
 * Kỹ thuật: kiểm thử web tự động theo Page Object Model; selector theo placeholder/role/text (frontend
 *   không có data-testid). Dữ liệu: tài khoản E2E 2FA tắt seed sẵn trong DB tạm (e2e/fixtures/testData.json).
 * Liên kết hộp đen: AUTH-01, AUTH-02, AUTH-04, AUTH-05.
 */
import { expect, test } from '@playwright/test';
import { EXPECT_KNOWN_BUG, PASSWORD, USERS } from '../fixtures/testData';
import { LoginPage } from '../pages/LoginPage';
import { SettingsPage } from '../pages/SettingsPage';
import { snap } from '../support/evidence';

test.describe('Xác thực', () => {
  test('E2E-AUTH-01 thủ thư đăng nhập đúng → vào Bảng điều khiển', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(USERS.admin.email, PASSWORD);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Bảng điều khiển', exact: true })).toBeVisible();
  });

  test('E2E-AUTH-02 sai mật khẩu → báo lỗi, vẫn ở trang đăng nhập', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(USERS.admin.email, 'SaiMatKhau!');
    await expect(page.getByText('Tài khoản hoặc mật khẩu không chính xác')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('E2E-AUTH-03 độc giả đăng nhập → được đưa tới Hồ sơ & Lịch sử mượn', async ({ page }) => {
    await new LoginPage(page).loginAs(USERS.user.email, PASSWORD);
    await expect(page).toHaveURL(/\/profile$/);
  });
});

test.describe('Phân quyền', () => {
  test('E2E-AUTH-04 độc giả gõ thẳng URL /members → trang 403', async ({ page }) => {
    await new LoginPage(page).loginAs(USERS.user.email, PASSWORD);
    await snap(page, 'E2E-AUTH-04', '01-dang-nhap-doc-gia');
    await page.goto('/members');
    await expect(page).toHaveURL(/\/403$/);
    await expect(page.getByRole('heading', { name: 'Quyền truy cập bị từ chối' })).toBeVisible();
    await expect(page.getByText('403 Forbidden')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm thành viên' })).toHaveCount(0);
    await snap(page, 'E2E-AUTH-04', '02-trang-403');
  });
});

test.describe('Đổi mật khẩu', () => {
  test('E2E-AUTH-05 đổi mật khẩu rồi đăng nhập lại bằng mật khẩu mới', async ({ page }) => {
    // Backend đổi mật khẩu hoạt động (IT-AUTH-05 PASS); giao diện bị chặn vì trang Cài đặt không render.
    test.fail(EXPECT_KNOWN_BUG, 'NEW FINDING FIND-05: /settings crash "useEffect is not defined" (regression 90f35a26)');
    const login = new LoginPage(page);
    const account = USERS.password;
    const newPassword = 'MoiHon@456';
    await login.loginAs(account.email, PASSWORD);
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.changePassword(PASSWORD, newPassword);
    await expect(page.getByText(/Đổi mật khẩu thành công|thành công/).first()).toBeVisible();
    await login.logout(account.name);

    await login.login(account.email, PASSWORD);
    await expect(page.getByText('Tài khoản hoặc mật khẩu không chính xác')).toBeVisible();
    await login.login(account.email, newPassword);
    await expect(page).toHaveURL(/\/profile$/);
  });
});
