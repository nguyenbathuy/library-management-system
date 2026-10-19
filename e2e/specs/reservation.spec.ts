/**
 * Mục tiêu: E2E luồng đặt trước sách hết bản — độc giả đặt trước (RES-01), đặt trùng bị chặn (RES-03), sách còn bản không có
 *   nút đặt trước (RES-02), thủ thư xử lý WAITING → NOTIFIED → FULFILLED kèm thông báo tới độc giả (RES-04, NOTI-01),
 *   độc giả hủy yêu cầu (RES-05).
 * Kỹ thuật: kiểm thử web tự động trên hệ thống thật (Vite + backend Express thật + SQLite tạm); các ca chạy NỐI TIẾP
 *   (serial) vì chia sẻ một bản ghi đặt trước; oracle = giao diện (nút/nhãn/toast) và trạng thái hiển thị sau khi tải lại.
 * Dữ liệu: "E2E Sách hết bản" có 1 bản đang được mượn bởi tài khoản khác (seed) nên 0 bản khả dụng.
 * Ranh giới: không kiểm thử cập nhật danh sách "Lịch sử mượn" sau khi nhận sách đặt trước (lỗi ghi ở Kiểm thử phần mềm.pdf:
 *   hệ thống không tự tạo phiếu mượn khi FULFILLED — yêu cầu nghiệp vụ chưa xác nhận nên ghi pending).
 */
import { expect, test } from '@playwright/test';
import { BOOKS, PASSWORD, USERS } from '../fixtures/testData';
import { LoginPage } from '../pages/LoginPage';
import { ReservationPage } from '../pages/ReservationPage';

const SOLD_OUT = BOOKS.soldout.title;
const IN_STOCK = BOOKS.inventory.title;

test.describe.configure({ mode: 'serial' });

test('E2E-RES-02 sách còn bản khả dụng → thẻ sách có "Mượn sách", KHÔNG có "Đặt trước"', async ({ page }) => {
  await new LoginPage(page).loginAs(USERS.reserver.email, PASSWORD);
  const reservations = new ReservationPage(page);
  await reservations.gotoBooks(IN_STOCK);
  await expect(reservations.borrowButton(IN_STOCK)).toBeVisible();
  await expect(reservations.reserveButton(IN_STOCK)).toHaveCount(0);
});

test('E2E-RES-01 sách hết bản → độc giả bấm "Đặt trước": báo thành công, hồ sơ có yêu cầu "Chờ nhận sách"', async ({ page }) => {
  await new LoginPage(page).loginAs(USERS.reserver.email, PASSWORD);
  const reservations = new ReservationPage(page);
  await reservations.gotoBooks(SOLD_OUT);
  await expect(reservations.borrowButton(SOLD_OUT)).toHaveCount(0);
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/reservations'));
  await reservations.reserveButton(SOLD_OUT).click();
  expect((await created).status()).toBe(201);
  await expect(page.getByText(/Đặt trước thành công/)).toBeVisible();

  await reservations.gotoProfile();
  const row = reservations.myReservation(SOLD_OUT);
  await expect(row).toBeVisible();
  await expect(row).toContainText('Chờ nhận sách');
});

test('E2E-RES-03 đặt trước lại cùng đầu sách → bị từ chối, vẫn chỉ có một yêu cầu', async ({ page }) => {
  await new LoginPage(page).loginAs(USERS.reserver.email, PASSWORD);
  const reservations = new ReservationPage(page);
  await reservations.gotoBooks(SOLD_OUT);
  const again = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/reservations'));
  await reservations.reserveButton(SOLD_OUT).click();
  expect((await again).status()).toBe(400);
  await expect(page.getByText(/Bạn đã đăng ký đặt trước đầu sách này rồi/)).toBeVisible();

  await reservations.gotoProfile();
  await expect(reservations.myReservation(SOLD_OUT)).toHaveCount(1);
});

test('E2E-RES-04 thủ thư "Báo có sách" → độc giả thấy thông báo + trạng thái đổi; "Đã nhận sách" → hoàn tất', async ({ page }) => {
  const login = new LoginPage(page);
  const reservations = new ReservationPage(page);

  // Thủ thư: WAITING → NOTIFIED
  await login.loginAs(USERS.admin.email, PASSWORD);
  await reservations.gotoAdminReservations();
  const row = reservations.adminRow(SOLD_OUT, USERS.reserver.name);
  await expect(row).toBeVisible();
  const notified = page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/api\/reservations\/\d+\/status$/.test(r.url()));
  await row.getByRole('button', { name: 'Báo có sách' }).click();
  expect((await notified).ok()).toBe(true);
  await expect(row.getByRole('button', { name: 'Đã nhận sách' })).toBeVisible();

  // Độc giả: thấy thông báo mới (NOTI-01) và trạng thái "Sách đã về"
  await login.logout(USERS.admin.name);
  await login.loginAs(USERS.reserver.email, PASSWORD);
  await reservations.bell().click();
  await expect(page.getByText('Sách đặt trước đã có sẵn!')).toBeVisible();
  await reservations.gotoProfile();
  await expect(reservations.myReservation(SOLD_OUT)).toContainText('Sách đã về - Hãy đến nhận');

  // Thủ thư: NOTIFIED → FULFILLED
  await login.logout(USERS.reserver.name);
  await login.loginAs(USERS.admin.email, PASSWORD);
  await reservations.gotoAdminReservations();
  const notifiedRow = reservations.adminRow(SOLD_OUT, USERS.reserver.name);
  await notifiedRow.getByRole('button', { name: 'Đã nhận sách' }).click();
  await expect(notifiedRow.getByRole('button')).toHaveCount(0);
  await expect(notifiedRow).toContainText('Đã nhận sách');
});

test('E2E-RES-05 độc giả hủy yêu cầu đặt trước của mình → trạng thái "Đã hủy", không còn nút Hủy', async ({ page }) => {
  await new LoginPage(page).loginAs(USERS.user.email, PASSWORD);
  const reservations = new ReservationPage(page);
  await reservations.gotoBooks(SOLD_OUT);
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/reservations'));
  await reservations.reserveButton(SOLD_OUT).click();
  expect((await created).status()).toBe(201);

  await reservations.gotoProfile();
  const row = reservations.myReservation(SOLD_OUT);
  await expect(row).toContainText('Chờ nhận sách');
  page.once('dialog', (dialog) => dialog.accept());
  const cancelled = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/api\/reservations\/\d+$/.test(r.url()));
  await row.getByRole('button', { name: 'Hủy' }).click();
  expect((await cancelled).ok()).toBe(true);
  await expect(row).toContainText('Đã hủy');
  await expect(row.getByRole('button', { name: 'Hủy' })).toHaveCount(0);
});
