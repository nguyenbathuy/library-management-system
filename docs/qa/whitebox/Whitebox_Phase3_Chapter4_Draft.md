# Nháp Chương 4 cập nhật — Member Management White-box Phase 3

Ngày 12/10/2026 (Asia/Ho_Chi_Minh). Đây là phiên bản mới nối tiếp [nháp Phase 2](Whitebox_Phase2_Chapter4_Draft.md), giữ các bản cũ và DOCX chính nguyên vẹn. Nội dung chỉ thuộc Tester hiện tại. Căn cứ đầy đủ: [Phase 3 Results](Whitebox_Phase3_Results.md), [evidence index](evidence/phase3/README.md).

## 4.1. Phạm vi và phương pháp

Phase 3 triển khai 25 testcase mới cho `register`, `getMe`, `getAllUsers`, `toggleBlacklist` và chuỗi permission của GET/PATCH member routes. 40 testcase Authentication Phase 1+2 được chạy regression, tạo tổng 65 ID không trùng. Tests gọi source function thật theo AAA; Prisma/JWT/bcrypt/mail/network được mock trước import và fail-closed. Route cases xác nhận references/thứ tự handler đã đăng ký ở tầng unit wiring; không chạy HTTP server, database hoặc UI.

Oracle B giữ Expected manual, oracle S mô tả boundary kỹ thuật quan sát được. Tám item cần policy được giữ pending ngoài runner, không báo SKIPPED. Không thay business rule/Expected để hợp thức hóa source.

## 4.2. Kết quả thực thi

Phase 3 riêng: **23 PASS, 2 FAIL, 0 SKIPPED, 0 TODO**. Authentication regression: **40 PASS, 0 FAIL**. Combined, shuffle seed 20261012 và combined coverage đều **63 PASS, 2 FAIL**; chỉ WB-RG-04/WB-RG-05 fail. Type-check exit 0; không có harness/environment failure ngoài hai assertion defect.

Hai failure tái hiện DEF-002 tại controller-to-Prisma boundary: request chọn LECTURER/PREMIUM nhưng actual `prisma.user.create.data` thiếu `membershipTier`. Source trả create payload gồm email/name/hash/USER role. DEF-002 giữ OPEN; một defect hiện hữu liên quan hai variants, không tạo hai defect mới và không đánh dấu Fixed. Unit chưa chứng minh schema default/persistence hoặc UI.

Các PASS có assertions về no-query/no-write guard, safe DTO/select, identity 401/404, self-blacklist 400, explicit/toggle blacklist, dependency errors và anonymous/USER/ADMIN permission. Fault injection chỉ chứng minh response/call behavior trong unit boundary.

## 4.3. Coverage và condition

V8 4.1.0 đo nguyên ba file `authController.ts`, `middleware/auth.ts`, `authRoutes.ts`:

| Scope | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Member-only | 59/133 (44.36%) | 20/71 (28.16%) | 7/13 (53.84%) | 55/128 (42.96%) |
| Authentication regression | 101/133 (75.93%) | 58/71 (81.69%) | 10/13 (76.92%) | 98/128 (76.56%) |
| Combined | 131/133 (98.49%) | 70/71 (98.59%) | 13/13 (100%) | 126/128 (98.43%) |

Authentication counters khớp Phase 2. Selected function-body analysis cho bốn hàm Member đạt 26/27 statements, 12/12 branches, 4/4 functions, 24/25 lines ở Member-only; combined đạt 100% bốn metric trên cùng selected bodies. Đây là metric suy dẫn từ raw maps và khác mẫu số whole-scope.

Ledger condition thủ công đạt 14/14 outcomes cho bảy core predicates controller và 8/8 cho bốn predicate permission. Đây là QA inference từ trace/source order, không phải V8 Condition Coverage, không phải MC/DC và không đại diện toàn Member. Combined còn hai statement/line trong reset-password catch và một branch fallback preview URL.

## 4.4. Defect, giới hạn và công việc tiếp theo

DEF-002/MEM-05 được củng cố bằng execution, nhưng chỉ đến Prisma call boundary. DEF-001/MEM-02 chưa được tái hiện độc lập vì thiếu exact invalid input/login error và contract validation. POT-005/ADMIN creation cùng validation email/tier/role/boolean/id vẫn cần Product/BA xác nhận.

Chưa kiểm thử 13 case Member UI, full Express dispatch, Prisma/SQLite native persistence/default/constraint, concurrency hoặc browser workflow. Coverage chỉ áp dụng ba source file đã công bố; route declaration hit không có nghĩa mọi endpoint được test.

Phase 4 đề xuất Book Management/Excel Import trước do transaction/parser/duplicate paths có rủi ro cao, sau đó Member UI. Integration retest DEF-002 dùng disposable DB sau khi Dev sửa và có nhiệm vụ riêng; database chính không được dùng.

Kết quả **đủ bằng chứng để trình bày Phase 3 trong Chương 4** như một vòng unit có hai defect failures được giữ trung thực. Chưa đủ để tuyên bố kết quả cuối nhóm, Member Management hoàn chỉnh hoặc production-ready; DOCX chính chưa được sửa.

