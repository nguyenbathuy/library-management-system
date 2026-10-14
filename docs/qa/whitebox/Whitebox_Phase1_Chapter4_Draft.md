# Nháp Chương 4 — Authentication White-box Testing, Phase 1

Đây là nội dung đề nghị cho phần của Tester hiện tại; chưa chèn vào báo cáo DOCX và không thay phần thành viên khác. Dữ liệu nguồn: [Phase 1 Results](Whitebox_Phase1_Results.md), [evidence](evidence/phase1/test-results-summary.json).

## 4.1. Phạm vi, môi trường và phương pháp

Phase 1 chọn 15 testcase từ Whitebox Test Matrix có oracle rõ cho register, login, changePassword và resetPassword. Source HEAD `3623171535cde61d8fb8dd7f02d248da3864e2e5`; workspace có test/config chưa commit, hash cụ thể được lưu kèm. Node v22.23.3, npm 10.9.9, Vitest 4.1.0, coverage-v8 4.1.0; chạy UTC 2026-10-11T16:01:40.320662+00:00 đến 2026-10-11T16:01:41.091822+00:00.

Tests dùng Arrange–Act–Assert, fixture tổng hợp và dependency mocks trước import. Alias chặn Prisma thật, gate trước testcase và network guards đảm bảo unit không dùng SQLite/SMTP/API live. Source ứng dụng/schema/DB và Manual baseline giữ hash nguyên. Lượt coverage có file syscall trace không ghi nhận truy cập dev.db hoặc production index.

Thiết kế áp dụng branch/condition testing, lớp input hợp lệ/không hợp lệ và boundary password 5/6/7 ký tự, OTP expiry T−1/T+1 ms. CFG login/reset của kế hoạch được đối chiếu mã nguồn. Không đổi Expected hoặc business rules để làm test PASS.

## 4.2. Kết quả thực thi

Triển khai 15 testcase: 2 register, 3 login, 6 changePassword, 4 resetPassword. Kết quả canonical **15 PASS, 0 FAIL, 0 SKIPPED**. Chạy thường và shuffle seed 20261011 cũng đều 15 PASS; ba lượt là 45 invocations của cùng 15 ID. Danh sách input/mock/Expected/Actual/status nằm trong Phase1 Results và JSON traces.

Error injection CP-09 trả HTTP 500 là kết quả mong đợi nên testcase PASS; không phải lỗi DB thật hoặc suite FAIL. Không phát hiện defect ứng dụng mới trong 15 ca; không đóng các lỗi manual chưa retest.

## 4.3. Coverage thực đo

V8 đo đầy đủ authController.ts, middleware/auth.ts và routes/authRoutes.ts, bao gồm code chưa chạy:

| Metric | Covered | Total | Chưa cover | Coverage công cụ |
| --- | --- | --- | --- | --- |
| Statements | 58 | 133 | 75 | 43.6% |
| Branches | 32 | 71 | 39 | 45.07% |
| Functions | 4 | 13 | 9 | 30.76% |
| Lines | 58 | 128 | 70 | 45.31% |


Controller riêng: Statement 57.42%, Branch 56.14%, Function 50%, Line 58.58%. Middleware/routes chưa thực thi vẫn được giữ trong denominator. Routes có 0 function/branch instrumented; raw 100% tại 0/0 không chứng minh đã test. Report HTML và JSON/LCOV là evidence công cụ thật.

Condition Coverage không đồng nhất Branch Coverage. Ledger phụ cho 19 atomic guard conditions xác minh **28/38 outcome T/F = 73.68%** từ actual trace, source và asserts; short-circuit NE không tính F. Condition Coverage toàn Authentication **chưa xác định**. Không khẳng định MC/DC hoặc coverage toàn hệ thống.

## 4.4. Hạn chế, pending và công việc tiếp theo

Phase 1 chưa cover đầy đủ middleware, route wiring, getMe/forgotPassword, các guard/error paths còn lại. Mocks xác minh điều phối và query intent; không chứng minh SQL persistence/transaction/concurrency, mật khẩu/JWT cryptography hay email delivery thật. AUTH-05/06 cần thêm ca nối đổi/reset rồi login với bcrypt thật trong RAM.

Pending gồm email validation/error contract, expiry đúng tại T, authorization tạo ADMIN và yêu cầu OTP login. Giữ Expected baseline và trạng thái defect gốc; không suy from public register PASS rằng lỗi hạng thành viên đã sửa.

Phase 2 tiếp tục middleware/quyền, guard mật khẩu/OTP còn thiếu, replay, forgotPassword và credential-chain tests theo coverage gaps. Báo cáo này đủ căn cứ ghi kết quả Phase 1 của Tester, không là kết quả cuối toàn nhóm.
