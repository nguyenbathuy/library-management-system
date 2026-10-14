# AUTH-01 / POT-001 — phân tích OTP login và đề xuất kiểm chứng

Ngày: 12/10/2026. Phân loại hiện tại: **Requirement Clarification / Potential Defect cần xác minh**, giữ baseline POT-001; chưa kết luận lỗ hổng hoặc gán severity. Source hash và commit tại [metadata](coverage/run-metadata.json); đây là source analysis và unit evidence, chưa Integration/E2E.

| Câu hỏi | Bằng chứng nguồn thực tế | Kết luận trong phạm vi |
| --- | --- | --- |
| JWT được cấp lúc nào? | authController.ts:30–54: lookup email, compare password ở 34, sign ở 38–42, trả token/user ở 44 | JWT cấp sau credential match, không có bước login OTP trong hàm. LG-03/04 assert sign claims/expiry; sign library được mock. |
| Backend có xác minh OTP không? | forgotPassword:197 sinh/lưu/gửi mã; resetPassword:245 kiểm tra mã và hạn rồi xóa; authRoutes:16–23 có login, forgot, reset | Có OTP của reset password. Không có verify-login-OTP endpoint/logic trong các source được kiểm tra. |
| Protected API có yêu cầu hoàn thành OTP? | middleware/auth.ts:12–29 verify JWT rồi next; ADMIN xét role. GET /me và /users/blacklist trong authRoutes dùng các middleware này | Không có check otpVerified/mfaCompleted trong các middleware. AT-04 chuyển payload userId/email/role tới next dù không có OTP field; callback JWT là mock. Route wiring thật chưa được thực thi. |
| Có branch bypass OTP? | login và authenticateToken không có nhánh OTP, AuthRequest chỉ userId/email/role | Không có nhánh kiểm tra OTP login để gọi là bypass trong code này. Chưa biết requirement bắt buộc MFA đã được chốt hay chưa. |
| UI popup/2FA thuộc luồng nào? | Login.tsx:33–46 gọi login trực tiếp; 57/79 xử lý forgot/reset OTP; Settings.tsx:38 và 463 giữ twoFactorEnabled ở useState và nút chỉ đảo state | Source hiện tại cho thấy OTP modal là quên/đặt lại password; toggle 2FA cục bộ chưa có request persistence/gating. Chưa tái hiện popup mà Tester đã ghi. |
| Frontend protected routes kiểm gì? | App.tsx:24–29 AdminRoute xét user.role; :44–46 xét isAuthenticated; AuthContext.tsx:48–61 lưu token/user và isAuthenticated=!!user | Chưa có OTP-completed flag ở các guard này. Đây là kiểm tra source, chưa có browser evidence. |

**Giới hạn:** Unit đang mock jwt.sign/verify, không kiểm tra chữ ký/hạn thực. Không mở browser, không gọi API live, không dùng tài khoản thật hoặc gửi OTP thật. Không sửa Expected AUTH-01 để thêm MFA; Expected manual hiện chưa buộc login OTP. Không tự đóng POT-001 vì các unit cases PASS.

## Những việc Tester cần xác nhận

- Popup thực tế là forgot/reset, login MFA hay popup khác? Lưu bước, URL, screenshot/video và network trace, phiên bản đang test.
- 2FA có bắt buộc và áp dụng theo user/global/role không? Cấu hình bật được lưu ở backend hay chỉ giao diện? Chốt source of truth/business acceptance.
- Khi credentials đúng nhưng chưa OTP, token phải chưa cấp hay phải hạn chế quyền? Protected endpoints phải phản hồi thế nào? Những điều này chưa có contract trong source/Expected manual.

## Integration/E2E đề xuất sau khi chốt policy

Các kịch bản dưới đây là đề xuất, **chưa chạy và chưa gán PASS/FAIL hoặc ID Unit Matrix**:

1. Với user có mandatory 2FA được xác nhận: credential đúng nhưng chưa OTP → kiểm tra token/claims/session và protected request theo policy đã chốt.
2. Đóng/cancel popup, reload, login lần hai, gọi protected endpoint trực tiếp hoặc dùng token của bước credential → xác minh vẫn bị chặn nếu OTP bắt buộc.
3. OTP sai, hết hạn và dùng lại → từ chối; OTP đúng → cấp/quyền token và protected request theo policy. Giữ biên expiry=T pending cho đến khi chốt.
4. Tắt 2FA theo quyền hợp lệ và user/role khác → kiểm tra policy/persistence đúng, tránh giả định mọi tài khoản đều giống nhau.

Dùng app thử/staging cô lập với fake mailbox và DB disposable/datasource override được cho phép; không dùng server/prisma/dev.db, production index/cron hoặc seed main DB. Lưu network/browser/server logs đúng sự kiện, redact token/password/OTP thật. Backend hiện chưa có contract enable/verify login MFA, nên cần requirement/Dev thiết kế trước khi khẳng định expected 2FA gates; Phase 2 không sửa production để thêm chúng.
