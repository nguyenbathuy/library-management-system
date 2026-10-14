# Nháp Chương 4 cập nhật — Authentication White-box, Phase 1+2

Ngày 12/10/2026 (Asia/Saigon). Phiên bản mới từ [Phase1 Draft](Whitebox_Phase1_Chapter4_Draft.md), giữ bản cũ và DOCX chính; chỉ nội dung Tester hiện tại. Evidence chính: [Phase2 Results](Whitebox_Phase2_Results.md), [summary](evidence/phase2/test-results-summary.json).

## 4.1. Phạm vi và phương pháp

Phase 1 15 ca controller được audit; Phase 2 thêm 25 ca có oracle B/S từ Matrix, không trùng ID và không chạy oracle R. Toàn suite 40 testcase cho register/login/changePassword/forgotPassword/resetPassword và authenticateToken/authorizeAdmin/optionalAuthenticateToken. Arrange–Act–Assert, fixture synthetic, dependency mocks trước import, alias Prisma fail-closed, network guards, fake clock cho OTP. Không khởi động app/SQLite/SMTP; DB/source/schema/Manual và evidence Phase1 giữ nguyên hash.

Source HEAD `3623171535cde61d8fb8dd7f02d248da3864e2e5`; workspace chưa commit, source/config/test hashes và Git status được lưu kèm. Node v22.23.3, Vitest/coverage-v8 4.1.0; canonical run 2026-10-12T13:38:11.892430+07:00 đến 2026-10-12T13:38:13.071962+07:00. Source ba file/coverage maps/provider/scope giữ nguyên để so sánh.

## 4.2. Thực thi và assertions có giá trị

Kết quả cuối **40 PASS, 0 FAIL, 0 SKIPPED**, trong đó 25 ca mới. Lượt riêng Phase1/Phase2, toàn suite và shuffle seed 20261012 đều success. Một hook lỗi FixtureParseError ở lượt đầu đã được lưu và sửa test setup; không sửa app/Expected để PASS.

Tests xác nhận permission USER/anonymous bị chặn, ADMIN được next, JWT verifier error được xử lý, input thiếu/ngắn bị từ chối trước write, OTP/TTL/normalization đúng, mail failure có error response. RP-15 reset thành công rồi thử lại trên record RAM đã nhận update.data thật; lần hai bị 400 và không hash/update/notification thêm. Jwt/bcrypt mocks chỉ xác nhận call intent, chưa xác nhận crypto, SQLite persistence hay concurrency.

## 4.3. Coverage thực đo cùng phạm vi

Full authController.ts, middleware/auth.ts, authRoutes.ts; giữ cả code chưa chạy:

| Metric | Phase 1 covered/total | Phase 1 | Phase 1+2 covered/total | Phase 1+2 | Difference (điểm %) |
| --- | --- | --- | --- | --- | --- |
| Statements | 58/133 | 43.6% | 101/133 | 75.93% | +32.33 |
| Branches | 32/71 | 45.07% | 58/71 | 81.69% | +36.62 |
| Functions | 4/13 | 30.76% | 10/13 | 76.92% | +46.16 |
| Lines | 58/128 | 45.31% | 98/128 | 76.56% | +31.25 |


Middleware 100% statement/branch/function/line; controller 77.22%/77.19%/62.5%/78.78%; route statements/lines 0%. Routes branch/function 0/0 là N/A dù raw tool in 100%. Có thêm 43 statements/26 branch slots/6 functions-callbacks/40 lines được chạy, không thay denominator hoặc exclude code yếu.

Condition ledger thủ công cùng 19 guard: 28/38 → 38/38 outcome; expanded cohort 30 có 58/60, báo riêng. Response/calls được assert runtime; atomic T/F suy từ recorded values và source rồi QA đối soát, không có direct predicate instrumentation. Condition Coverage toàn Authentication chưa xác định; NE không tính F, không MC/DC và không hòa vào bốn metric V8.

## 4.4. Findings, OTP và hạn chế

Không có production defect mới được xác nhận trong 40 ca. Defects manual chưa retest không được đóng. AUTH-01/POT-001 còn Requirement Clarification: source cấp JWT sau password match, OTP chỉ ở reset, protected middleware không có OTP-completed check; UI 2FA là local state. Unit mocks chưa chứng minh browser popup flow/security bypass; mandatory MFA phải được chốt trước Integration/E2E trên staging cô lập.

Còn getMe/getAllUsers/toggleBlacklist, route wiring, reset catch và một số fault paths chưa test. Pending expiry=T, email/error policy và authorized ADMIN creation; giữ Expected baseline. Phase3 tiếp tục getMe, forgot missing vectors, reset DB/hash lỗi và credential chains bằng bcrypt thật trong RAM, rồi route wiring/MFA E2E theo policy được xác nhận.

**Đủ evidence trình bày Authentication qua hai phase trong Chương 4**, với 40 ca và giới hạn trên; chưa tuyên bố hoàn tất kiểm thử toàn module/hệ thống hoặc kết quả cuối nhóm. Chưa ghi vào DOCX chính.
