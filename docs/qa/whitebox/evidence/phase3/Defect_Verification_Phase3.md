# Defect verification — Phase 3 Member Management

## DEF-002 / MEM-05 — OPEN

- **Liên quan:** WB-RG-04 (LECTURER), WB-RG-05 (PREMIUM).
- **Precondition:** Prisma/bcrypt/JWT/mail/network được cách ly; request controller có `membershipTier` đã chọn.
- **Bước unit:** gọi source thật `register`; capture exact argument của `prisma.user.create`; so với Expected giữ tier đã chọn.
- **Expected:** payload persistence chứa `membershipTier: 'LECTURER'` hoặc `'PREMIUM'`, cùng hash password và response 201.
- **Actual:** cả hai run đều gọi create với `email`, `name`, hashed `password`, `role: 'USER'` nhưng thiếu `membershipTier`; Vitest giữ hai assertion FAIL.
- **Phân loại:** Production Defect đã có trong baseline, severity Medium/P2 đề xuất theo Defect Log v2; **không phải defect mới**.
- **Trạng thái:** OPEN. Không sửa production, không đổi assertion, không đánh dấu Fixed.

Bằng chứng: [combined log](combined-coverage/execution.log), [combined JSON](combined-coverage/vitest-results.json), [captured calls](combined-coverage/phase3-member-traces.json). Source review cho thấy controller không đưa field vào `data`; schema có default `STANDARD`, phù hợp với quan sát manual. Unit không chạy SQLite nên chưa chứng minh native persistence/default, không retest UI card và không xác định toàn bộ root cause phía giao diện.

## DEF-001 / MEM-02

DEF-001 vẫn là Confirmed Defect theo baseline manual. Phase 3 không tái hiện độc lập chuỗi “email sai định dạng được tạo nhưng đăng nhập thất bại” vì thiếu exact input/login error và contract validation được duyệt. WB-RG-06/WB-MA-04 giữ pending; không dựng mock login failure để tạo kết quả giả.

## Các quan sát chưa nâng thành defect

- WB-RG-03, WB-GU-03, WB-ME-04 ghi nhận promise rejection không có response do controller viết trong unit boundary. API error contract chưa xác nhận, nên đây là source-boundary characterization.
- POT-005 về tạo ADMIN vẫn pending policy; chưa dùng behavior source làm Expected nghiệp vụ.

