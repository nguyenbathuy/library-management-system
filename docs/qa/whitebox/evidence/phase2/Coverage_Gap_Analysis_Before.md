# Phân tích gap trước triển khai Phase 2

Source không đổi so Phase 1. Danh sách slot raw: ../phase1/coverage-gaps.json. 25 testcase bổ sung, 40 ID toàn suite. RP-15 thực hiện reset rồi dùng lại OTP trong RAM để cover nhánh resetOtp đã xóa; không chỉ dựng fixture không có OTP.

| File / function / line | Gap Phase 1 | Test IDs mới | Giá trị kiểm thử |
| --- | --- | --- | --- |
| middleware/auth.ts:12–23 authenticateToken | 0 hit header/token/error/success | WB-AT-01..04 | Header thiếu, token thiếu, error invalid/expired cùng nhánh err, next có decoded user |
| middleware/auth.ts:25–30 authorizeAdmin | 0 hit role guard | WB-AA-01..03 | Anonymous/USER bị chặn, ADMIN được next |
| middleware/auth.ts:32–44 optionalAuthenticateToken | 0 hit anonymous/error/user callback | WB-OA-01..03 | Giữ contract anonymous optional, không bắt auth ngoài spec |
| authController.ts:30 login | USER đã chạy; ADMIN chưa | WB-LG-04 | Role token/DTO lấy từ record ADMIN |
| authController.ts:160/166/171 changePassword | True outcomes chưa chạy | WB-CP-05/06/07 | Thiếu user, password cũ sai, dùng lại password; cấm hash/update |
| authController.ts:197–243 forgotPassword | Toàn function chưa chạy | WB-FP-01/03/04/07 | Missing email, normalize unknown, OTP/TTL/preview, mail failure sau update |
| authController.ts:249/253/264 resetPassword | Missing từng field, password 5, user missing chưa chạy | WB-RP-01/02/03/05/06 | OR short-circuit và các guard dừng trước lưu |
| authController.ts:268/272 resetPassword | stored OTP missing / expiry missing chưa chạy | WB-RP-15/09 | OTP sau dùng lại bị chặn; thiếu expiry bị chặn |

Chưa chọn: getMe, getAllUsers, toggleBlacklist, route wiring, hash error, reset update error, forgot sai kiểu email/no-preview/update failure, credential-chain. Có limit 25 ca mới và ưu tiên middleware/guard/replay. Pending R: FP-08/RP-11/RP-14/RG-06/RG-07; login missing credentials không có case/HTTP oracle rõ trong Matrix, cần review design/contract trước bổ sung.
