# Audit Phase 1 trước triển khai Phase 2

Ngày báo cáo 12/10/2026 (Asia/Saigon). Đã đọc 6 tài liệu, code, mocks, config, raw logs/maps Phase 1. Source ba file đo vẫn đúng hash Phase 1. 15 case gọi controller thật; factories chỉ mock Prisma/bcrypt/JWT/mail/notification. Không sửa testcase Phase 1 hoặc Expected.

| ID | Target | Oracle | Assertion giá trị | Kết luận audit |
| --- | --- | --- | --- | --- |
| WB-LG-01 | login | S | 401 Invalid credentials; không compare/sign | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-LG-02 | login | S | 401; không sign | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-LG-03 | login | B | 200 token; JWT claims id/email/role, expiresIn=1h; DTO đúng tier, không password | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-CP-01 | changePassword | S | 401; không hash/update | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-CP-02 | changePassword | S | 400; không DB | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-CP-03 | changePassword | S | 400; không DB | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-CP-04 | changePassword | S | 400; không lookup | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-CP-08 | changePassword | B | 200; hash(new,10), update đúng userId; notification một lần | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-CP-09 | changePassword | S | 500; không notification | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-RP-04 | resetPassword | S | 400; không lookup | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-RP-08 | resetPassword | B | 400; không hash/update | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-RP-10 | resetPassword | S | 400 expired; không hash/update | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-RP-12 | resetPassword | B | 200; lookup lower/trim; hash(new,10); update password, xóa OTP+expiry; notification | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-RG-01 | register | B | 201; create nhận email/name/HASH/role USER; không plaintext | Chấp nhận trong scope unit; source logic thật được gọi |
| WB-RG-02 | register | B | 400 User already exists | Chấp nhận trong scope unit; source logic thật được gọi |

B là Expected baseline; S là contract/guard mã nguồn đã công bố, không thay thành business spec chưa chốt. Negative cases kiểm tra status/message và cấm dependency writes; happy paths kiểm tra hash call, query data, DTO/claims, notification. RG-02 mô phỏng unique error, không kiểm chứng SQLite constraint. Mocks hash/JWT không chứng minh crypto. CP-09 kỳ vọng 500 fault injection, không coi DB hỏng là đúng. RG-01 public USER không đóng DEF-001/DEF-002 hoặc POT-005.

State được reset mỗi test; fixture fresh; hai thứ tự Phase 1 đã PASS. Coverage condition Phase 1 28/38 là ledger QA suy từ execution/source, không phải cột đo tự động V8. Không có lỗi assertion/mock cần sửa trong 15 ca; chưa có credential chain bcrypt thật, middleware/route test hoặc replay stateful.

Giữ framework, provider, include/exclude. Đổi label/default output để phản ánh suite nhiều phase; thêm file network check riêng cho mỗi test module nhằm tránh ghi đè giữa module. Alias Prisma fail-closed giữ nguyên.
