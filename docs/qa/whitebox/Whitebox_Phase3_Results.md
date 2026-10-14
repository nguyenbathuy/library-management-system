# White-box Testing Phase 3 Results — Member Management

Ngày thực thi: 12/10/2026 (Asia/Ho_Chi_Minh). Báo cáo này tiếp tục [Phase 2](Whitebox_Phase2_Results.md), chỉ thuộc phạm vi Tester hiện tại. Baseline/manual, Phase 1/2, production source, schema và database không bị ghi đè.

## 1. Mục tiêu, phạm vi và boundary

Phase 3 ưu tiên source thật trong [authController.ts](../../../server/src/controllers/authController.ts): `register`, `getMe`, `getAllUsers`, `toggleBlacklist`; đồng thời kiểm tra chuỗi handler đã đăng ký trong [authRoutes.ts](../../../server/src/routes/authRoutes.ts) qua `authenticateToken` và `authorizeAdmin`. 25 testcase mới tập trung tier regression, public DTO, identity guard, blacklist state/error paths và permission trước query/write. 40 testcase Authentication Phase 1+2 được chạy regression nguyên trạng.

Đây là unit/controller và unit wiring: test đọc stack registration rồi gọi đúng function references theo thứ tự; không gọi `Router.handle`, không mở listener, không gửi HTTP thật. Prisma, bcrypt, JWT, mail/notification và network được mock trước import; fixture chỉ tồn tại trong RAM. Kết quả không chứng minh SQLite persistence, Prisma native default/constraint, JWT cryptography, SMTP, browser UI hoặc E2E.

Source HEAD quan sát `3623171535cde61d8fb8dd7f02d248da3864e2e5`, workspace dirty; metadata từng run lưu hash source/config/test thực thi. Node v22.23.3, npm 10.9.9, Vitest và coverage-v8 4.1.0, Vite 6.3.5. [Evidence index](evidence/phase3/README.md).

## 2. Phân tích source và control flow

[Source analysis chi tiết](evidence/phase3/Member_Source_Analysis.md) giữ file/hàm/điều kiện/đường đi và boundary. Tóm tắt:

| Hàm/chuỗi | Đường đi được chọn | Dependency boundary |
| --- | --- | --- |
| `register` | hash reject; create với LECTURER/PREMIUM | bcrypt + `prisma.user.create`; hash nằm ngoài `try` |
| `getAllUsers` | empty/mixed list; query reject | `findMany` với safe select/order; không có catch |
| `getMe` | no identity; missing user; DTO; query reject | `req.user` + `findUnique`; không có catch |
| `toggleBlacklist` | missing/self; explicit/toggle state; lookup/update reject | `findUnique` + `update`; catch trả 500 |
| registered routes | anonymous/JWT error/USER/ADMIN cho GET và PATCH | middleware + controller references, không full HTTP dispatch |

Source không có predicate email-format, tier allow-list hay role allow-list ở `register`. Việc thiếu predicate là observation implementation, không tự xác lập business rule.

## 3. Test execution results

Canonical Phase 3 evidence là `combined-coverage`: **65 testcase distinct = 40 cũ + 25 mới; 63 PASS, 2 FAIL, 0 SKIPPED, 0 TODO**. Hai FAIL được giữ nguyên vì phát hiện DEF-002. Không có harness/environment failure ngoài Expected production defect.

| Run | PASS | FAIL | SKIPPED/TODO | Exit | Kết luận |
| --- | ---: | ---: | ---: | ---: | --- |
| Member unit | 23 | 2 | 0/0 | 1 | Chỉ WB-RG-04/05 fail |
| Authentication regression | 40 | 0 | 0/0 | 0 | Không regression |
| Combined unit | 63 | 2 | 0/0 | 1 | Cùng hai FAIL |
| Combined shuffle seed 20261012 | 63 | 2 | 0/0 | 1 | Thứ tự khác, kết quả ổn định |
| Member coverage | 23 | 2 | 0/0 | 1 | HTML/raw map đã lưu |
| Authentication coverage | 40 | 0 | 0/0 | 0 | Counters khớp Phase 2 |
| Combined coverage | 63 | 2 | 0/0 | 1 | Canonical |

### 3.1. Chi tiết 25 testcase mới

Oracle B lấy từ baseline; S mô tả contract/source boundary quan sát được; không chạy oracle R chưa chốt.

| Test ID | Function/path | Input/branch chính | Expected và actual | Oracle | Status |
| --- | --- | --- | --- | --- | --- |
| WB-RG-03 | register | bcrypt hash reject trước create | Cùng error bị reject; không create/response | S | PASS |
| WB-RG-04 | register | tier LECTURER | Expected create giữ tier; actual payload thiếu field | B, DEF-002 | **FAIL** |
| WB-RG-05 | register | tier PREMIUM | Expected create giữ tier; actual payload thiếu field | B, DEF-002 | **FAIL** |
| WB-GU-01 | getAllUsers | `findMany=[]` | 200 `[]`; safe select/order; không write | S | PASS |
| WB-GU-02 | getAllUsers | mixed role/tier/blacklist | Trả đúng DTO công khai; không select secret | S | PASS |
| WB-GU-03 | getAllUsers | query reject | Cùng error propagate; chưa ghi response/write | S | PASS |
| WB-ME-01 | getMe | không có `req.user` | 401; không query/write | S | PASS |
| WB-ME-02 | getMe | identity có, user null | 404; query đúng userId/safe select | S | PASS |
| WB-ME-03 | getMe | USER tồn tại | 200 DTO công khai gồm tier; không write | S | PASS |
| WB-ME-04 | getMe | query reject | Cùng error propagate; chưa ghi response | S | PASS |
| WB-TB-01 | toggleBlacklist | target null | 404; không update | S | PASS |
| WB-TB-02 | toggleBlacklist | target là actor | 400; không update | S | PASS |
| WB-TB-03 | toggleBlacklist | old=false, flag=true | Update true; message block; safe select | B | PASS |
| WB-TB-04 | toggleBlacklist | old=true, flag=false | Update false; message unblock; safe select | B | PASS |
| WB-TB-05 | toggleBlacklist | old=false, bỏ flag | Toggle true | S | PASS |
| WB-TB-06 | toggleBlacklist | old=true, bỏ flag | Toggle false | S | PASS |
| WB-TB-08 | toggleBlacklist | update reject | 500; exact attempted update | S | PASS |
| WB-TB-09 | toggleBlacklist | lookup reject | 500; không update | S | PASS |
| WB-MR-01 | GET users wiring | không header | 401 trước query/write | S | PASS |
| WB-MR-02 | GET users wiring | JWT verifier error | 403 trước authorize/query | S | PASS |
| WB-MR-03 | GET users wiring | decoded USER | 403 trước controller/query | S | PASS |
| WB-MR-04 | GET users wiring | decoded ADMIN | 200 DTO; đúng thứ tự handler; một query | S | PASS |
| WB-MR-05 | PATCH blacklist wiring | decoded USER | 403 trước lookup/update | S | PASS |
| WB-MR-06 | PATCH blacklist wiring | ADMIN, target 2, flag=true | 200; controller gọi exact update true | S | PASS |
| WB-MR-07 | PATCH blacklist wiring | không header | 401; không JWT/query/write | S | PASS |

Full input design, branch label, reason và captured calls nằm trong [fixture](../../../server/tests/fixtures/phase3-cases.json) và [test result summary](evidence/phase3/test-results-summary.json).

## 4. Coverage thực đo

V8 provider đo nguyên ba file `authController.ts`, `middleware/auth.ts`, `authRoutes.ts`, exclude tests/node_modules. Selector chỉ đổi test được chạy, không đổi source denominator.

| Execution scope | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Member-only, 25 ca | 59/133 (44.36%) | 20/71 (28.16%) | 7/13 (53.84%) | 55/128 (42.96%) |
| Authentication regression, 40 ca | 101/133 (75.93%) | 58/71 (81.69%) | 10/13 (76.92%) | 98/128 (76.56%) |
| Combined, 65 ca | 131/133 (98.49%) | 70/71 (98.59%) | 13/13 (100%) | 126/128 (98.43%) |

Authentication counters và raw instrumentation maps khớp Phase 2. Combined tăng so với Phase 2 cùng mẫu số: +30 statements, +12 branches, +3 functions, +28 lines; tương ứng +22.56, +16.90, +23.08, +21.87 điểm phần trăm. Hai test fail vẫn thực thi source, nên coverage cao không làm DEF-002 thành PASS.

Để mô tả đúng phần Member, raw V8 map được lọc theo location nằm trọn trong bốn function bodies, không sửa include:

| Selected Member bodies | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Member-only | 26/27 (96.29%) | 12/12 (100%) | 4/4 (100%) | 24/25 (96.00%) |
| Combined | 27/27 (100%) | 12/12 (100%) | 4/4 (100%) | 25/25 (100%) |

Đây là **derived selected function-body coverage**, không phải report whole-file V8 riêng. Member-only còn catch duplicate `register:26`, đã được WB-RG-02 cover trong combined. Combined còn reset-password catch lines 298–299 và fallback `previewUrl` line 237. [Coverage summary/raw links](evidence/phase3/README.md), [gaps](evidence/phase3/Coverage_Gaps_Phase3.md).

`authRoutes.ts` trong Member/combined có 9/9 statement/line vì import chạy declarations; denominator branch/function 0/0 là N/A, không phải route behavior 100%.

## 5. Condition coverage

Ledger thủ công cho bảy core predicates trong `getMe`/`toggleBlacklist` quan sát **14/14 T/F outcomes**. Catalog permission của unit wiring có bốn predicate, quan sát **8/8 T/F outcomes**. Kết quả suy từ captured values + source order, không phải V8 direct instrumentation; NE do short-circuit không tính F. Không công bố full Member Condition Coverage hay MC/DC. [Bảng condition và giới hạn](evidence/phase3/Condition_Coverage_Phase3.md).

## 6. Defect findings

### DEF-002 / MEM-05 — tái hiện ở controller boundary

WB-RG-04 và WB-RG-05 đều nhận tier đã chọn nhưng exact `prisma.user.create` data chỉ có email/name/hash/`role: 'USER'`; `membershipTier` bị thiếu. Đây là bằng chứng thực thi cho cùng DEF-002, nên có **một Confirmed Defect hiện hữu**, không tạo hai defect mới. Trạng thái giữ **OPEN**; không sửa source, không đánh dấu Fixed.

Schema default `STANDARD` phù hợp với ghi nhận manual “LECTURER thành STANDARD”, nhưng unit không gọi SQLite/Prisma native nên chưa chứng minh persistence/default hoặc UI. [Defect verification](evidence/phase3/Defect_Verification_Phase3.md).

### Chưa tái hiện/kết luận

- DEF-001/MEM-02 vẫn Confirmed theo manual baseline nhưng Phase 3 chưa tái hiện exact create-then-login failure; thiếu exact invalid input/error và validation contract.
- POT-005 và ADMIN creation còn requirement clarification.
- Promise rejection ở WB-RG-03/GU-03/ME-04 chỉ là characterization của function boundary, chưa xác nhận live HTTP status/message hay defect mới.

## 7. Evidence, isolation và validation

Mock Prisma được đăng ký trước import; constructor/delegate identity gate chạy trước cases. Các run ghi 0 call `$connect/$disconnect/$transaction`, 0 network attempt qua tám API được guard. Type-check exit 0. Shuffle có thứ tự khác run thường nhưng giữ đúng hai failure. `strace trace=%file` riêng combined coverage ghi 14.614 dòng, không có match database chính hoặc `server/src/index.ts`; giới hạn ở command/cơ chế đã trace.

Không chạy seed/migration, app bootstrap, DB thật, SMTP hoặc server listener. Production source/schema/database, test/evidence Phase 1/2 và Expected được giữ. [Execution validation](evidence/phase3/execution-validation.json), [preservation validation](evidence/phase3/preservation-validation.json).

## 8. Pending, chưa test và Phase 4

Tám design items có oracle/contract chưa đủ nên **không đăng ký vào runner và không tính SKIPPED**: WB-RG-06 invalid email; WB-RG-07 ADMIN creation; WB-TB-07 string `false`; WB-MA-04 UI invalid email; WB-RG-08 missing fields; WB-RG-09 invalid tier; WB-RG-10 invalid role; WB-TB-10 non-numeric id. Cần Product/BA xác nhận exact accepted values, validation status/message và privilege policy.

13 case UI theo Matrix (MA/MF/MT) chưa triển khai; jsdom/Testing Library chưa là direct dependency. Native SQLite constraints/default, full Express dispatch, concurrency, persistence và browser workflow cũng chưa test.

Phase 4 nên ưu tiên Book Management/Excel Import vì transaction/parser/duplicate/error paths nhiều nhánh; sau đó Member UI với dependency được duyệt. Integration retest DEF-002 chỉ thực hiện sau khi Dev sửa, trên disposable DB có datasource override được xác minh; không dùng database chính. DEF-001 cần chốt oracle trước integration/E2E.

Evidence hiện tại **đủ để đưa Phase 3 vào Chương 4** với 25 ca mới, regression 40 ca, hai failure DEF-002 và giới hạn trên. Không đủ để tuyên bố Member Management/toàn hệ thống hoàn tất hay DEF-002 đã Fixed.

