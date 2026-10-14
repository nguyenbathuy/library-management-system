# Condition Coverage Evidence — Phase 2

Ngày báo cáo: 12/10/2026 (Asia/Saigon). Nguồn: [runner JSON](coverage/vitest-results.json), [traces Phase 1 rerun](coverage/case-traces.json), [controller traces mới](coverage/phase2-controller-traces.json), [middleware traces](coverage/phase2-middleware-traces.json), [source hashes](coverage/run-metadata.json).

## Phạm vi và mức kiểm chứng

Output/next/query/hash/write/no-write paths được assert trong test và thực chạy PASS. T/F nguyên tử bên dưới **được suy ra từ giá trị input/mock return đã ghi và thứ tự guard source, sau đó đối soát thủ công với đường thực thi**. Không có instrumentation trực tiếp ghi mỗi phép Boolean; không gán chúng là metric tự động V8 hoặc MC/DC. Outcome chưa có case chạy là NOT OBSERVED, không được thay bằng giá trị suy từ thiết kế.

Cùng cohort 19 guard Phase 1: **28/38 → 38/38 outcome (100%)**, thêm 10 outcome. Đây là so sánh ledger thủ công cùng mẫu số, không phải tổng Condition Coverage Authentication.

Cohort mở rộng gồm 30 predicate (19 cũ + 4 forgot + 7 middleware): **58/60 outcome (96,67%)**. Không so trực tiếp 96,67% với 73,68% vì catalog/mẫu số khác. Hai outcome chưa chạy: typeof-email sai kiểu và previewUrl falsy của forgotPassword. Optional chaining độc lập, predicates getMe/toggleBlacklist và toàn module chưa được catalog/verify đầy đủ → **Condition Coverage toàn Authentication chưa xác định**.

Register không có if Boolean; success/catch vẫn được kiểm tra bằng hai ca Phase 1. NE nghĩa guard return/short-circuit làm điều kiện không được đánh giá, không tính là F.

## Từng predicate và testcase

| Condition | Source:line / function | Expression | T từ case chạy | F từ case chạy | Outcome thiếu | Mức evidence |
| --- | --- | --- | --- | --- | --- | --- |
| LG.A | server/src/controllers/authController.ts:34 / login | !user | WB-LG-01 | WB-LG-02, WB-LG-03, WB-LG-04 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| LG.B | server/src/controllers/authController.ts:34 / login | !(await bcrypt.compare(password, user.password)) | WB-LG-02 | WB-LG-03, WB-LG-04 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| CP.1 | server/src/controllers/authController.ts:142 / changePassword | !userId | WB-CP-01 | WB-CP-02, WB-CP-03, WB-CP-04, WB-CP-08, WB-CP-09, WB-CP-05, WB-CP-06, WB-CP-07 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| CP.2A | server/src/controllers/authController.ts:148 / changePassword | !currentPassword | WB-CP-02 | WB-CP-03, WB-CP-04, WB-CP-08, WB-CP-09, WB-CP-05, WB-CP-06, WB-CP-07 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| CP.2B | server/src/controllers/authController.ts:148 / changePassword | !newPassword | WB-CP-03 | WB-CP-04, WB-CP-08, WB-CP-09, WB-CP-05, WB-CP-06, WB-CP-07 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| CP.3 | server/src/controllers/authController.ts:152 / changePassword | newPassword.length < 6 | WB-CP-04 | WB-CP-08, WB-CP-09, WB-CP-05, WB-CP-06, WB-CP-07 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| CP.4 | server/src/controllers/authController.ts:160 / changePassword | !user | WB-CP-05 | WB-CP-08, WB-CP-09, WB-CP-06, WB-CP-07 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| CP.5 | server/src/controllers/authController.ts:166 / changePassword | !isMatch | WB-CP-06 | WB-CP-08, WB-CP-09, WB-CP-07 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| CP.6 | server/src/controllers/authController.ts:171 / changePassword | currentPassword === newPassword | WB-CP-07 | WB-CP-08, WB-CP-09 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.1A | server/src/controllers/authController.ts:249 / resetPassword | !email | WB-RP-01 | WB-RP-04, WB-RP-08, WB-RP-10, WB-RP-12, WB-RP-02, WB-RP-03, WB-RP-05, WB-RP-06, WB-RP-09, WB-RP-15, WB-RP-15#2 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.1B | server/src/controllers/authController.ts:249 / resetPassword | !otp | WB-RP-02 | WB-RP-04, WB-RP-08, WB-RP-10, WB-RP-12, WB-RP-03, WB-RP-05, WB-RP-06, WB-RP-09, WB-RP-15, WB-RP-15#2 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.1C | server/src/controllers/authController.ts:249 / resetPassword | !newPassword | WB-RP-03 | WB-RP-04, WB-RP-08, WB-RP-10, WB-RP-12, WB-RP-05, WB-RP-06, WB-RP-09, WB-RP-15, WB-RP-15#2 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.2A | server/src/controllers/authController.ts:253 / resetPassword | typeof newPassword !== 'string' | WB-RP-04 | WB-RP-08, WB-RP-10, WB-RP-12, WB-RP-05, WB-RP-06, WB-RP-09, WB-RP-15, WB-RP-15#2 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.2B | server/src/controllers/authController.ts:253 / resetPassword | newPassword.length < 6 | WB-RP-05 | WB-RP-08, WB-RP-10, WB-RP-12, WB-RP-06, WB-RP-09, WB-RP-15, WB-RP-15#2 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.3 | server/src/controllers/authController.ts:264 / resetPassword | !user | WB-RP-06 | WB-RP-08, WB-RP-10, WB-RP-12, WB-RP-09, WB-RP-15, WB-RP-15#2 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.4A | server/src/controllers/authController.ts:268 / resetPassword | !user.resetOtp | WB-RP-15#2 | WB-RP-08, WB-RP-10, WB-RP-12, WB-RP-09, WB-RP-15 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.4B | server/src/controllers/authController.ts:268 / resetPassword | user.resetOtp !== cleanOtp | WB-RP-08 | WB-RP-10, WB-RP-12, WB-RP-09, WB-RP-15 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.5A | server/src/controllers/authController.ts:272 / resetPassword | !user.resetOtpExpiry | WB-RP-09 | WB-RP-10, WB-RP-12, WB-RP-15 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| RP.5B | server/src/controllers/authController.ts:272 / resetPassword | new Date(user.resetOtpExpiry) < new Date() | WB-RP-10 | WB-RP-12, WB-RP-15 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| FP.1A | server/src/controllers/authController.ts:200 / forgotPassword | !email | WB-FP-01 | WB-FP-03, WB-FP-04, WB-FP-07 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| FP.1B | server/src/controllers/authController.ts:200 / forgotPassword | typeof email !== 'string' | NOT OBSERVED | WB-FP-03, WB-FP-04, WB-FP-07 | T | Path asserted; atomic value inferred/manual checked |
| FP.2 | server/src/controllers/authController.ts:209 / forgotPassword | !user | WB-FP-03 | WB-FP-04, WB-FP-07 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| FP.P | server/src/controllers/authController.ts:237 / forgotPassword | mailResult.previewUrl | WB-FP-04 | NOT OBSERVED | F | Path asserted; atomic value inferred/manual checked |
| AT.H | server/src/middleware/auth.ts:14 / authenticateToken | authHeader | WB-AT-02, WB-AT-03, WB-AT-03#2, WB-AT-04 | WB-AT-01 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| AT.T | server/src/middleware/auth.ts:16 / authenticateToken | !token | WB-AT-01, WB-AT-02 | WB-AT-03, WB-AT-03#2, WB-AT-04 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| AT.E | server/src/middleware/auth.ts:19 / authenticateToken | err | WB-AT-03, WB-AT-03#2 | WB-AT-04 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| AA.R | server/src/middleware/auth.ts:26 / authorizeAdmin | req.user?.role !== 'ADMIN' | WB-AA-01, WB-AA-02 | WB-AA-03 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| OA.H | server/src/middleware/auth.ts:34 / optionalAuthenticateToken | authHeader | WB-OA-02, WB-OA-03 | WB-OA-01 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| OA.T | server/src/middleware/auth.ts:36 / optionalAuthenticateToken | !token | WB-OA-01 | WB-OA-02, WB-OA-03 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |
| OA.U | server/src/middleware/auth.ts:39 / optionalAuthenticateToken | user | WB-OA-03 | WB-OA-02 | Đủ T/F trong cohort | Path asserted; atomic value inferred/manual checked |

## Vector từng lượt gọi controller/middleware

RP-15 và AT-03 có hai lượt gọi trong một testcase; hậu tố #2 là invocation, không là Test ID mới.

| Test ID / invocation | Output thực | T/F/NE đã đối chiếu |
| --- | --- | --- |
| WB-RG-01#1 | {"statusCode": 201, "payload": {"message": "User created"}} | No Boolean if guard |
| WB-RG-02#1 | {"statusCode": 400, "payload": {"error": "User already exists"}} | No Boolean if guard |
| WB-LG-01#1 | {"statusCode": 401, "payload": {"error": "Invalid credentials"}} | LG.A=T, LG.B=NE |
| WB-LG-02#1 | {"statusCode": 401, "payload": {"error": "Invalid credentials"}} | LG.A=F, LG.B=T |
| WB-LG-03#1 | {"statusCode": 200, "payload": {"token": "unit-test-jwt-output", "user": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "role": "USER", "membershipTier": "STANDARD", "isBlacklisted": false}}} | LG.A=F, LG.B=F |
| WB-CP-01#1 | {"statusCode": 401, "payload": {"error": "Unauthorized"}} | CP.1=T, CP.2A=NE, CP.2B=NE, CP.3=NE, CP.4=NE, CP.5=NE, CP.6=NE |
| WB-CP-02#1 | {"statusCode": 400, "payload": {"error": "Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới"}} | CP.1=F, CP.2A=T, CP.2B=NE, CP.3=NE, CP.4=NE, CP.5=NE, CP.6=NE |
| WB-CP-03#1 | {"statusCode": 400, "payload": {"error": "Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới"}} | CP.1=F, CP.2A=F, CP.2B=T, CP.3=NE, CP.4=NE, CP.5=NE, CP.6=NE |
| WB-CP-04#1 | {"statusCode": 400, "payload": {"error": "Mật khẩu mới phải có độ dài tối thiểu 6 ký tự"}} | CP.1=F, CP.2A=F, CP.2B=F, CP.3=T, CP.4=NE, CP.5=NE, CP.6=NE |
| WB-CP-08#1 | {"statusCode": 200, "payload": {"message": "Đổi mật khẩu thành công!"}} | CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=F, CP.5=F, CP.6=F |
| WB-CP-09#1 | {"statusCode": 500, "payload": {"error": "Không thể cập nhật mật khẩu, vui lòng thử lại sau"}} | CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=F, CP.5=F, CP.6=F |
| WB-RP-04#1 | {"statusCode": 400, "payload": {"error": "Mật khẩu mới phải có tối thiểu 6 ký tự"}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=T, RP.2B=NE, RP.3=NE, RP.4A=NE, RP.4B=NE, RP.5A=NE, RP.5B=NE |
| WB-RP-08#1 | {"statusCode": 400, "payload": {"error": "Mã OTP không chính xác"}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=T, RP.5A=NE, RP.5B=NE |
| WB-RP-10#1 | {"statusCode": 400, "payload": {"error": "Mã OTP đã hết hạn, vui lòng yêu cầu gửi lại mã mới"}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=F, RP.5A=F, RP.5B=T |
| WB-RP-12#1 | {"statusCode": 200, "payload": {"message": "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới."}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=F, RP.5A=F, RP.5B=F |
| WB-LG-04#1 | {"statusCode": 200, "payload": {"token": "unit-test-jwt-output", "user": {"id": 1, "email": "user@example.com", "name": "Unit Test User", "role": "ADMIN", "membershipTier": "STANDARD", "isBlacklisted": false}}} | LG.A=F, LG.B=F |
| WB-CP-05#1 | {"statusCode": 404, "payload": {"error": "Không tìm thấy thông tin người dùng"}} | CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=T, CP.5=NE, CP.6=NE |
| WB-CP-06#1 | {"statusCode": 400, "payload": {"error": "Mật khẩu hiện tại không chính xác"}} | CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=F, CP.5=T, CP.6=NE |
| WB-CP-07#1 | {"statusCode": 400, "payload": {"error": "Mật khẩu mới không được trùng với mật khẩu hiện tại"}} | CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=F, CP.5=F, CP.6=T |
| WB-FP-01#1 | {"statusCode": 400, "payload": {"error": "Vui lòng cung cấp địa chỉ email hợp lệ"}} | FP.1A=T, FP.1B=NE, FP.2=NE, FP.P=NE |
| WB-FP-03#1 | {"statusCode": 404, "payload": {"error": "Email không tồn tại trong hệ thống"}} | FP.1A=F, FP.1B=F, FP.2=T, FP.P=NE |
| WB-FP-04#1 | {"statusCode": 200, "payload": {"message": "Mã xác thực OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư (kể cả hòm thư rác/spam).", "previewUrl": "https://example.test/unit-preview"}} | FP.1A=F, FP.1B=F, FP.2=F, FP.P=T |
| WB-FP-07#1 | {"statusCode": 500, "payload": {"error": "Không thể gửi mã xác nhận OTP, vui lòng thử lại sau"}} | FP.1A=F, FP.1B=F, FP.2=F, FP.P=NE |
| WB-RP-01#1 | {"statusCode": 400, "payload": {"error": "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới"}} | RP.1A=T, RP.1B=NE, RP.1C=NE, RP.2A=NE, RP.2B=NE, RP.3=NE, RP.4A=NE, RP.4B=NE, RP.5A=NE, RP.5B=NE |
| WB-RP-02#1 | {"statusCode": 400, "payload": {"error": "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới"}} | RP.1A=F, RP.1B=T, RP.1C=NE, RP.2A=NE, RP.2B=NE, RP.3=NE, RP.4A=NE, RP.4B=NE, RP.5A=NE, RP.5B=NE |
| WB-RP-03#1 | {"statusCode": 400, "payload": {"error": "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới"}} | RP.1A=F, RP.1B=F, RP.1C=T, RP.2A=NE, RP.2B=NE, RP.3=NE, RP.4A=NE, RP.4B=NE, RP.5A=NE, RP.5B=NE |
| WB-RP-05#1 | {"statusCode": 400, "payload": {"error": "Mật khẩu mới phải có tối thiểu 6 ký tự"}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=T, RP.3=NE, RP.4A=NE, RP.4B=NE, RP.5A=NE, RP.5B=NE |
| WB-RP-06#1 | {"statusCode": 404, "payload": {"error": "Người dùng không tồn tại"}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=T, RP.4A=NE, RP.4B=NE, RP.5A=NE, RP.5B=NE |
| WB-RP-09#1 | {"statusCode": 400, "payload": {"error": "Mã OTP đã hết hạn, vui lòng yêu cầu gửi lại mã mới"}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=F, RP.5A=T, RP.5B=NE |
| WB-RP-15#1 | {"statusCode": 200, "payload": {"message": "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới."}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=F, RP.5A=F, RP.5B=F |
| WB-RP-15#2 | {"statusCode": 400, "payload": {"error": "Mã OTP không chính xác"}} | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=T, RP.4B=NE, RP.5A=NE, RP.5B=NE |
| WB-AT-01#1 | {"responseWritten": true, "statusCode": 401, "payload": null, "nextCalls": 0, "user": null} | AT.H=F, AT.T=T, AT.E=NE |
| WB-AT-02#1 | {"responseWritten": true, "statusCode": 401, "payload": null, "nextCalls": 0, "user": null} | AT.H=T, AT.T=T, AT.E=NE |
| WB-AT-03#1 | {"responseWritten": true, "statusCode": 403, "payload": null, "nextCalls": 0, "user": null} | AT.H=T, AT.T=F, AT.E=T |
| WB-AT-03#2 | {"responseWritten": true, "statusCode": 403, "payload": null, "nextCalls": 0, "user": null} | AT.H=T, AT.T=F, AT.E=T |
| WB-AT-04#1 | {"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": {"userId": 1, "email": "user@example.com", "role": "USER"}} | AT.H=T, AT.T=F, AT.E=F |
| WB-AA-01#1 | {"responseWritten": true, "statusCode": 403, "payload": {"message": "Forbidden"}, "nextCalls": 0, "user": null} | AA.R=T |
| WB-AA-02#1 | {"responseWritten": true, "statusCode": 403, "payload": {"message": "Forbidden"}, "nextCalls": 0, "user": {"userId": 1, "email": "user@example.com", "role": "USER"}} | AA.R=T |
| WB-AA-03#1 | {"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": {"userId": 1, "email": "user@example.com", "role": "ADMIN"}} | AA.R=F |
| WB-OA-01#1 | {"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": null} | OA.H=F, OA.T=T, OA.U=NE |
| WB-OA-02#1 | {"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": null} | OA.H=T, OA.T=F, OA.U=F |
| WB-OA-03#1 | {"responseWritten": false, "statusCode": null, "payload": null, "nextCalls": 1, "user": {"userId": 1, "email": "user@example.com", "role": "USER"}} | OA.H=T, OA.T=F, OA.U=T |

Ví dụ RP-15#2 có user.findUnique return resetOtp=null sau update.data thực từ controller; response 400 và không có lần hash/update/notification thứ hai. Đây là evidence stateful của nhánh OTP đã dùng. RP-09 thiếu expiry làm predicate so sánh Date=NE. FP-07 mail reject trước khi tạo JSON nên preview predicate=NE, không được gán F. AT-03 hai callback fault objects đều đi err=T; không kiểm chứng thuật toán JWT expired/signature thật.

Đường getMe/toggleBlacklist chưa có case chạy, do đó những giá trị T/F dự kiến trong Matrix chỉ là suy luận thiết kế và không được đưa vào tỷ lệ ở đây. Không lấy branchesTrue 0/0=100% từ JSON làm Condition Coverage.
