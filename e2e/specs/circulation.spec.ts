/**
 * Mục tiêu: E2E lưu thông sách tại quầy (POS) — mượn/thu hồi bằng mã vạch và tác động tới số bản khả dụng.
 * Kỹ thuật: kiểm thử web tự động (Playwright, Page Object PosPage/BooksPage), dữ liệu seed riêng cho
 *   từng ca (mỗi ca dùng một barcode khác nhau) nên các ca độc lập về dữ liệu dù chạy tuần tự.
 * Liên kết hộp đen: BOR-01, BOR-06, RET-01, RET-10 (theo mô tả trong brief).
 * Ảnh từng bước của BOR-01 và RET-01: test-results/e2e/screenshots/.
 */
import { expect, test } from '@playwright/test';
import { barcodeOf, BOOKS, PASSWORD, USERS } from '../fixtures/testData';
import { BooksPage } from '../pages/BooksPage';
import { LoginPage } from '../pages/LoginPage';
import { PosPage } from '../pages/PosPage';
import { snap } from '../support/evidence';

test.beforeEach(async ({ page }) => {
  await new LoginPage(page).loginAs(USERS.admin.email, PASSWORD);
});

test.describe('Mượn sách', () => {
  test('E2E-BOR-01 quét barcode sách + chọn độc giả → thông báo thành công, số khả dụng giảm 1', async ({ page }) => {
    const books = new BooksPage(page);
    const pos = new PosPage(page);
    await books.goto();
    await expect(await books.remaining(BOOKS.borrow.title)).toHaveText('Còn 3/3');
    await snap(page, 'E2E-BOR-01', '01-truoc-khi-muon-con-3-3');

    await pos.goto();
    await pos.scan(barcodeOf(BOOKS.borrow, 1));
    await expect(page.getByText('Sẵn sàng')).toBeVisible();
    await snap(page, 'E2E-BOR-01', '02-quet-barcode-san-sang');
    await pos.borrowFor(`${USERS.user.name} (${USERS.user.email})`);
    await expect(pos.success).toContainText(`Cho mượn thành công: "${BOOKS.borrow.title}" → ${USERS.user.name}`);
    await snap(page, 'E2E-BOR-01', '03-cho-muon-thanh-cong');

    await books.goto();
    await expect(await books.remaining(BOOKS.borrow.title)).toHaveText('Còn 2/3');
    await snap(page, 'E2E-BOR-01', '04-sau-khi-muon-con-2-3');
  });
});

test('E2E-BOR-06 quét cuốn đang BORROWED ở chế độ cho mượn → bị chặn, không có nút xác nhận', async ({ page }) => {
  const pos = new PosPage(page);
  await pos.goto();
  await pos.mode('borrow');
  await pos.scan(barcodeOf(BOOKS.loaned, 3));
  await expect(page.getByText('Đang mượn', { exact: true })).toBeVisible();
  await expect(page.getByText(/Cuốn sách này đang được mượn/)).toBeVisible();
  await expect(pos.reader).toHaveCount(0);
});

test.describe('Thu hồi sách', () => {
  test('E2E-RET-01 thu hồi sách đúng hạn → hoàn tất, sách về trạng thái Sẵn sàng', async ({ page }) => {
    const pos = new PosPage(page);
    const barcode = barcodeOf(BOOKS.loaned, 1);
    await pos.goto();
    await pos.mode('return');
    await pos.scan(barcode);
    await expect(page.getByText(`Đang được mượn bởi: ${USERS.user.name}`)).toBeVisible();
    await snap(page, 'E2E-RET-01', '01-quet-sach-dang-muon');
    await pos.confirmReturn.click();
    await expect(pos.success).toContainText(`Thu hồi thành công: "${BOOKS.loaned.title}" từ ${USERS.user.name}`);
    await expect(pos.success).not.toContainText('Phạt trễ hạn');
    await snap(page, 'E2E-RET-01', '02-thu-hoi-thanh-cong');

    await pos.scan(barcode);
    await expect(page.getByText('Sẵn sàng', { exact: true })).toBeVisible();
    await snap(page, 'E2E-RET-01', '03-sach-ve-san-sang');
  });

  test('E2E-RET-10 thu hồi lần 2 cùng một cuốn → báo không còn phiếu cần thu hồi', async ({ page }) => {
    const pos = new PosPage(page);
    const barcode = barcodeOf(BOOKS.loaned, 2);
    await pos.goto();
    await pos.mode('return');
    await pos.scan(barcode);
    await pos.confirmReturn.click();
    await expect(pos.success).toContainText('Thu hồi thành công');

    await pos.scan(barcode);
    await expect(page.getByText(/không có phiếu mượn nào cần thu hồi/)).toBeVisible();
    await expect(pos.confirmReturn).toHaveCount(0);
  });
});
