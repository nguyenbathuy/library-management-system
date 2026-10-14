# Validation — chuẩn hóa báo cáo Nhóm 8 sang chữ đen, nền trắng

Ngày kiểm tra: 12/10/2026 (Asia/Ho_Chi_Minh).

> Lưu ý: checksum “sau” dưới đây là ảnh chụp lịch sử ngay sau bước chuẩn hóa màu. Tệp đích đã được chỉnh tiếp về văn phong ngày 13/10/2026; xem [Readability validation](Nhom8_Report_Readability_Validation.md) để biết checksum hiện tại.

## Tệp và checksum

- Tệp được cập nhật trực tiếp: `docs/qa/input/Nhom8-DGVKDCLPM_bao-cao-dang-test.docx`.
- Backup ngay trước khi đổi định dạng: `docs/qa/output/backups/Nhom8-DGVKDCLPM_before_monochrome_20261012_232507.docx`.
- SHA256 trước: `6acb9d4b79608e55557a70295e6b24071d8373b1b34e2bf836093a65124f6048`.
- SHA256 sau: `9e9186f68646a2c2a9effe641fb349f237e04fbd28250bfd2d695037ce3cf265`.
- Cả tệp đích và backup vượt qua kiểm tra ZIP/OOXML; tệp đích được LibreOffice mở và render lại thành PDF thành công.

## Định dạng đã chuẩn hóa

- Toàn bộ 221 khai báo nền bảng/đoạn trong tài liệu được đặt thành màu trắng `FFFFFF`; không còn fill xanh hoặc xám.
- Màu chữ khai báo trực tiếp và các style có màu riêng, gồm TOC, hyperlink, subtitle và unresolved mention, được đặt thành đen `000000`.
- 156 khai báo đường viền bảng trong nội dung/style được đặt thành đen `000000`.
- Các ô không có khai báo fill tiếp tục dùng nền trắng mặc định của tài liệu.
- Ảnh minh chứng nhúng được giữ nguyên để bảo toàn evidence; chúng không được dùng làm màu nền hoặc màu trang trí của báo cáo.

## Kiểm tra bảo toàn

- Số trang giữ nguyên: 43 trang A4.
- Số bảng giữ nguyên: 27; số ô giữ nguyên: 690.
- Số hình/drawing giữ nguyên: 2; nội dung hai tệp media giữ nguyên byte.
- Số section giữ nguyên: 5.
- Nội dung text, field instruction, bảng, ô, drawing và section được đối chiếu với backup, không thay đổi.
- Gói DOCX chỉ thay đổi `word/document.xml` và `word/styles.xml`; các thành phần còn lại giữ nguyên byte.
- PDF dùng font Unicode embedded và không có ký tự thay thế `U+FFFD`.

## Kiểm tra trực quan

- Trang tài liệu số 24, chứa Bảng 4.6–4.8 tương ứng mẫu người dùng cung cấp, đã được render và kiểm tra trực quan.
- Hàng tiêu đề, hàng dữ liệu và vùng nội dung đều có nền trắng; chữ và đường kẻ bảng màu đen.
- Ảnh raster của trang kiểm tra có `0` pixel ngoài thang xám, xác nhận không còn màu xanh ở trang mẫu.

## Giới hạn

Đây là thay đổi trình bày. Không chạy lại testcase, không sửa kết quả, Expected Result, execution evidence, source, Unit Test, schema hoặc database. Các ảnh minh chứng gốc có thể chứa màu từ giao diện được chụp và được giữ nguyên để tránh làm biến đổi evidence.
