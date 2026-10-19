/**
 * Mục tiêu: E2E kiểm kê kho (/inventory) — quét mã vạch, chống quét trùng, đối chiếu và phân nhóm
 *   hợp lệ / thiếu / bất thường.
 * Kỹ thuật: kiểm thử web tự động trên hệ thống thật (backend thật + DB SQLite tạm); oracle = toast, bộ đếm trên giao diện
 *   và bảng kết quả trả về từ API /inventory/verify.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): INV-02, INV-03, INV-04. Sách "E2E Sách kiểm kê" có 3 bản AVAILABLE và không
 *   spec nào khác thay đổi trạng thái của nó.
 * Ranh giới: không kiểm thử xuất Excel/PDF (INV-05, DEF-003) — cần đối chiếu file/glyph, ngoài phạm vi oracle tự động.
 */
import { expect, test } from '@playwright/test';
import { BOOKS, barcodeOf, PASSWORD, USERS } from '../fixtures/testData';
import { InventoryPage } from '../pages/InventoryPage';
import { LoginPage } from '../pages/LoginPage';

const INV_1 = barcodeOf(BOOKS.inventory, 1);
const INV_2 = barcodeOf(BOOKS.inventory, 2);
const STRANGER = 'MA-LA-KHONG-TON-TAI-999';

test.beforeEach(async ({ page }) => {
  await new LoginPage(page).loginAs(USERS.admin.email, PASSWORD);
});

test('E2E-INV-03 quét cùng một mã hai lần → cảnh báo trùng, danh sách chỉ ghi nhận một lần', async ({ page }) => {
  const inventory = new InventoryPage(page);
  await inventory.goto();
  await inventory.scan(INV_1);
  await expect(page.getByText(`Đã ghi nhận mã vạch: ${INV_1}`)).toBeVisible();
  await expect(inventory.scannedCount).toContainText('1 cuốn');

  await inventory.scan(INV_1);
  await expect(page.getByText(`Mã vạch "${INV_1}" đã được quét trước đó trong đợt này!`)).toBeVisible();
  await expect(inventory.scannedCount).toContainText('1 cuốn');
});

test('E2E-INV-02/04 quét một bản hợp lệ + một mã lạ → đối chiếu: bản đã quét "hợp lệ", bản chưa quét "thiếu", mã lạ "bất thường"', async ({ page }) => {
  const inventory = new InventoryPage(page);
  await inventory.goto();
  await inventory.scan(INV_1);
  await inventory.scan(STRANGER);
  await expect(inventory.scannedCount).toContainText('2 cuốn');

  const verified = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/inventory/verify'));
  await inventory.verifyButton.click();
  const response = await verified;
  expect(response.ok()).toBe(true);
  const body = await response.json();
  // Oracle độc lập với giao diện: số liệu API khớp những gì đã quét.
  expect(body.summary.totalScanned).toBe(2);
  expect(body.matched.map((m: { barcode: string }) => m.barcode)).toContain(INV_1);
  expect(body.anomalous.map((a: { barcode: string }) => a.barcode)).toContain(STRANGER);
  expect(body.missing.map((m: { barcode: string }) => m.barcode)).toContain(INV_2);

  await expect(page.getByRole('heading', { name: 'Kết quả đối chiếu kho sách' })).toBeVisible();
  // Khi có sách thiếu/bất thường, giao diện tự mở nhóm 2 "bị thiếu" trước.
  await expect(inventory.resultRow(INV_2)).toBeVisible();
  await expect(inventory.resultRow(INV_1)).toHaveCount(0);
  // Nhóm 1: hợp lệ
  await inventory.openGroup('hợp lệ');
  await expect(inventory.resultRow(INV_1)).toBeVisible();
  await expect(inventory.resultRow(INV_1)).toContainText('Khớp kho');
  await expect(inventory.resultRow(INV_2)).toHaveCount(0);
  // Nhóm 3: bất thường
  await inventory.openGroup('bất thường');
  await expect(inventory.resultRow(STRANGER)).toBeVisible();
});

test('E2E-INV-06 chưa quét mã nào thì không thể bấm đối chiếu (nút bị vô hiệu)', async ({ page }) => {
  const inventory = new InventoryPage(page);
  await inventory.goto();
  await expect(inventory.verifyButton).toBeDisabled();
  await inventory.scan(INV_1);
  await expect(inventory.verifyButton).toBeEnabled();
  await page.getByRole('button', { name: 'Xóa danh sách tạm' }).click();
  await expect(inventory.verifyButton).toBeDisabled();
});
