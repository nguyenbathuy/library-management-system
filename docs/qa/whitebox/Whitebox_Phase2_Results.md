# White-box Phase 2 Results — Authentication Branch, Middleware & Conditions

Ngày báo cáo **12/10/2026**, timezone **Asia/Saigon**. **25 testcase mới; tổng Phase 1+2: 40 PASS, 0 FAIL, 0 SKIPPED, 0 TODO** trong lượt canonical coverage. Scope là phần của Tester hiện tại; không phải kết quả cuối toàn nhóm.

## 1. Objectives và audit Phase 1

Bổ sung guard/authorization/OTP paths có giá trị, thực chạy riêng Phase 1/Phase 2 và toàn suite, kiểm tra thứ tự độc lập và so sánh coverage cùng mẫu số. Đã đọc đủ 4 kế hoạch, Phase1 Results và Chapter4 Draft, test/mocks/config, raw execution logs/maps. [Audit 15 ca](evidence/phase2/Phase1_Test_Audit.md) và [gap analysis trước triển khai](evidence/phase2/Coverage_Gap_Analysis_Before.md) được lưu trước execution.

Audit chấp nhận 15 ca trong scope unit: gọi source controller thật, Expected B/S khớp Matrix/source, assertions response/call intent/no-write, reset mock state. Mocks chỉ thay Prisma/bcrypt/JWT/services. Không dùng happy-path public register để kết luận lỗi email/tier/Admin đã sửa. Hash/JWT algorithms và SQLite constraint chưa được chứng minh bằng mocks. Không chỉnh sửa/delete testcase Phase 1, không đổi Expected.

Lỗi test harness ở lần regression đầu đã được phát hiện và sửa có căn cứ (mục Findings). Evidence Phase 1 được giữ nguyên **59 file**.

## 2. Test Scope, environment và functions under test

Framework hiện có được giữ: Node **v22.23.3**, npm **10.9.9**, Vitest **4.1.0**, coverage-v8 **4.1.0**, Vite 6.3.5; không cài dependency mới hoặc đổi package/lock. Root ESM, server CommonJS; pipeline TS và test tsconfig đã type-check/run được.

Controller mới: login, changePassword, forgotPassword, resetPassword. Middleware mới: authenticateToken, authorizeAdmin, optionalAuthenticateToken và hai verify callbacks trong source thật. Toàn suite còn register của Phase 1: 8 exported functions đã gọi, V8 tính **10/13 functions/callbacks** vì có callbacks anonymous.

Git HEAD tested `3623171535cde61d8fb8dd7f02d248da3864e2e5`, workspace dirty/uncommitted. [Run metadata](evidence/phase2/coverage/run-metadata.json) lưu source/config/test hashes, version, timestamps UTC và client; [Git working tree status](evidence/phase2/coverage/git-working-tree-status.txt) là output thật, có cả thay đổi từ trước task. Canonical bắt đầu **2026-10-12T13:38:11.892430+07:00**, kết thúc **2026-10-12T13:38:13.071962+07:00** (Asia/Saigon); UTC lưu trong metadata. Clock giả của fixture không phải timestamp thực thi.

### File thêm/chỉnh sửa

- Thêm [authController.phase2.test.ts](../../../server/tests/unit/auth/authController.phase2.test.ts) (15 ca), [authMiddleware.phase2.test.ts](../../../server/tests/unit/auth/authMiddleware.phase2.test.ts) (10 ca), [phase2-cases.json](../../../server/tests/fixtures/phase2-cases.json), [phase2Evidence.ts](../../../server/tests/support/phase2Evidence.ts).
- [vitest.backend.config.ts](../../../vitest.backend.config.ts): chỉ đổi label suite và default output `artifacts/qa/whitebox/authentication/latest/`, giữ provider/include/exclude/alias/pool.
- [setup/isolation.ts](../../../server/tests/setup/isolation.ts): thêm network evidence theo từng test module; sửa cú pháp hook destructuring sau lỗi có log. Guard vẫn 8 API, chưa thay security assertions.
- Thêm báo cáo này, [Chapter4 Draft mới](Whitebox_Phase2_Chapter4_Draft.md) gộp Phase 1+2 và thư mục evidence/phase2. Không ghi đè DOCX chính, Manual Testing, bốn kế hoạch, Phase1 Results/Draft/evidence.

## 3. Test Design và testcase mới

25 ID B/S lấy từ Matrix, không trùng 15 ID Phase 1. Chọn 10 middleware, 1 role ADMIN login, 3 change-password guards, 4 forgot-password, 7 reset-password guard/reuse. Không triển khai oracle R. AT-03 dùng hai error vectors trong một ID; RP-15 gọi reset hai lần trong một ID; runner vẫn 25 testcase mới, không đếm invocations thành ID mới.

AAA, default deny cho dependency chưa arrange, reset state mỗi case, fixture synthetic trong RAM. RP-15 trả bản copy ở lookup, áp dụng update.data thật của controller vào RAM, rồi thử lại cùng OTP; nếu source không xóa mã hoặc hash/update lần hai, assertion fail. Đây không là persistence/concurrency test SQLite.

| Test ID | Function | Input(s) | Mock setup | Expected | Actual / Status | Branch theo Matrix |
| --- | --- | --- | --- | --- | --- | --- |
| WB-AT-01 | authenticateToken | [{"authorization": null, "user": null}] | [{"default": "deny unconfigured JWT calls"}] | 401; verify/next không gọi | [{"responseWritten": true, "statusCode": 401, "payload": null, "nextCalls": 0, "user": null}]; PASSED | AT.1 F; AT.2 T |
| WB-AT-02 | authenticateToken | [{"authorization": "Bearer", "user": null}] | [{"default": "deny unconfigured JWT calls"}] | 401; next không gọi | [{"responseWritten": true, "statusCode": 401, "payload": null, "nextCalls": 0, "user": null}]; PASSED | AT.1 T; AT.2 T |
| WB-AT-03 | authenticateToken | [{"authorization": "Bearer x", "user": null}, {"authorization": "Bearer x", "user": null}] | [{"default": "deny unconfigured JWT calls", "verify": {"error": {"name": "JsonWebTokenError", "message": "Simulated JsonWebTokenError"}, "decodedUser": null}}, {"default": "deny unconfigured JWT calls", "verify": {"error": {"name": "TokenExpiredError", "message": "Simulated TokenExpiredError"}, "decodedUser": null}}] | 403; next không gọi | [{"responseWritten": true, "statusCode": 403, "payload": null, "nextCalls": 0, "user": null}, {"responseWritten": true, "statusCode": 403, "payload": null, "nextCalls": 0, "user": null}]; PASSED | AT.2 F; AT.3 T |
| WB-AT-04 | authenticateToken | [{"authorization": "Bearer x", "user": null}] | [{"default": "deny unconfigured JWT calls", "verify": {"error": null, "decodedUser": {"userId": 1, "email": "user@example.com", "role": "USER"}}}] | req.user=jwtUser; next một lần | [{"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": {"userId": 1, "email": "user@example.com", "role": "USER"}}]; PASSED | AT.3 F |
| WB-AA-01 | authorizeAdmin | [{"authorization": null, "user": null}] | [{"default": "deny unconfigured JWT calls"}] | 403 Forbidden; next không gọi | [{"responseWritten": true, "statusCode": 403, "payload": {"message": "Forbidden"}, "nextCalls": 0, "user": null}]; PASSED | AA.1 T; optional chaining thiếu |
| WB-AA-02 | authorizeAdmin | [{"authorization": null, "user": {"userId": 1, "email": "user@example.com", "role": "USER"}}] | [{"default": "deny unconfigured JWT calls"}] | 403 Forbidden; next không gọi | [{"responseWritten": true, "statusCode": 403, "payload": {"message": "Forbidden"}, "nextCalls": 0, "user": {"userId": 1, "email": "user@example.com", "role": "USER"}}]; PASSED | AA.1 T |
| WB-AA-03 | authorizeAdmin | [{"authorization": null, "user": {"userId": 1, "email": "user@example.com", "role": "ADMIN"}}] | [{"default": "deny unconfigured JWT calls"}] | next một lần | [{"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": {"userId": 1, "email": "user@example.com", "role": "ADMIN"}}]; PASSED | AA.1 F |
| WB-OA-01 | optionalAuthenticateToken | [{"authorization": null, "user": null}] | [{"default": "deny unconfigured JWT calls"}] | next một lần; không verify | [{"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": null}]; PASSED | OA.1 F; OA.2 T |
| WB-OA-02 | optionalAuthenticateToken | [{"authorization": "Bearer x", "user": null}] | [{"default": "deny unconfigured JWT calls", "verify": {"error": {"name": "JsonWebTokenError"}, "decodedUser": null}}] | next; req.user vẫn undefined | [{"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": null}]; PASSED | OA.2 F; OA.3 F |
| WB-OA-03 | optionalAuthenticateToken | [{"authorization": "Bearer x", "user": null}] | [{"default": "deny unconfigured JWT calls", "verify": {"error": null, "decodedUser": {"userId": 1, "email": "user@example.com", "role": "USER"}}}] | gán user; next một lần | [{"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": {"userId": 1, "email": "user@example.com", "role": "USER"}}]; PASSED | OA.3 T |
| WB-LG-04 | login | [{"email": "user@example.com", "password": "oldpass"}] | [{"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "ADMIN", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "bcryptCompare": true, "jwtSign": "unit-test-jwt-output"}] | 200 token; claims.role=ADMIN, response.role=ADMIN | [{"statusCode": 200, "payload": {"token": "unit-test-jwt-output", "user": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "role": "ADMIN", "membershipTier": "STANDARD", "isBlacklisted": false}}}]; PASSED | LG.1 F |
| WB-CP-05 | changePassword | [{"currentPassword": "oldpass", "newPassword": "abcdef"}] | [{"default": "deny unconfigured calls", "findUnique": null}] | 404 | [{"statusCode": 404, "payload": {"error": "Không tìm thấy thông tin người dùng"}}]; PASSED | CP.3 F; CP.4 T |
| WB-CP-06 | changePassword | [{"currentPassword": "wrongpass", "newPassword": "abcdef"}] | [{"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "bcryptCompare": false}] | 400; không hash/update | [{"statusCode": 400, "payload": {"error": "Mật khẩu hiện tại không chính xác"}}]; PASSED | CP.4 F; CP.5 T |
| WB-CP-07 | changePassword | [{"currentPassword": "oldpass", "newPassword": "oldpass"}] | [{"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "bcryptCompare": true}] | 400; không hash/update | [{"statusCode": 400, "payload": {"error": "Mật khẩu mới không được trùng với mật khẩu hiện tại"}}]; PASSED | CP.5 F; CP.6 T |
| WB-FP-01 | forgotPassword | [{"email": ""}] | [{"default": "deny unconfigured calls"}] | 400; không lookup | [{"statusCode": 400, "payload": {"error": "Vui lòng cung cấp địa chỉ email hợp lệ"}}]; PASSED | FP.1: T/NE |
| WB-FP-03 | forgotPassword | [{"email": " USER@EXAMPLE.COM "}] | [{"default": "deny unconfigured calls", "findUnique": null}] | lookup user@example.com; 404 | [{"statusCode": 404, "payload": {"error": "Email không tồn tại trong hệ thống"}}]; PASSED | FP.1 F/F; FP.2 T |
| WB-FP-04 | forgotPassword | [{"email": "user@example.com"}] | [{"default": "deny unconfigured calls", "clock": "2026-10-12T00:00:00.000Z", "random": 0, "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "userUpdate": "resolve", "mail": {"resolve": {"previewUrl": "https://example.test/unit-preview"}}}] | 200; OTP=100000; expiry=T+900000; mail(to,otp,15); trả previewUrl | [{"statusCode": 200, "payload": {"message": "Mã xác thực OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư (kể cả hòm thư rác/spam).", "previewUrl": "https://example.test/unit-preview"}}]; PASSED | FP.2 F; FP.3 T |
| WB-FP-07 | forgotPassword | [{"email": "user@example.com"}] | [{"default": "deny unconfigured calls", "clock": "2026-10-12T00:00:00.000Z", "random": 0, "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-11T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "userUpdate": "resolve", "mail": {"reject": "Simulated email delivery failure"}}] | 500; OTP update đã gọi | [{"statusCode": 500, "payload": {"error": "Không thể gửi mã xác nhận OTP, vui lòng thử lại sau"}}]; PASSED | FP.E catch sau update |
| WB-RP-01 | resetPassword | [{"email": "", "otp": "123456", "newPassword": "abcdef"}] | [{"default": "deny unconfigured calls"}] | 400; không lookup/hash/update | [{"statusCode": 400, "payload": {"error": "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới"}}]; PASSED | RP.1: T/NE/NE |
| WB-RP-02 | resetPassword | [{"email": "user@example.com", "otp": "", "newPassword": "abcdef"}] | [{"default": "deny unconfigured calls"}] | 400; không lookup | [{"statusCode": 400, "payload": {"error": "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới"}}]; PASSED | RP.1: F/T/NE |
| WB-RP-03 | resetPassword | [{"email": "user@example.com", "otp": "123456", "newPassword": ""}] | [{"default": "deny unconfigured calls"}] | 400; không lookup | [{"statusCode": 400, "payload": {"error": "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới"}}]; PASSED | RP.1: F/F/T |
| WB-RP-05 | resetPassword | [{"email": "user@example.com", "otp": "123456", "newPassword": "abcde"}] | [{"default": "deny unconfigured calls"}] | 400; không lookup | [{"statusCode": 400, "payload": {"error": "Mật khẩu mới phải có tối thiểu 6 ký tự"}}]; PASSED | RP.2 F/T |
| WB-RP-06 | resetPassword | [{"email": "user@example.com", "otp": "123456", "newPassword": "abcdef"}] | [{"default": "deny unconfigured calls", "findUnique": null}] | 404 | [{"statusCode": 404, "payload": {"error": "Người dùng không tồn tại"}}]; PASSED | RP.2 F/F; RP.3 T |
| WB-RP-09 | resetPassword | [{"email": "user@example.com", "otp": "123456", "newPassword": "abcdef"}] | [{"default": "deny unconfigured calls", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": null, "createdAt": "2026-01-01T00:00:00.000Z"}}] | 400 expired; không hash/update | [{"statusCode": 400, "payload": {"error": "Mã OTP đã hết hạn, vui lòng yêu cầu gửi lại mã mới"}}]; PASSED | RP.4 F/F; RP.5 T/NE |
| WB-RP-15 | resetPassword | [{"email": "user@example.com", "otp": "123456", "newPassword": "abcdef"}, {"email": "user@example.com", "otp": "123456", "newPassword": "abcdef"}] | [{"default": "deny unconfigured calls", "clock": "2026-10-12T00:00:00.000Z", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-stored-hash", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": "123456", "resetOtpExpiry": "2026-10-12T00:00:00.001Z", "createdAt": "2026-01-01T00:00:00.000Z"}, "userUpdate": "apply actual update.data to RAM record", "bcryptHash": "unit-test-hash-output", "notification": "resolve"}, {"default": "deny unconfigured calls", "clock": "2026-10-12T00:00:00.000Z", "findUnique": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "password": "unit-test-hash-output", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false, "resetOtp": null, "resetOtpExpiry": null, "createdAt": "2026-01-01T00:00:00.000Z"}, "userUpdate": "apply actual update.data to RAM record", "bcryptHash": "unit-test-hash-output", "notification": "resolve"}] | Lần 2 bị 400; không update lần 2 | [{"statusCode": 200, "payload": {"message": "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới."}}, {"statusCode": 400, "payload": {"error": "Mã OTP không chính xác"}}]; PASSED | RP.4 T/NE sau success |


JSON đầy đủ input/mock/Expected/Actual/conditions/status cho cả 40 ca: [test-results-summary.json](evidence/phase2/test-results-summary.json). Traces nguồn: [Phase1 rerun](evidence/phase2/coverage/case-traces.json), [controller mới](evidence/phase2/coverage/phase2-controller-traces.json), [middleware](evidence/phase2/coverage/phase2-middleware-traces.json). Middleware next không viết response được ghi statusCode=null; không bịa HTTP 200 khi chưa có downstream handler.

## 4. Database/service isolation

Giữ alias @prisma/client → fail-closed guard và hoisted factories trước import; beforeAll xác nhận identity/constructor/delegate mocks trước test bodies. Hai controller files mỗi module có constructor mock đúng một lần; middleware chỉ import JWT logic không có Prisma. Gate tại [Phase1](evidence/phase2/coverage/isolation-gate.json), [controller Phase2](evidence/phase2/coverage/phase2-controller-isolation-gate.json), [middleware](evidence/phase2/coverage/phase2-middleware-isolation-gate.json).

Prisma $connect/$disconnect/$transaction không được gọi; không native SQLite, transaction thật, seed/migration hoặc production index/cron. Mail/notification/JWT/bcrypt đều mock; network guards 8 API được assert trong từng module và ghi file riêng, đều **0 attempt**. RP-15 chỉ đổi record JS trong RAM.

[Pre-execution review](evidence/phase2/pre-execution-isolation-review.json) và [preservation validation](evidence/phase2/preservation-validation.json): **222/222 file bảo vệ giữ hash nguyên**, gồm source/schema/DB/Manual/plans/Phase1 artifacts và original test/fixtures. Hai file test harness được phép đổi là config/setup. DB có Git modification từ trước Phase 2; không restore. Strace của coverage có **11140 syscall lines**, **0 dev.db matches**, **0 production index.ts matches**. [Raw trace](evidence/phase2/coverage/filesystem-syscalls.log).

## 5. Test Execution

| Run | Command thực | Total | PASS | FAIL | SKIPPED | Exit | Start client timezone |
| --- | --- | --- | --- | --- | --- | --- | --- |
| phase1-regression | npm run test:unit -- server/tests/unit/auth/authController.test.ts | 15 | 15 | 0 | 0 | 0 | 2026-10-12T13:36:39.126200+07:00 |
| phase2-only | npm run test:unit -- server/tests/unit/auth/authController.phase2.test.ts server/tests/unit/auth/authMiddleware.phase2.test.ts | 25 | 25 | 0 | 0 | 0 | 2026-10-12T13:37:33.908238+07:00 |
| unit | npm test | 40 | 40 | 0 | 0 | 0 | 2026-10-12T13:37:50.610165+07:00 |
| shuffle | npm run test:unit -- --sequence.shuffle --sequence.seed=20261012 | 40 | 40 | 0 | 0 | 0 | 2026-10-12T13:38:00.309121+07:00 |
| coverage | npm run test:coverage | 40 | 40 | 0 | 0 | 0 | 2026-10-12T13:38:11.892430+07:00 |


Run riêng Phase 1 và Phase 2, toàn suite, shuffle seed **20261012**, coverage đều success/exit 0 sau sửa hook. Thứ tự shuffle khác thật; không khẳng định mọi permutation đã chạy. Raw logs/report/metadata ở mỗi run; [execution-validation.json](evidence/phase2/execution-validation.json) đối chiếu từng ID/count/hook/network assertion.

Lệnh root repository:

```bash
npm test
npm run test:unit
npm run test:unit -- --sequence.shuffle --sequence.seed=20261012
npm run test:coverage
```

Default output lần sau: `artifacts/qa/whitebox/authentication/latest/`. Dùng env `LMS_WB_RUN_DIR` cho output riêng. Các run của báo cáo này dùng evidence/phase2 nên không overwrite Phase1 evidence. Type-check `./server/node_modules/.bin/tsc --project server/tsconfig.tests.json --noEmit` đã exit 0. Không cần khởi động app hoặc chuẩn bị SQLite data.

## 6. Coverage Results và Phase 1 vs Phase 2

Scope/provider/source/maps/mẫu số **giữ nguyên**: full authController.ts, middleware/auth.ts, routes/authRoutes.ts; exclude node_modules và server/tests. Source hashes, statementMap/branchMap/fnMap của hai phase giống nhau. [Coverage comparison JSON](evidence/phase2/coverage-comparison.json).

| Metric | Phase 1 covered/total | Phase 1 | Phase 1+2 covered/total | Phase 1+2 | Difference (điểm %) |
| --- | --- | --- | --- | --- | --- |
| Statements | 58/133 | 43.6% | 101/133 | 75.93% | +32.33 |
| Branches | 32/71 | 45.07% | 58/71 | 81.69% | +36.62 |
| Functions | 4/13 | 30.76% | 10/13 | 76.92% | +46.16 |
| Lines | 58/128 | 45.31% | 98/128 | 76.56% | +31.25 |


| File đo đầy đủ | Statement | Branch | Function | Line |
| --- | --- | --- | --- | --- |
| server/src/controllers/authController.ts | 78/101 (77.22%) | 44/57 (77.19%) | 5/8 (62.5%) | 78/99 (78.78%) |
| server/src/middleware/auth.ts | 23/23 (100%) | 14/14 (100%) | 5/5 (100%) | 20/20 (100%) |
| server/src/routes/authRoutes.ts | 0/9 (0%) | N/A (0/0) | N/A (0/0) | 0/9 (0%) |


V8 thực tạo [HTML report](evidence/phase2/coverage/coverage/index.html), [summary](evidence/phase2/coverage/coverage/coverage-summary.json), [raw maps](evidence/phase2/coverage/coverage/coverage-final.json), [LCOV](evidence/phase2/coverage/coverage/lcov.info). Phase 2 table dùng coverage của **Phase 1+2 toàn suite**, không gán 25 ca riêng cùng các tỷ lệ này. Không exclude hàm chưa chạy để nâng coverage. Routes function/branch 0/0 được ghi N/A; tool raw 100% ở 0/0 không có nghĩa đã test routing.

Thêm **43 statements, 26 branch slots, 6 functions/callbacks, 40 lines** có hit. Trong đó middleware thêm toàn bộ 23 statements/14 branch slots/5 functions; controller thêm 20 statements/12 branch slots/1 function (forgotPassword). Định nghĩa branch slot theo instrumenter, không đồng nhất số slot với số if hoặc T/F nguyên tử.

Coverage trưởng thành cho controller trong kế hoạch chưa đạt đủ: 77.22% statements, 77.19% branches, 62.5% functions, 78.78% lines. Middleware đã đạt bốn chỉ số 100% trong phạm vi mã hiện tại, nhưng không tự chứng minh JWT crypto, claim validation, OTP policy hoặc route wiring đúng.

## 7. Condition Coverage Evidence

Cùng catalog **19 atomic guard conditions** Phase 1: **28/38 → 38/38 outcome (100%)**, tăng 10 outcome thủ công. Catalog mở rộng 30 predicate (forgot/middleware thêm) có **58/60 (96.67%)**, báo riêng vì denominator khác. Full Authentication Condition Coverage **chưa xác định**.

[Ledger JSON](evidence/phase2/condition-ledger.json) và [bảng từng predicate/vector](evidence/phase2/Condition_Coverage_Phase2.md) ghi source/line, Test ID, T/F/NE, missing outcomes. Phân biệt rõ: response/next/calls có **assertion thực chạy**; T/F operator **suy từ captured values + source short-circuit, được đối soát QA**, chưa có instrumentation trực tiếp. Không gộp số thủ công vào coverage-v8, không gọi là MC/DC, không tính NE là False hoặc lấy testcase chưa chạy làm observed.

Hai outcome còn thiếu trong cohort 30: typeof email != string True (FP-02 chưa chạy), previewUrl falsy (FP-05 chưa chạy). RP.4 đã có decision True từ OTP sai ở Phase 1, nhưng chưa có condition !storedOtp=True; RP-15 bổ sung giá trị đó và evidence replay. Đây là ví dụ condition cải thiện dù cạnh if đã được cover trước.

## 8. Findings / Defects và nghi vấn OTP login

### Test harness finding đã xử lý

Lượt đầu regression: **15 body PASS nhưng suite FAIL, exit 1**, FixtureParseError ở afterAll do tham số đầu đặt tên _context. Không báo lượt đó là thành công. Sửa duy nhất hook thành destructuring `({}, suite)` theo parser Vitest; không sửa source/Expected/assertion. Phân loại **Mock Configuration Error / test harness compatibility**, đã rerun success. [Finding](evidence/phase2/test-harness-finding.json), [log nguyên](evidence/phase2/initial-hook-error/execution.log), [JSON nguyên](evidence/phase2/initial-hook-error/vitest-results.json); archive giữ nguyên nội dung trước khi chạy lại.

**0 Production Defect mới được xác nhận trong 40 ca cuối**. Không có final testcase FAIL; không chuyển các lỗi manual thành Fixed. Email/tier/Admin defects/potentials của baseline không được retest toàn luồng ở đây. Mail failure FP-07 và update failure CP-09 là fault injection có Expected 500, không phải xác nhận SMTP/SQLite live hỏng.

### AUTH-01 / POT-001

JWT được sign ngay sau credential match; OTP backend thuộc forgot/reset, không được kiểm tra trong login. authenticateToken chỉ verify JWT, authorizeAdmin xét role, không có flag hoàn thành OTP; Settings 2FA đang là local state. Đây là source facts kèm unit call evidence; chưa tái hiện popup/login MFA bằng browser hoặc protected API thật.

[Phân tích OTP chi tiết và Integration/E2E đề xuất](evidence/phase2/AUTH_OTP_Login_Analysis.md) nêu từng file/line và câu hỏi policy. **Chưa kết luận lỗ hổng bảo mật hoặc bypass bắt buộc OTP** vì Expected AUTH-01 và cấu hình MFA bắt buộc chưa được chốt. Không tự thêm Expected mới hoặc dùng AT-04 PASS để đóng POT-001.

## 9. Remaining Coverage Gaps và Pending

Còn **32 statements, 13 branch slots, 3 functions, 30 executable lines** hit=0. [gaps-and-gains.json](evidence/phase2/coverage-gaps-and-gains.json) có source locations/slot IDs thực, không ước lượng. Middleware không còn uncovered instrumented slot.

- **getMe** (:57), **getAllUsers** (:77), **toggleBlacklist** (:93) chưa test; 3 function còn thiếu đều trong controller. Member functions vẫn giữ trong denominator vì scope so sánh không đổi.
- authRoutes còn 9 statements/9 lines chưa chạy; cần route wiring riêng. `getMe` cần ưu tiên để xác nhận protected identity/DTO.
- forgotPassword thiếu wrong-type email, empty preview và update failure; resetPassword catch DB/hash/service error còn unhit (:298–299). Source hash error của register ngoài try, login missing credentials/dependency reject, changePassword hash error và credential-chain chưa kiểm chứng đầy đủ dù một số không tăng branch counter.
- Không khẳng định concurrency/chống replay đa request/native SQL hoặc mail delivery/JWT expiry thật từ mocks.

Pending không phải SKIPPED của runner (runner SKIPPED=0): FP-08 whitespace email, RP-11 expiry=T, RP-14 email truthy sai kiểu, RG-06 email invalid contract, RG-07 authorized ADMIN creation. POT-001 cần chốt loại popup/config/MFA policy. Login missing credentials chưa có ID/HTTP oracle trong Matrix; ghi PENDING DESIGN/CONTRACT trước bổ sung, không bịa Expected 400/401. Toàn bộ oracle R gốc và Manual baseline giữ nguyên.

## 10. Recommendations Phase 3 và Chương 4

Ưu tiên getMe 3 ca, forgot FP-02/05/06, reset RP-13 DB error; CP-10 hậu notification failure và CP-11/RP-16 với bcrypt thật trong RAM cho login password mới/cũ. Bổ sung hash failure design khi có Expected/error contract rõ; route wiring trong app thử với mocks và không import production index/cron. getAllUsers/toggleBlacklist chuyển tiếp scope Member khi phù hợp; không viết thêm ca chỉ để làm tỷ lệ cao.

Sau chốt mandatory MFA, thực hiện Integration/E2E riêng trên môi trường cô lập theo OTP analysis. Không sửa source/DB chính, schema, business rules, Manual/Phase1 evidence hoặc commit/push trong Phase 2.

**Phase 2 cải thiện coverage thực chất**: cả guard invalid input, permission denial/allow, OTP reuse và mail error paths đều có assertions/output thực. **Đủ evidence cập nhật Chương 4 cho Authentication Phase 1+2** với 40 ca, same-scope metrics và giới hạn đã công bố; chưa đủ khẳng định toàn Authentication đã kiểm thử hoàn chỉnh. [Bản nháp Chương 4 cập nhật](Whitebox_Phase2_Chapter4_Draft.md) là phiên bản mới, giữ bản Phase1 và DOCX chính nguyên vẹn.
