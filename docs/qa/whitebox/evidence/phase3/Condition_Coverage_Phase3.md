# Condition analysis — Phase 3 Member Management

Các bảng dưới đây là QA inference từ input/actor/dependency outcome được capture trong `phase3-member-traces.json` và thứ tự short-circuit của source. Đây không phải direct condition instrumentation của V8, không thay Branch Coverage, không phải MC/DC và không đại diện toàn module Member.

## Bốn hàm controller được chọn

Catalog gồm bảy predicate rõ ràng trong `getMe` và `toggleBlacklist`. `register` và `getAllUsers` không có Boolean guard tường minh trong thân hàm. Optional-chain evaluation path không được tự thêm thành predicate. `NE` nghĩa là không được đánh giá, không phải False.

| ID | Source | Predicate | True bởi | False bởi |
| --- | --- | --- | --- | --- |
| ME.1 | `authController.ts:58` | `!req.user` | WB-ME-01 | WB-ME-02/03/04 |
| ME.2 | `authController.ts:73` | `!user` | WB-ME-02 | WB-ME-03; WB-ME-04 là NE do query reject |
| TB.1 | `authController.ts:102` | `!targetUser` | WB-TB-01 | WB-TB-02/03/04/05/06/08, WB-MR-06 |
| TB.2 | `authController.ts:107` | `targetUser.id === req.user?.userId` | WB-TB-02 | WB-TB-03/04/05/06/08, WB-MR-06 |
| TB.3 | `authController.ts:111` | `typeof isBlacklisted === 'boolean'` | WB-TB-03/04/08, WB-MR-06 | WB-TB-05/06 |
| TB.fallback | `authController.ts:111` | `!targetUser.isBlacklisted` khi TB.3=False | WB-TB-05 | WB-TB-06 |
| TB.4 | `authController.ts:128` | `newStatus` | WB-TB-03/05, WB-MR-06 | WB-TB-04/06; WB-TB-08 là NE do update reject |

Kết quả catalog controller chọn: **14/14 T/F outcomes = 100%**. Số này chỉ áp dụng bảy predicate công bố. Raw ledger và vectors: [condition-ledger.json](condition-ledger.json).

## Chuỗi permission đã đăng ký

Các ca WB-MR gọi đúng references handler đã đăng ký trong `authRoutes`, theo thứ tự `authenticateToken → authorizeAdmin → controller`. Test không gọi `Router.handle`, không parse HTTP thật, vì vậy đây là unit wiring.

| ID | Source | Predicate | True bởi | False bởi |
| --- | --- | --- | --- | --- |
| AT.1 | `middleware/auth.ts:14` | truthiness của `authHeader` trong `authHeader && ...` | WB-MR-02/03/04/05/06 | WB-MR-01/07 |
| AT.2 | `middleware/auth.ts:16` | `!token` | WB-MR-01/07 | WB-MR-02/03/04/05/06 |
| AT.3 | `middleware/auth.ts:19` | `err` từ JWT callback | WB-MR-02 | WB-MR-03/04/05/06 |
| AA.1 | `middleware/auth.ts:26` | `req.user?.role !== 'ADMIN'` | WB-MR-03/05 | WB-MR-04/06 |

Kết quả catalog permission Phase 3: **8/8 T/F outcomes = 100%**. Kết luận chỉ dành cho bốn predicate và chuỗi handler unit đã capture; Authentication Phase 2 có catalog rộng hơn và được giữ riêng.

## Giới hạn

Condition Coverage toàn Member chưa xác định. Chưa có oracle để đưa email format, role/tier allow-list hoặc kiểu `isBlacklisted` sai vào execution; source hiện cũng không có các predicate validation tương ứng. Không dùng tỷ lệ 100% của catalog hẹp để kết luận module an toàn hoặc business rule đúng.

