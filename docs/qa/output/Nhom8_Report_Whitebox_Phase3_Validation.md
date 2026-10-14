# Validation — cập nhật báo cáo Nhóm 8 với Manual v2 và White-box Phase 3

Ngày kiểm tra: 12/10/2026 (Asia/Ho_Chi_Minh).

## Tệp và checksum

- Tệp được cập nhật trực tiếp: `docs/qa/input/Nhom8-DGVKDCLPM_bao-cao-dang-test.docx`.
- Backup trước chỉnh sửa: `docs/qa/output/backups/Nhom8-DGVKDCLPM_before_whitebox_phase3_20261012_230319.docx`.
- SHA256 trước: `79ed23a92868a83dad1467d14dc5089673bc8ee5aa994c5621e8d57a046860ab`.
- SHA256 sau: `6acb9d4b79608e55557a70295e6b24071d8373b1b34e2bf836093a65124f6048`.
- Cả hai file vượt qua kiểm tra ZIP/OOXML và được LibreOffice 7.3 mở/render thành PDF.

## Phạm vi cập nhật

- Chương 3: cập nhật Actual Result, Status và Evidence/Mã lỗi cho 44 testcase từ `Manual_Test_Results_v2.xlsx`; giữ nguyên 44 Expected Result. Cập nhật mục 3.4 và bổ sung 3.5–3.7 về kết quả thực thi, defect summary, evidence và 11 testcase chưa kết luận.
- Chương 4: hoàn thiện mục 4.1–4.12 về mục tiêu, phạm vi Authentication/Member, Vitest/V8, mock Prisma, cách ly database, phân tích source, CFG dạng bảng nút/cạnh, thiết kế test, execution, coverage, condition ledger, DEF-002 và giới hạn.
- Mục lục: cập nhật 81 liên kết heading và số trang, bao gồm các mục mới của Chương 3–4.
- Bảng: từ 15 lên 27; thêm 12 bảng có caption. Không thêm hình; hai ảnh gốc được giữ nguyên.

## Kết quả được ghi vào báo cáo

- Manual Testing: 44 testcase; 30 PASS; 3 FAIL; 0 BLOCKED; 0 NOT RUN; 11 chưa có trạng thái chính thức và mang cờ NEEDS REVIEW.
- White-box: Phase 1 `15 PASS`; Phase 2 `25 PASS`; Phase 3 `23 PASS, 2 FAIL`; tổng `65` Test ID distinct, `63 PASS, 2 FAIL, 0 SKIPPED`.
- Hai FAIL là WB-RG-04/WB-RG-05, cùng DEF-002. Kết luận giới hạn ở controller → Prisma call; trạng thái OPEN; chưa xác nhận SQLite persistence/default hoặc UI E2E.
- Coverage được ghi đúng các scope Authentication, Member run toàn ba source files, Combined và selected Member function bodies. Condition ledger thủ công được tách khỏi V8 Branch Coverage.

## Kiểm tra bảo toàn và bố cục

- Số trang: `34 → 43`, khổ A4.
- Package có 30 thành phần trước/sau; 29 thành phần giữ nguyên checksum, chỉ `word/document.xml` thay đổi.
- Header XML: `5 → 5`; media: `2 → 2`; styles, numbering, relationships, embedded fonts, custom XML, header/footer liên quan và ảnh giữ nguyên byte.
- Chương 1–2: 149 block nội dung/bảng đối chiếu không đổi.
- Chương 5–7 đến trước Phụ lục: 51 block nội dung/bảng đối chiếu không đổi.
- 44 Expected Result đối chiếu bằng Test ID không đổi; Chương 3 không còn placeholder `[Điền sau khi test]` trong các hàng kết quả.
- Mỗi heading mới trọng yếu xuất hiện đúng một lần; không tạo chương trùng.
- PDF render có font Unicode embedded, trích xuất tiếng Việt thành công và không có ký tự thay thế `U+FFFD`.
- Đã kiểm tra trực quan các trang chứa mục 3.4–3.7 và toàn Chương 4; bảng coverage không bị tách hàng, caption và ngắt trang đọc được.

## Giới hạn

Không chạy lại testcase, không chỉnh execution evidence, source, Unit Test, schema hoặc database. Không seed/migration, commit hoặc push. Validation bố cục dùng LibreOffice/PDF; hiển thị có thể thay đổi nhẹ giữa phiên bản Microsoft Word và LibreOffice, nhưng OOXML, styles, header, ảnh, nội dung và mục lục đã được kiểm tra trên file đích.

