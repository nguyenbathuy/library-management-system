# Validation — chuẩn hóa văn phong báo cáo Nhóm 8

Ngày kiểm tra: 13/10/2026 (Asia/Ho_Chi_Minh).

## Tệp và checksum

- Tệp được cập nhật trực tiếp: `docs/qa/input/Nhom8-DGVKDCLPM_bao-cao-dang-test.docx`.
- Backup trước khi sửa văn phong: `docs/qa/output/backups/Nhom8-DGVKDCLPM_before_plain_language_20261012_234700.docx`.
- SHA256 trước: `9e9186f68646a2c2a9effe641fb349f237e04fbd28250bfd2d695037ce3cf265`.
- SHA256 sau: `d210fd9bb9c1e06f8d577873e13803a252906d5dc5cd0a8aaefb83a87948f2a3`.
- Tệp đích và backup đều vượt qua kiểm tra ZIP/OOXML.

## Nội dung đã chỉnh

- Viết lại phần phạm vi kiểm thử hộp trắng theo nhóm chức năng thay vì liệt kê đường dẫn tệp mã nguồn.
- Loại bỏ đường dẫn nội bộ đến mã nguồn, cấu hình và thư mục minh chứng khỏi nội dung báo cáo.
- Thay các mô tả kiểu nhật ký kỹ thuật bằng câu văn nêu mục đích, cách thực hiện và giới hạn của kiểm thử.
- Việt hóa các nhãn như mã ca kiểm thử, mã lỗi, kết quả đạt/không đạt, phạm vi đo và mức độ bao phủ.
- Giải thích ý nghĩa của câu lệnh, nhánh quyết định, hàm và dòng lệnh trước khi giới hạn kết luận coverage.
- Diễn đạt lại sơ đồ luồng theo các bước và nhánh “Có/Không” để người đọc không cần biết cú pháp lập trình.
- Thay đường dẫn màn hình bằng tên chức năng như Đăng nhập, Thành viên, Mượn/Trả, Kiểm kê và Cài đặt.
- Giữ các mã Test ID, Defect ID, số liệu thực thi, tỷ lệ coverage và trạng thái DEF-002 để bảo đảm truy vết.

## Kiểm tra cấu trúc và trình bày

- LibreOffice mở và render lại chính tệp đích thành công: 43 trang A4.
- Mục lục vẫn trỏ đến Chương 3 ở trang 11, Chương 4 ở trang 22 và Chương 5 ở trang 27.
- Giữ nguyên 27 bảng, 690 ô, 2 hình minh chứng và 5 section.
- Chỉ `word/document.xml` thay đổi so với backup; ảnh, styles, header và các thành phần còn lại được giữ nguyên.
- Định dạng chữ đen, nền trắng và viền bảng đen được giữ nguyên.
- Không còn tham chiếu nội bộ dạng đường dẫn mã nguồn, thư mục QA, tệp TypeScript, tệp cấu hình hoặc đường dẫn màn hình trong nội dung render.
- Font Unicode được nhúng trong PDF; không có ký tự thay thế `U+FFFD`.
- Đã kiểm tra trực quan hai trang tổng hợp Chương 3 và toàn bộ Chương 4; bảng, caption và ngắt trang vẫn đọc được.

## Giới hạn

Đây là thay đổi văn phong và cách trình bày. Không chạy lại kiểm thử, không thay đổi số liệu, trạng thái lỗi, mã nguồn, Unit Test, evidence hoặc cơ sở dữ liệu. Các tên công cụ và mã giá trị nghiệp vụ như Vitest, V8, LECTURER, PREMIUM và STANDARD được giữ khi cần để truy vết.
