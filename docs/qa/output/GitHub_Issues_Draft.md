# GitHub Issues Draft — QA Baseline v2

Chỉ là bản nháp, chưa tạo Issue trên GitHub. Tên Manual_Test_Notes_Final.docx chưa có; đã dùng Kiểm thử phần mềm.docx cập nhật và đối chiếu defect v1 còn OPEN. Mức Severity/Priority là đề xuất. Không khẳng định agent đã tái hiện, có fix hoặc đã retest. Các acceptance criteria dưới đây phục vụ retest/trao đổi với Dev, không thay Expected nguyên văn của testcase.

Các link evidence tương đối dùng được khi đọc file này tại docs/qa/output. Khi gửi Issue, đính kèm đúng file và đổi thành link attachment; không dùng screenshot testcase khác thay evidence lỗi. INV-05/POT-006 chưa tạo draft confirmed issue vì còn cần xác nhận tiêu chí chất lượng riêng.

---

## DEF-001 — Tạo thành viên bằng email sai định dạng nhưng không đăng nhập được

- **Tiêu đề:** [QA][MEM-02] Tạo thành viên bằng email sai định dạng nhưng không đăng nhập được
- **Severity:** Medium (đề xuất)
- **Priority:** P2 (đề xuất)
- **Related Test ID:** MEM-02
- **Status:** OPEN — chưa có fix/retest
- **Phân loại:** Confirmed Defect theo ghi nhận trực tiếp của Tester.

### Preconditions

Theo kế hoạch: Admin và thành viên thử; email mới/trùng; dữ liệu blacklist và vai trò/hạng thẻ.

### Steps to Reproduce

1. Admin mở quản lý thành viên.
2. Mở Thêm thành viên, nhập email không có @ cùng thông tin thử.
3. Lưu thành viên.
4. Thử đăng nhập bằng tài khoản vừa tạo.
Thao tác tổng hợp từ ghi chú Tester; chuỗi email và thông báo lỗi cụ thể chưa được ghi.

### Expected Result

Tài khoản xuất hiện trong danh sách và có thể đăng nhập.

### Actual Result

Tester xác nhận email không có @ vẫn tạo được thành viên nhưng thành viên đó không đăng nhập được. Ảnh form cho thấy thiếu dấu *; chưa có ảnh gửi email sai và lỗi đăng nhập.

### Evidence

[Nguồn manual](<../input/Kiểm thử phần mềm.docx>): Kiểm thử phần mềm.docx B65, B66, B67.

Ghi nhận trực tiếp bằng văn bản của Tester; thiếu screenshot kết quả lỗi.

- [MEM-02_rId14_image24.png](evidence/MEM-02_rId14_image24.png)

**Giới hạn:** rId16: Không chứng minh email sai đã lưu hay đăng nhập thất bại; lỗi DEF-001 được xác nhận bằng ghi chú Tester.

Ảnh MEM-02 chỉ chứng minh form/thiếu dấu *, không chứng minh lưu email sai hoặc đăng nhập thất bại. Cần Tester bổ sung chuỗi email thử và ảnh/log hai thao tác.

### Acceptance Criteria để Retest

Dữ liệu email sai định dạng được xử lý rõ ràng, không để tạo tài khoản không sử dụng được; tài khoản tạo với email hợp lệ xuất hiện và đăng nhập được. Lưu trước/sau, email thử, lỗi và phiên bản retest. Tiêu chí từ chối email sai là đề xuất để Dev/QA chốt, không thay Expected MEM-02.

- [ ] Ghi phiên bản/commit, ngày test, môi trường và dữ liệu thực tế.
- [ ] Lưu evidence đúng luồng; đối chiếu Expected gốc và các nhánh độc lập.
- [ ] Ghi Retest Result từ lần chạy thực tế; chỉ đóng defect sau khi có kết quả đạt.

---

## DEF-002 — Hạng thành viên lưu STANDARD khác lựa chọn trên form

- **Tiêu đề:** [QA][MEM-05] Hạng thành viên lưu STANDARD khác lựa chọn trên form
- **Severity:** Medium (đề xuất)
- **Priority:** P2 (đề xuất)
- **Related Test ID:** MEM-05
- **Status:** OPEN — chưa có fix/retest
- **Phân loại:** Confirmed Defect theo ghi nhận trực tiếp của Tester.

### Preconditions

Theo kế hoạch: Admin và thành viên thử; email mới/trùng; dữ liệu blacklist và vai trò/hạng thẻ.

### Steps to Reproduce

1. Admin mở Thêm thành viên.
2. Nhập thông tin thử; ảnh nguồn dùng abc@bac.com.
3. Chọn Lecturer.
4. Lưu, đối chiếu thẻ thành viên cùng email.
Ảnh nguồn là biến thể LECTURER; cần retest đúng PREMIUM/ADMIN của kịch bản gốc.

### Expected Result

Vai trò và hạng thẻ được lưu đúng theo lựa chọn trên form. Nếu hệ thống vẫn lưu USER/STANDARD thì ghi nhận defect kèm bằng chứng.

### Actual Result

Tester xác nhận chọn hạng thành viên không có tác dụng, thành viên tạo ra vẫn STANDARD. Hai ảnh cùng tên/email cho thấy chọn Lecturer (15 cuốn) nhưng thẻ thành viên hiển thị STANDARD (5 cuốn). Chưa xác nhận nhánh ADMIN/PREMIUM.

### Evidence

[Nguồn manual](<../input/Kiểm thử phần mềm.docx>): Kiểm thử phần mềm.docx B88, B90, B92.

Cặp screenshot trước/sau cùng email + ghi chú Tester.

- [MEM-05_rId17_image12.png](evidence/MEM-05_rId17_image12.png)
- [MEM-05_rId18_image16.png](evidence/MEM-05_rId18_image16.png)

**Giới hạn:** rId19: Không phải nhánh ADMIN/PREMIUM nêu trong kịch bản; cần xem kèm rId20.
rId20: Xác nhận sai hạng khi xem cùng rId19/ghi chú; chưa có kết quả nhánh ADMIN.

### Acceptance Criteria để Retest

Hạng chọn LECTURER được lưu/hiển thị LECTURER sau tải lại, không rơi về STANDARD. Kiểm tra riêng PREMIUM và role ADMIN đúng MEM-05; STANDARD làm đối chứng. Không suy ra PASS luồng mượn từ hạn mức hiển thị.

- [ ] Ghi phiên bản/commit, ngày test, môi trường và dữ liệu thực tế.
- [ ] Lưu evidence đúng luồng; đối chiếu Expected gốc và các nhánh độc lập.
- [ ] Ghi Retest Result từ lần chạy thực tế; chỉ đóng defect sau khi có kết quả đạt.

---

## DEF-003 — PDF Dashboard hiển thị lỗi font tiếng Việt

- **Tiêu đề:** [QA][DASH-02] PDF Dashboard hiển thị lỗi font tiếng Việt
- **Severity:** Medium (đề xuất)
- **Priority:** P2 (đề xuất)
- **Related Test ID:** DASH-02
- **Status:** OPEN — chưa có fix/retest
- **Phân loại:** Confirmed Defect theo ghi nhận trực tiếp của Tester.

### Preconditions

Theo kế hoạch: Admin và dữ liệu thống kê tối thiểu; chưa ghi snapshot/phiên dữ liệu đầy đủ.

### Steps to Reproduce

1. Admin mở Dashboard có dữ liệu thống kê.
2. Xuất báo cáo thống kê PDF.
3. Mở PDF và đối chiếu chữ tiếng Việt.
Các bước tổng hợp từ Scenario và ghi chú Tester, chưa được agent chạy lại.

### Expected Result

PDF mở được và tiếng Việt hiển thị đúng, không lỗi font.

### Actual Result

Tester ghi PDF mở được nhưng lỗi font, tương tự INV-05. Chưa có ảnh/file PDF Dashboard riêng; ảnh PDF kiểm kê chỉ là bằng chứng tham chiếu triệu chứng.

### Evidence

[Nguồn manual](<../input/Kiểm thử phần mềm.docx>): Kiểm thử phần mềm.docx B121, B122.

Ghi nhận trực tiếp bằng văn bản của Tester; thiếu screenshot kết quả lỗi.

**Giới hạn:** Chưa có screenshot/file lỗi trực tiếp; ghi chú Tester là evidence hiện có.

### Acceptance Criteria để Retest

PDF thống kê mở được; tiêu đề, nhãn và tên tiếng Việt hiển thị đúng, không mất dấu/ký tự. Đính kèm PDF Dashboard riêng và screenshot đối chiếu; ghi commit fix/retest. INV-05 cần retest độc lập.

- [ ] Ghi phiên bản/commit, ngày test, môi trường và dữ liệu thực tế.
- [ ] Lưu evidence đúng luồng; đối chiếu Expected gốc và các nhánh độc lập.
- [ ] Ghi Retest Result từ lần chạy thực tế; chỉ đóng defect sau khi có kết quả đạt.
