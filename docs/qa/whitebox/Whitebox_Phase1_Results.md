# White-box Phase 1 Results — Authentication

**Đã thực thi thật: 15 testcase, 15 PASS, 0 FAIL, 0 SKIPPED, 0 TODO.** Ba lượt chạy (thường, shuffle, coverage) đều exit 0; mỗi lượt cùng 15 testcase độc lập. Không gọi 45 lượt chạy cộng dồn là 45 testcase. Kết quả chỉ thuộc Phase 1 của Tester hiện tại.

## 1. Mục tiêu, kế hoạch và phạm vi

Thiết lập backend unit testing, thực thi 10–15 ca oracle rõ ràng và đo coverage thật bằng V8, giữ database/source/manual baseline bất biến. Đã đọc và đối chiếu đủ [Test Plan](Whitebox_Test_Plan.md), [Test Matrix](Whitebox_Test_Matrix.md), [Coverage Strategy](Whitebox_Coverage_Strategy.md), [Implementation Plan](Whitebox_Implementation_Plan.md). Bốn file giữ nguyên hash/nội dung. Không có sai lệch function/path/Expected với source hiện tại.

Chọn 15 ID B/S, không triển khai ID oracle R. Mục tiêu thực thi là register (public đăng ký USER), login, changePassword, resetPassword trong [authController.ts](../../../server/src/controllers/authController.ts). Các ID RG trong ma trận cũ được nhóm Member Management vì dùng chung controller; Phase 1 dùng RG-01/02 cho public Authentication theo yêu cầu mới, không thay Expected hoặc triển khai luồng tier/Admin Member. CFG login/reset trong kế hoạch khớp đường thực thi.

Đo đầy đủ controller, middleware/auth và authRoutes, không lọc chỉ function được test. Controller vẫn chứa getAllUsers/toggleBlacklist; phần chưa test được giữ trong mẫu số. Không kiểm thử React, Book/Excel, gửi mail thật, token cryptography, SQLite persistence/transaction hoặc routing production.

## 2. Môi trường và các file tạo/chỉnh sửa

- Node **v22.23.3**, npm **10.9.9**, Vitest **4.1.0**, coverage-v8 **4.1.0**, Vite **6.3.5**. Root ESM; server package CommonJS, TS strict module commonjs. Suite nạp trực tiếp TS qua Vitest; test tsconfig riêng ESNext/Bundler; production tsconfig không đổi.
- Git HEAD tested: `3623171535cde61d8fb8dd7f02d248da3864e2e5`. Workspace có thay đổi chưa commit; SHA HEAD không thay thế snapshot của test/config. Hash source/config/test thực chạy nằm trong [run-metadata.json](evidence/phase1/coverage/run-metadata.json).
- Thực thi canonical bắt đầu **2026-10-11T16:01:40.320662+00:00**, kết thúc **2026-10-11T16:01:41.091822+00:00** (UTC). Phiên bản/timestamp của từng lượt nằm trong metadata của lượt đó.
- Chỉ thêm hai devDependencies trực tiếp: **vitest@4.1.0**, **@vitest/coverage-v8@4.1.0**; không cài jsdom/Testing Library. Runtime dependency declarations, peer declarations và phiên bản runtime trực tiếp giữ nguyên.

| File/nhóm | Thay đổi |
| --- | --- |
| package.json | Thêm test/test:unit/test:coverage, hai devDependencies, npm overrides.vite=$vite để giữ Vite 6.3.5. |
| package-lock.json | Lock hai test packages và dependencies liên quan; thêm 38 entry; cập nhật 4 transitive Babel build/parser packages theo resolution npm, không thay phiên bản runtime trực tiếp. |
| [vitest.backend.config.ts](../../../vitest.backend.config.ts) | Runner Node/forks, alias fail-closed Prisma, include ba file Authentication, reporter JSON/HTML/V8. |
| [server/tsconfig.tests.json](../../../server/tsconfig.tests.json) | Type-check test riêng; không sửa server/tsconfig.json. |
| [server/tests/unit/auth/authController.test.ts](../../../server/tests/unit/auth/authController.test.ts) | 15 AAA cases, hoisted dependency mocks, isolation gate, traces per testcase. |
| [server/tests/mocks/http.ts](../../../server/tests/mocks/http.ts), [prismaGuard.ts](../../../server/tests/mocks/prismaGuard.ts) | Express stubs, module guard ngăn Prisma thật. |
| [server/tests/setup/isolation.ts](../../../server/tests/setup/isolation.ts) | Chặn fetch/HTTP/HTTPS/TLS/socket ngay trong collection; assert 0 attempt. |
| [server/tests/fixtures/auth.ts](../../../server/tests/fixtures/auth.ts), [phase1-cases.json](../../../server/tests/fixtures/phase1-cases.json) | Fixture tổng hợp trong RAM, metadata chọn nguyên ID/Expected đã thiết kế; không dữ liệu người dùng thật. |
| docs/qa/whitebox/Whitebox_Phase1_Results.md | Báo cáo này. |
| docs/qa/whitebox/Whitebox_Phase1_Chapter4_Draft.md | Nháp Chương 4 Authentication Phase 1, chưa sửa DOCX. |
| docs/qa/whitebox/evidence/phase1/ | Raw logs, runner JSON, traces, metadata, coverage HTML/JSON/LCOV, condition ledger, preservation/syscall checks. |


### Vấn đề môi trường đã xử lý

Npm 10.9.9 báo `Cannot read properties of null (reading edgesOut)` khi resolve peer graph cho Vitest. Chạy lại package-lock-only/prefer-dedupe vẫn không thành công. Đây là **Environment Error của installer**, không phải testcase FAIL/production defect. Lỗi tương tự có báo cáo trong [npm/cli issue #9787](https://github.com/npm/cli/issues/9787). Thêm npm override Vite theo version root hiện có (đã có pnpm override tương đương) thì cài được hai package test đúng phiên bản. Không nâng Vite/React, không dùng legacy-peer-deps bỏ kiểm tra peer, không chạy lifecycle script (`--ignore-scripts`). Không sửa assertion nào để làm xanh.

## 3. Chứng minh database được cách ly

- Alias `@prisma/client` trỏ tới test guard; nếu vi.mock không thay được module, guard throw và dừng collection trước gọi controller. Constructor thật không được resolve qua alias này.
- vi.hoisted/vi.mock đăng ký Prisma/bcrypt/JWT/mail/notification trước import controller. BeforeAll xác nhận constructor là mock, được gọi đúng **1 lần** khi import, trả đúng object mock, factories đã chạy và chưa có delegate call trước testcase. [isolation-gate.json](evidence/phase1/coverage/isolation-gate.json).
- Mỗi case reset delegate/mock state, default unconfigured call throw; forbidden connect/disconnect/mail được assert sau từng test. Toàn bộ actual calls nằm trong [case-traces.json](evidence/phase1/coverage/case-traces.json). Hash và JWT là mock outputs, chỉ xác minh call intent/DTO, không xác minh thuật toán library.
- 8 network guards đều **0 attempt**, lưu [network-guard-results.json](evidence/phase1/coverage/network-guard-results.json). Không gọi API live, production app.listen, reminder cron, seed/migration/reset DB.
- Coverage run được theo dõi bằng strace file syscalls: **7503 dòng**, **0 match dev.db/journal/WAL/SHM**, **0 match production server/src/index.ts**. [filesystem-syscalls.log](evidence/phase1/coverage/filesystem-syscalls.log) và [preservation-validation.json](evidence/phase1/preservation-validation.json).
- Hash trước/sau của **154 file được bảo vệ** giống nhau: source app/backend, schema/DB, input/output Manual Testing, bốn kế hoạch; package/lock là hai file được phép đổi. DB đã có thay đổi Git từ công việc trước Phase 1; hash chứng minh Phase 1 giữ nguyên trạng thái đầu vào, không tự restore.

Static review trước chạy nằm trong [pre-execution-isolation-review.json](evidence/phase1/pre-execution-isolation-review.json). Test code type-check bằng server TypeScript **exit 0**. Frontend build với Vite hiện có cũng **exit 0**, output tại `/tmp/lms-phase1-frontend-build`, nhằm kiểm tra build tooling sau cài dependency test; đây không phải kết quả frontend testing/coverage. [Auxiliary validation](evidence/phase1/auxiliary-validation.json). Chỉ khi review và gate đạt mới có testcase body được chạy. Mock isolation/trace không xác nhận DB persistence/rollback thực.

## 4. Lệnh chạy và bằng chứng thực thi

Chạy từ root repository:

```bash
npm test
npm run test:unit
npm run test:coverage
```

Để kiểm tra lại tính độc lập: `npm run test:unit -- --sequence.shuffle --sequence.seed=20261011`. Type-check: `./server/node_modules/.bin/tsc --project server/tsconfig.tests.json --noEmit`. Môi trường shell phải dùng Node 22.23.3 đã cài (nếu cần: `export PATH="$HOME/.local/bin:$PATH"`). Không cần khởi động client/server hoặc chuẩn bị dữ liệu SQLite.

Default output lần chạy tiếp theo: `artifacts/qa/whitebox/phase1/latest/`. Có thể đặt `LMS_WB_RUN_DIR=/đường/dẫn/thư/mục/output` để giữ lượt riêng; evidence đã lưu của Phase 1 không tự bị ghi đè bởi lệnh mặc định. JSON reporter, traces, gate và network checks được tạo bởi suite; log/timestamp/source hashes của ba lần chạy hiện tại đã được lưu cùng nhau.

| Run | Command thực | PASS | FAIL | SKIPPED | Exit | Bắt đầu UTC |
| --- | --- | --- | --- | --- | --- | --- |
| unit | npm test | 15 | 0 | 0 | 0 | 2026-10-11T16:01:28.813016+00:00 |
| shuffle | npm run test:unit -- --sequence.shuffle --sequence.seed=20261011 | 15 | 0 | 0 | 0 | 2026-10-11T16:01:35.910253+00:00 |
| coverage | npm run test:coverage | 15 | 0 | 0 | 0 | 2026-10-11T16:01:40.320662+00:00 |


[Log thường](evidence/phase1/unit/execution.log), [log shuffle](evidence/phase1/shuffle/execution.log), [log coverage](evidence/phase1/coverage/execution.log), [execution validation](evidence/phase1/execution-validation.json), [summary JSON](evidence/phase1/test-results-summary.json). Shuffle thực đổi thứ tự và đều PASS; điều này hỗ trợ tính độc lập cho các thứ tự đã chạy, không chứng minh mọi permutation.

## 5. Danh sách testcase đã thực thi

Mỗi dòng dưới đây lấy Actual/Status từ runner và traces thật. Mock setup gồm default deny; actor mặc định chỉ có trong các case changePassword được yêu cầu xác thực. Condition T/F/NE là suy luận QA đã kiểm chứng input/calls/output theo source, không phải counter per-case từ V8. JSON summary có đầy đủ input, mock configuration, expected, actual, status và dependency outcomes.

| Test ID / source | Function | Input | Mock setup | Expected | Actual / Status | Branch/Condition |
| --- | --- | --- | --- | --- | --- | --- |
| [WB-LG-01](../../../server/tests/unit/auth/authController.test.ts#L228) | login | {"email": "user@example.com", "password": "oldpass"} | {"default": "deny unconfigured calls", "findUnique": null} | 401 Invalid credentials; không compare/sign | HTTP 401; {"error": "Invalid credentials"}; PASSED | LG.1: T/NE; LG.A=T |
| [WB-LG-02](../../../server/tests/unit/auth/authController.test.ts#L240) | login | {"email": "user@example.com", "password": "wrongpass"} | {"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "bcryptCompare": false} | 401; không sign | HTTP 401; {"error": "Invalid credentials"}; PASSED | LG.1: F/T; LG.A=F, LG.B=T |
| [WB-LG-03](../../../server/tests/unit/auth/authController.test.ts#L252) | login | {"email": "user@example.com", "password": "oldpass"} | {"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "bcryptCompare": true, "jwtSign": "unit-test-jwt-output"} | 200 token; JWT claims id/email/role, expiresIn=1h; DTO đúng tier, không password | HTTP 200; {"token": "unit-test-jwt-output", "user": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false}}; PASSED | LG.1: F/F; LG.A=F, LG.B=F |
| [WB-CP-01](../../../server/tests/unit/auth/authController.test.ts#L274) | changePassword | {"currentPassword": "oldpass", "newPassword": "abcdef"} | {"default": "deny unconfigured calls"} | 401; không hash/update | HTTP 401; {"error": "Unauthorized"}; PASSED | CP.1 T; CP.1=T |
| [WB-CP-02](../../../server/tests/unit/auth/authController.test.ts#L284) | changePassword | {"currentPassword": "", "newPassword": "abcdef"} | {"default": "deny unconfigured calls"} | 400; không DB | HTTP 400; {"error": "Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới"}; PASSED | CP.2: T/NE; CP.1=F, CP.2A=T |
| [WB-CP-03](../../../server/tests/unit/auth/authController.test.ts#L293) | changePassword | {"currentPassword": "oldpass", "newPassword": ""} | {"default": "deny unconfigured calls"} | 400; không DB | HTTP 400; {"error": "Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới"}; PASSED | CP.2: F/T; CP.1=F, CP.2A=F, CP.2B=T |
| [WB-CP-04](../../../server/tests/unit/auth/authController.test.ts#L302) | changePassword | {"currentPassword": "oldpass", "newPassword": "abcde"} | {"default": "deny unconfigured calls"} | 400; không lookup | HTTP 400; {"error": "Mật khẩu mới phải có độ dài tối thiểu 6 ký tự"}; PASSED | CP.2 F/F; CP.3 T; CP.1=F, CP.2A=F, CP.2B=F, CP.3=T |
| [WB-CP-08](../../../server/tests/unit/auth/authController.test.ts#L311) | changePassword | {"currentPassword": "oldpass", "newPassword": "abcdef"} | {"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "bcryptCompare": true, "bcryptHash": "unit-test-hash-output", "userUpdate": "resolve", "notification": "resolve"} | 200; hash(new,10), update đúng userId; notification một lần | HTTP 200; {"message": "Đổi mật khẩu thành công!"}; PASSED | CP.3 F tại 6; CP.6 F; CP.E success; CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=F, CP.5=F, CP.6=F |
| [WB-CP-09](../../../server/tests/unit/auth/authController.test.ts#L328) | changePassword | {"currentPassword": "oldpass", "newPassword": "abcdefg"} | {"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "bcryptCompare": true, "bcryptHash": "unit-test-hash-output", "userUpdate": {"reject": "Simulated unit update failure"}} | 500; không notification | HTTP 500; {"error": "Không thể cập nhật mật khẩu, vui lòng thử lại sau"}; PASSED | CP.3 F tại 7; CP.E catch; CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=F, CP.5=F, CP.6=F |
| [WB-RP-04](../../../server/tests/unit/auth/authController.test.ts#L345) | resetPassword | {"email": "user@example.com", "otp": "123456", "newPassword": 123456} | {"default": "deny unconfigured calls"} | 400; không lookup | HTTP 400; {"error": "Mật khẩu mới phải có tối thiểu 6 ký tự"}; PASSED | RP.1 F/F/F; RP.2 T/NE; RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=T |
| [WB-RP-08](../../../server/tests/unit/auth/authController.test.ts#L354) | resetPassword | {"email": "user@example.com", "otp": "999999", "newPassword": "abcdef"} | {"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}} | 400; không hash/update | HTTP 400; {"error": "Mã OTP không chính xác"}; PASSED | RP.4: F/T; RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=T |
| [WB-RP-10](../../../server/tests/unit/auth/authController.test.ts#L365) | resetPassword | {"email": "user@example.com", "otp": "123456", "newPassword": "abcdef"} | {"default": "deny unconfigured calls", "clock": "2026-10-11T00:00:00.000Z", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-10T23:59:59.999Z", "createdAt": "2026-01-01T00:00:00.000Z"}} | 400 expired; không hash/update | HTTP 400; {"error": "Mã OTP đã hết hạn, vui lòng yêu cầu gửi lại mã mới"}; PASSED | RP.5: F/T; RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=F, RP.5A=F, RP.5B=T |
| [WB-RP-12](../../../server/tests/unit/auth/authController.test.ts#L377) | resetPassword | {"email": " USER@EXAMPLE.COM ", "otp": " 123456 ", "newPassword": "abcdef"} | {"default": "deny unconfigured calls", "clock": "2026-10-11T00:00:00.000Z", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "bcryptHash": "unit-test-hash-output", "userUpdate": "resolve", "notification": "resolve"} | 200; lookup lower/trim; hash(new,10); update password, xóa OTP+expiry; notification | HTTP 200; {"message": "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới."}; PASSED | RP.2 F/F; RP.4 F/F; RP.5 F/F; RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=F, RP.5A=F, RP.5B=F |
| [WB-RG-01](../../../server/tests/unit/auth/authController.test.ts#L197) | register | {"email": "user@example.com", "name": "Unit Test User", "password": "oldpass"} | {"default": "deny unconfigured calls", "bcryptHash": "unit-test-hash-output", "userCreate": "resolve"} | 201; create nhận email/name/HASH/role USER; không plaintext | HTTP 201; {"message": "User created"}; PASSED | RG.1 success;  |
| [WB-RG-02](../../../server/tests/unit/auth/authController.test.ts#L214) | register | {"email": "user@example.com", "name": "Unit Test User", "password": "oldpass"} | {"default": "deny unconfigured calls", "bcryptHash": "unit-test-hash-output", "userCreate": {"reject": "P2002"}} | 400 User already exists | HTTP 400; {"error": "User already exists"}; PASSED | RG.1 catch;  |


CP-09 **PASS** vì test kỳ vọng controller trả 500 khi mock update lỗi, cùng điều kiện không gửi notification. HTTP 500 giả lập có chủ đích không phải suite FAIL hoặc bằng chứng database thật hỏng. RG-02 giả lập P2002 kiểm tra xử lý duplicate, không chứng minh constraint SQLite. Không triển khai ca invalid email thiếu oracle rõ.

## 6. Code Coverage thực đo

Nguồn: [coverage-summary.json](evidence/phase1/coverage/coverage/coverage-summary.json), [coverage-final.json](evidence/phase1/coverage/coverage/coverage-final.json), [HTML report](evidence/phase1/coverage/coverage/index.html), [LCOV](evidence/phase1/coverage/coverage/lcov.info). Provider **V8 4.1.0**. Không đặt threshold để ép pass cho Phase 1; mục tiêu trưởng thành trong kế hoạch giữ nguyên và chưa đạt với phạm vi triển khai hiện tại.

| Metric | Covered | Total | Chưa cover | Coverage công cụ |
| --- | --- | --- | --- | --- |
| Statements | 58 | 133 | 75 | 43.6% |
| Branches | 32 | 71 | 39 | 45.07% |
| Functions | 4 | 13 | 9 | 30.76% |
| Lines | 58 | 128 | 70 | 45.31% |


| File đo đầy đủ | Statement | Branch | Function | Line |
| --- | --- | --- | --- | --- |
| server/src/controllers/authController.ts | 58/101 (57.42%) | 32/57 (56.14%) | 4/8 (50%) | 58/99 (58.58%) |
| server/src/middleware/auth.ts | 0/23 (0%) | 0/14 (0%) | 0/5 (0%) | 0/20 (0%) |
| server/src/routes/authRoutes.ts | 0/9 (0%) | N/A (0/0) | N/A (0/0) | 0/9 (0%) |


Include chính xác ba file trong bảng; exclude node_modules và server/tests. Ngoài phạm vi: controller/routes Book/Loan/Reservation/Payment/Inventory/Analytics/Notification, frontend, services mail/notification internals, cron/index bootstrap, Prisma generated code/seed. Không giảm mẫu số bằng cách bỏ hàm chưa test trong authController hoặc bỏ middleware/routes. Coverage này là của ba file công bố, **không phải toàn hệ thống hoặc cả nhóm**.

authRoutes không có function/branch instrumented nên raw tool báo 100% ở hai metric 0/0; bảng trình bày N/A và statement/line vẫn 0%, không gọi routes đã được test. `branchesTrue` trong JSON có mẫu số 0, không được dùng làm Condition Coverage.

### Condition Coverage riêng

[Condition ledger JSON](evidence/phase1/condition-ledger.json) và [bảng T/F/NE](evidence/phase1/Condition_Coverage_Phase1.md) xác minh **28/38 outcome = 73.68%** cho **19 atomic conditions** của guard login/changePassword/resetPassword. Register không có Boolean if guard. Đây là số suy luận từ actual input, spy outcomes, short-circuit và assertion output; không phải metric V8 tự đo.

**Condition Coverage toàn Authentication chưa xác định**: các hàm khác, optional chaining và toàn catalog predicates chưa được đo đầy đủ. NE không tính F; không loại outcome thiếu khỏi denominator; không khẳng định MC/DC. Ví dụ login có A/B T/F đầy đủ, nhưng reset missing-email/otp/password mới chỉ có F trong Phase 1.

## 7. Nhánh và code chưa bao phủ

[coverage-gaps.json](evidence/phase1/coverage-gaps.json) trích xuất mọi statement/function/branch slot hit=0 từ file công cụ; có source location và slot ID thật. Tổng chưa cover: **75 statements**, **39 branch slots**, **9 functions/callbacks**, **70 executable lines**.

- Controller chưa gọi getMe, getAllUsers, toggleBlacklist, forgotPassword: 4/8 functions chưa cover, 43 statements và 25 branch slots hit=0.
- changePassword chưa đi user=null → 404, compare=false → 400, password mới bằng cũ → 400, notification reject sau update; các ca này có ID rõ trong Matrix.
- resetPassword chưa đi thiếu từng input, string length<6, user=null, resetOtp=null, expiry=null, dependency error catch; biên expiry=T và email kiểu sai đang pending oracle. Điều kiện thiếu T trong ledger được liệt kê riêng.
- Middleware chưa thực thi cả 3 exported functions và 2 verify callbacks: 23 statements, 14 branch slots, 5 functions/callbacks hit=0.
- authRoutes chưa thực thi 9 statements/9 lines. Quyền route wiring và trang 403/logout UI chưa được chứng minh bằng controller tests.
- Register hash reject trước try và login dependency reject không nằm trong branch counter như if; chưa thực thi các error paths đó, không suy từ branch % rằng đã cover.

## 8. Defects và phân loại lỗi

**Không phát hiện production defect mới trong 15 ca đã thực thi.** Không có case FAIL nên không có kết quả Incorrect Test Design/Mock Configuration Error cần sửa assertion. Environment Error của npm đã xử lý trước test; log runner ba lượt đều exit 0. Không suy rộng rằng Authentication không còn lỗi.

Baseline vẫn giữ nguyên: DEF-001/MEM-02 email, DEF-002/MEM-05 lưu tier, DEF-003/DASH-02 font PDF không được retest bởi bộ Phase 1 này; không đánh dấu Fixed. POT-001 OTP login và POT-005 role ADMIN chưa được xác nhận bằng test ở đây. Source register vẫn chỉ lưu USER và không nhận membershipTier; RG-04/05 là regression của Member phase sau, không chuyển lỗi đó thành PASS dựa trên public register happy path.

## 9. Pending và vấn đề cần Tester xác nhận

Các ca R liên quan Authentication/public register **chưa triển khai**; chúng không xuất hiện trong runner và không tính SKIPPED (SKIPPED của suite=0):

| ID | Cần chốt |
| --- | --- |
| WB-FP-08 | Email toàn whitespace nên bị validation 400 hay lookup rồi 404? |
| WB-RP-11 | OTP đúng tại expiry=T có hợp lệ không? Source dùng <; cần oracle biên, không sửa rule. |
| WB-RP-14 | Email truthy sai kiểu cần trả 400 hay có error contract khác? Source hiện catch 500. |
| WB-RG-06 | Chính sách email sai định dạng, HTTP/message và evidence cụ thể của lỗi tạo/login MEM-02. |
| WB-RG-07 | Luồng Admin tạo Admin được bảo vệ thế nào trong khi public register không cho nâng quyền? |

Ngoài các ID R, POT-001 cần Tester xác nhận OTP popup thuộc login hay forgot/reset, cấu hình MFA/yêu cầu bắt buộc; không tự thêm OTP assertion login. 15 ca triển khai không đủ xác nhận mật khẩu mới login được theo AUTH-05/06 toàn luồng; CP-11/RP-16 dùng bcrypt thật và record RAM được đề xuất Phase 2.

## 10. Đề xuất Phase 2 và kết luận Chương 4

Ưu tiên tiếp tục Authentication: AT/AA/OA middleware (10 ca đã thiết kế), getMe; CP-05/06/07 cho missing user/password sai/password lặp; RP required/type/expiry missing/replay và CP-11/RP-16 cho đổi/reset rồi login bằng bcrypt thật trong RAM; forgotPassword normalization/OTP generation/mail fault injection. Dùng coverage gaps chọn thứ tự, giữ các oracle R pending. Route wiring có thể là nhóm test riêng với Express app thử và mocks, không import production index/cron hoặc chạm DB chính.

Không mở rộng Member/Book/Excel hoặc integration SQLite trong Phase 1. Các regression tier/Admin cần scope phù hợp và oracle authorization; SMTP delivery/PDF/concurrency vẫn cần evidence khác.

**Đủ bằng chứng đưa Authentication Phase 1 vào Chương 4** với phạm vi 15 ca, ba file include, coverage thực đo, condition subset và giới hạn đã công bố. [Nháp nội dung Chương 4](Whitebox_Phase1_Chapter4_Draft.md) có thể dùng khi cập nhật bản sao báo cáo sau này. Không sửa DOCX chính, không kết luận đã đạt mục tiêu trưởng thành hoặc coverage toàn module/hệ thống, không ghi kết quả cuối toàn nhóm. Source/schema/DB/Manual baseline giữ nguyên; không seed/migration/commit/push.
