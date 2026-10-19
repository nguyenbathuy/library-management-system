# Tổng kết đợt mở rộng kiểm thử tự động (19/10/2026)

Nhánh `test/automation-ch5-ch6`, nối tiếp [SUMMARY_CH5_CH6](SUMMARY_CH5_CH6.md). Mọi con số lấy từ output thật trong `test-results/extension/` (cột nguồn ghi kèm). Evidence Chương 5–6 (`test-results/{unit,integration,e2e,mutation,...}`) được giữ nguyên.

> **Phạm vi và quy ước**
> - **Không sửa mã sản phẩm** (`server/src`, `src`) theo yêu cầu của người dùng: chỉ thêm test, tooling, CI và tài liệu. Ca nào hệ thống sai so với đặc tả được viết theo đặc tả đúng, đánh dấu `test.fails` / `test.fail` và ghi nhận ở mục 4; lý do thất bại được chứng minh bằng `server/tests/support/verify-known-bugs.mjs`.
> - Ca `test.fails` vẫn được Vitest tính là "xanh"; ở các bảng chúng được tách riêng khỏi PASS.
> - **CI GitHub chưa chạy** (chưa commit/push trong lượt này). Kết quả dưới đây là chạy cục bộ, không phải GitHub Actions.
> - Căn cứ của một số lỗi (FIND-06/07/11/12/13/20/22) là chú thích mã nguồn hoặc nguyên tắc bảo mật, chưa phải yêu cầu đã được nhóm xác nhận; mỗi ca ghi rõ căn cứ ở header file test.

## 1. Công cụ (thực tế)

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js / npm | v22.23.3 / 10.9.9 | Linux x64 |
| Vitest + coverage-v8 | 4.1.0 | không đổi so với Chương 5–6 |
| @playwright/test | 1.64.0 | Chromium |
| ESLint / @eslint/js / typescript-eslint / globals | 10.13.0 / 10.0.1 / 8.71.2 / 17.13.0 | **mới**, cài exact; lockfile chỉ thêm 80 package, không đổi phiên bản package hiện có |
| TypeScript (server) | 5.9.3 | dùng cho `typecheck`, `typecheck:frontend` |
| Stryker | 10.0.0 | thêm `stryker.extension.config.mjs` |

## 2. Kết quả theo loại kiểm thử (lượt chuẩn)

| Loại | Số file | Số ca | PASS | Expected fail | FAIL ngoài dự kiến | Thời gian | Nguồn |
|---|---|---|---|---|---|---|---|
| Unit (scope `all`) | 18 | 513 | 484 | 29 | 0 | 3,38 s | `extension/unit/vitest-output.txt` |
| Tích hợp API (supertest + SQLite tạm) | 11 | 235 | 197 | 38 | 0 | 30,89 s | `extension/integration/vitest-output.txt` |
| E2E Playwright (Chromium) | 7 | 22 | 18 | 4 | 0 | 47,8 s | `extension/e2e/playwright-output.txt` |
| **Tổng** | **36** | **770** | **699** | **71** | **0** | | |

- So với lượt Chương 5–6 (216 ca: 178 PASS + 38 expected fail): thêm **+554 ca** (unit +364, tích hợp +182, E2E +8).
- Exit code mọi lượt đều `0`. Chạy lại với `--sequence.shuffle` cho cùng kết quả: unit `484 passed | 29 expected fail`, tích hợp `197 passed | 38 expected fail` (`extension/unit-shuffle-output.txt`, `extension/integration-shuffle-output.txt`).
- Lượt tích hợp và E2E chạy trên DB tạm; hash `server/prisma/dev.db` trước/sau mọi lượt không đổi (`sha256sum -c` đạt).
- Bằng chứng lý do thất bại: khi tắt `test.fails`, đúng số ca expected-fail bị fail bằng assertion nghiệp vụ — unit **26** ca (+3 ca property ở file riêng = 29), tích hợp **36** ca (+2 ca fuzz API = 38) (`extension/known-bug-verification-unit.txt`, `extension/known-bug-verification-integration.txt`).

Số ca theo file (Vitest đếm ca `test.fails` là "passed"; xem `unit/vitest-results.json`, `integration/vitest-results.json`):

| Module | Unit | Tích hợp |
|---|---|---|
| authController / middleware (Chương 5) | 15 + 15 + 10 + 20 | 12 + **38** (`auth.account`) |
| memberManagement (Chương 4) | 25 | — |
| loanController + loanRules | 32 + 23 + **59** (`borrowAndLists`) + **48** (`returnAndRenew`) + 9 property | 39 + **22** (`loans.lists`) |
| bookController (CRUD, Excel, e-book, gợi ý) | **79** | **43** |
| reservationController | **42** | **24** |
| paymentController | **33** | **14** |
| inventoryController | **26** | **15** |
| notificationController + service | **18** | **12** |
| analyticsController | **18** | **14** |
| mailService | **24** | (stub) |
| reminderJob | **17** | (qua `/loans/reminders/trigger`) |
| Fuzz API | — | 2 |

(**in đậm** = mới ở đợt này.)

## 3. Coverage (V8)

### 3.1. Unit, scope `all` — mẫu số: `server/src/{controllers,middleware,services,utils,jobs}`

Nguồn: `extension/unit/coverage/coverage-summary.json`. Mẫu số khác lượt Chương 5–6 (thêm `jobs/**`, 1.304 statements thay vì 1.245): **không so trực tiếp** 97,62% với 31,48%.

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| controllers/analyticsController.ts | 45/45 (100%) | 22/22 (100%) | 9/9 (100%) | 43/43 (100%) |
| controllers/authController.ts | 166/178 (93,25%) | 93/97 (95,87%) | 11/11 (100%) | 164/175 (93,71%) |
| controllers/bookController.ts | 328/342 (95,9%) | 251/269 (93,3%) | 23/27 (85,18%) | 307/321 (95,63%) |
| controllers/inventoryController.ts | 51/51 (100%) | 61/65 (93,84%) | 7/7 (100%) | 50/50 (100%) |
| controllers/loanController.ts | 302/307 (98,37%) | 255/260 (98,07%) | 20/20 (100%) | 290/295 (98,3%) |
| controllers/notificationController.ts | 51/51 (100%) | 14/14 (100%) | 5/5 (100%) | 51/51 (100%) |
| controllers/paymentController.ts | 68/68 (100%) | 63/64 (98,43%) | 3/3 (100%) | 68/68 (100%) |
| controllers/reservationController.ts | 85/85 (100%) | 53/53 (100%) | 7/7 (100%) | 85/85 (100%) |
| jobs/reminderJob.ts | 59/59 (100%) | 16/18 (88,88%) | 5/5 (100%) | 55/55 (100%) |
| middleware/auth.ts | 23/23 (100%) | 14/14 (100%) | 5/5 (100%) | 20/20 (100%) |
| services/mailService.ts | 71/71 (100%) | 43/48 (89,58%) | 5/5 (100%) | 70/70 (100%) |
| services/notificationService.ts | 7/7 (100%) | N/A (0 nhánh) | 1/1 (100%) | 7/7 (100%) |
| utils/loanRules.ts | 17/17 (100%) | 3/3 (100%) | 4/4 (100%) | 17/17 (100%) |
| **Tổng phạm vi** | **1273/1304 (97,62%)** | **888/927 (95,79%)** | **105/109 (96,33%)** | **1227/1257 (97,61%)** |

Phần chưa phủ: các khối `catch` trả 500 của hàm 2FA trong `authController` (12 statements), vài callback `multer` (`filename`, `fileFilter`) của `bookController` (được phủ ở tích hợp), và một số nhánh `??`/`?.` trong định dạng phản hồi.

Baseline Chương 4 (scope `whitebox`, 3 file Authentication) **không đổi**: `LMS_WB_SCOPE=whitebox` vẫn cho 201/213 statements, 107/111 branches (94,36% / 96,39%), kiểm tra lại ở lượt này.

### 3.2. Tích hợp (supertest + SQLite thật)

Nguồn: `extension/integration/coverage/coverage-summary.json`. Báo riêng, không cộng với unit.

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| controllers/analyticsController.ts | 37/45 (82,22%) | 17/22 (77,27%) | 9/9 (100%) | 35/43 (81,39%) |
| controllers/authController.ts | 155/178 (87,07%) | 90/97 (92,78%) | 11/11 (100%) | 154/175 (88%) |
| controllers/bookController.ts | 306/342 (89,47%) | 200/269 (74,34%) | 25/27 (92,59%) | 293/321 (91,27%) |
| controllers/inventoryController.ts | 42/51 (82,35%) | 38/65 (58,46%) | 7/7 (100%) | 41/50 (82%) |
| controllers/loanController.ts | 261/307 (85,01%) | 212/260 (81,53%) | 20/20 (100%) | 253/295 (85,76%) |
| controllers/notificationController.ts | 42/51 (82,35%) | 11/14 (78,57%) | 5/5 (100%) | 42/51 (82,35%) |
| controllers/paymentController.ts | 50/68 (73,52%) | 45/64 (70,31%) | 3/3 (100%) | 50/68 (73,52%) |
| controllers/reservationController.ts | 74/85 (87,05%) | 41/53 (77,35%) | 7/7 (100%) | 74/85 (87,05%) |
| jobs/reminderJob.ts | 51/59 (86,44%) | 11/18 (61,11%) | 3/5 (60%) | 47/55 (85,45%) |
| middleware/auth.ts | 23/23 (100%) | 13/14 (92,85%) | 5/5 (100%) | 20/20 (100%) |
| routes/*.ts (8 file) | 100% | — | — | 100% |
| services/mailService.ts | 0/71 (0%, bị stub) | 0/48 | 0/5 | 0/70 |
| services/notificationService.ts | 5/7 (71,42%) | N/A | 1/1 (100%) | 5/7 (71,42%) |
| utils/loanRules.ts | 17/17 (100%) | 3/3 (100%) | 4/4 (100%) | 17/17 (100%) |
| **Tổng phạm vi (+ routes)** | **1126/1367 (82,37%)** | **681/927 (73,46%)** | **100/109 (91,74%)** | **1094/1320 (82,87%)** |

Routes đạt 100% vì được nạp khi dựng app, không có nghĩa mọi route đã được gọi (mọi route đều có ít nhất một ca tích hợp ở mục 2).

### 3.3. Ngưỡng coverage trong cấu hình

Unit (scope `all`, khi `--coverage`): statements 90, branches 85, functions 90, lines 90. Tích hợp: 75 / 65 / 85 / 75. Nếu tụt dưới ngưỡng, lệnh coverage thoát mã khác 0. Số đo thực lần này đều cao hơn ngưỡng.

## 4. Lỗi phát hiện (ca `test.fails` ↔ mã lỗi)

Quy ước: mã `DEF-xxx` đã có từ báo cáo thủ công; `FIND-xx` do tự động hóa phát hiện, **chờ nhóm phân loại**. Mọi ca dưới đây hiện cho kết quả "Expected fail" và đã được chứng minh thất bại đúng assertion.

| Mã | Lỗi (quan sát) | Kỳ vọng → thực tế | Ca tự động |
|---|---|---|---|
| FIND-06 | Đổi trạng thái đặt trước tùy ý | WAITING→NOTIFIED→FULFILLED/CANCELLED (chú thích `reservationRoutes.ts`): `FULFILLED→NOTIFIED/WAITING`, `CANCELLED→FULFILLED` phải 400 → **200** | UT-RES-23/24, IT-RES-16 |
| FIND-07 | Hủy yêu cầu đã nhận sách (FULFILLED) | 400 → **200**, hồ sơ đổi thành CANCELLED | UT-RES-31, IT-RES-21 |
| FIND-08 | Thêm sách với số lượng 0 (BOOK-05) | 400, không tạo sách → **201**, tạo 1 bản (`Number(0) \|\| 1`) | UT-BOOK-07, IT-BOOK-07 |
| FIND-09 | Sửa sách với ISBN dạng số + tăng bản sao | 200 → **500** (`isbn.replace` không phải hàm) | UT-BOOK-25 |
| FIND-10 | id/bookId không phải số → lỗi 500 (cùng họ FIND-02/03) | 4xx → **500** ở `POST /reservations`, `DELETE /reservations/:id`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id`, `PATCH /auth/users/:id/blacklist` | IT-RES-08/22, IT-NOT-11 (x2), IT-BL-06 |
| FIND-11 | Khách chưa đăng nhập đọc được tên + email người mượn qua `/payments/details/:loanId` | không lộ email → **lộ** | IT-PAY-07 |
| FIND-12 | `/payments/callback` đóng phiếu mà không cần đăng nhập | 401/403 → **200**, phiếu COMPLETED | IT-PAY-13 |
| FIND-13 | Gọi lại callback ghi trùng AuditLog/thông báo | 1 bản ghi → **2** | IT-PAY-14 |
| FIND-14 | Biểu đồ xu hướng bỏ sót phiếu mượn ngày 31/12 (`lte: new Date("YYYY-12-31")` = 00:00 UTC) | tháng 12 có 1 → **0** | IT-ANA-07 |
| FIND-15 | Tải file sai định dạng (EXCEL-04, e-book) trả 500 thay vì 4xx (multer ném `Error` không có mã) | 4xx → **500** | IT-EXC-06, IT-EBK-06 |
| FIND-16 | USER tải e-book bị 403 nhưng file vẫn ghi vào đĩa (multer chạy trước kiểm tra quyền) | không có file → **file được lưu** | IT-EBK-05 |
| FIND-17 | Tên sách/độc giả chèn thẳng vào HTML email, không escape | escape → **thẻ `<a>` còn nguyên** | UT-MAIL-12 |
| FIND-18 | `register` không chuẩn hóa email nhưng `login` hạ chữ thường: email có chữ hoa không đăng nhập được; `READER@x` không bị coi là trùng `reader@x` (MEM-02) | 200 / 400 → **401 / 201** | IT-REG-04/05 |
| FIND-19 | `register` thiếu mật khẩu → lỗi 500 (`bcrypt.hash(undefined)` ngoài `try`) | 4xx → **500** | IT-REG-06 |
| FIND-20 | `forgot-password` tiết lộ email có/không tồn tại (404 vs 200), trong khi đăng nhập cố ý dùng thông điệp chung | cùng mã → **404 / 200** | IT-PWD-07 |
| FIND-21 | `POST /loans/return` trả lại phiếu đã có `returnDate` (đã trả, còn nợ phạt): bản sách bị đặt `AVAILABLE` dù người khác đang mượn → **sai lệch dữ liệu** | `BORROWED` → **`AVAILABLE`** | UT-RT-11, IT-LST-21 |
| FIND-22 | Duyệt/từ chối gia hạn khi chưa có yêu cầu PENDING; từ chối được phiếu đã COMPLETED | 400 → **200** | UT-AP-07/08/09, IT-LST-22 |
| DEF-005 (bổ sung) | Hạn trả PREMIUM vẫn +14 ngày — thêm biểu hiện ở `POST /loans/borrow` | +30 → **+14** | UT-LN-23, IT-LST-08 |

Đối chiếu mã với báo cáo Nhóm 8 (`docs/qa/output/Nhom8-DGVKDCLPM-Reportt.docx`): báo cáo dùng một sổ lỗi duy nhất `DEF-xxx`; FIND-01…05 là DEF-017, 018, 019, 020, 016 (theo thứ tự FIND-01…05) và **FIND-nn (nn ≥ 6) là DEF-(nn + 15)**, tức FIND-06…22 là DEF-021…037. Mức độ nghiêm trọng của DEF-021…037 do nhóm kiểm thử đề xuất (High: DEF-026, 027, 031, 036; Low: DEF-024, 029, 030, 034; còn lại Medium) và chờ nhóm phát triển xác nhận.

Các lỗi đã biết từ Chương 5–6 (DEF-001…014, FIND-01…05) giữ nguyên trạng thái; DEF-003 (PDF font tiếng Việt) vẫn **chưa tự động hóa** (không có oracle tự động tin cậy cho glyph).

## 5. Phân tích tĩnh

Nguồn: `extension/static-analysis/` (`eslint-report.json`, `tsc-frontend.txt`, `exit-codes.txt`).

| Hạng mục | Kết quả |
|---|---|
| `tsc` server/src + server/tests + e2e (`npm run typecheck`) | exit 0 |
| ESLint mã kiểm thử (`server/tests`, `e2e`, file config) | 0 lỗi, 0 cảnh báo (CI chặn nếu vi phạm) |
| ESLint toàn repo (117 file) | **5 lỗi, 147 cảnh báo**: `server/src` 1 lỗi + 53 cảnh báo; `src` 4 lỗi + 94 cảnh báo (chủ yếu `no-explicit-any`) |
| `tsc --strict` frontend (`npm run typecheck:frontend`) | exit 2, **4 lỗi**: `Settings.tsx` thiếu `useEffect` và `queryClient` (chính là FIND-05, ESLint không bắt vì `no-undef` do TypeScript đảm nhiệm), `BooksManagement.tsx` tham số `oldData` ngầm `any`, `main.tsx` thiếu khai báo kiểu `react-dom/client` (thiếu `@types/react-dom`) |

Lỗi ESLint ở mã sản phẩm: `no-useless-assignment` (`loanController.ts:35`), `no-empty-pattern` (`Login.tsx:13`), 3 lần `ban-ts-comment` (`MembersManagement.tsx:385`, `LanguageContext.tsx:471,475`). Không sửa theo phạm vi nhiệm vụ.

## 6. Kiểm thử đột biến (Stryker, 8 file, 3.178 mutant)

Nguồn: `test-results/mutation-ext/` (`stryker-output.txt`, `mutation-report.html/json`). Chỉ chạy unit.

| File | Điểm | Giết | Sống sót | Không phủ |
|---|---|---|---|---|
| analyticsController.ts | 75,40% | 95 | 31 | 0 |
| inventoryController.ts | 81,33% | 196 | 41 | 4 |
| reminderJob.ts | 78,30% | 83 | 23 | 0 |
| paymentController.ts | 70,78% | 172 | 70 | 1 |
| reservationController.ts | 69,47% | 182 | 80 | 0 |
| bookController.ts | 68,60% | 691 (+6 timeout) | 272 | 47 |
| notificationController.ts | 64,08% | 66 | 37 | 0 |
| loanController.ts | 63,64% | 688 | 380 | 13 |
| **Tổng** | **68,57%** | **2.173 (+6 timeout)** | **934** | **65** |

Lượt đầu (trước khi bổ sung `loan.returnAndRenew`) cho 62,87% tổng và 46,90% cho `loanController`. Mutant sống sót tập trung ở: (a) tham số Prisma (`where`/`include`/`select`, loại `ObjectLiteral`) và (b) chuỗi thông báo lỗi (`StringLiteral`) — mock không kiểm tra hết các đối số và nhiều ca chỉ kiểm tra mã HTTP; phần này được ca tích hợp (DB thật) kiểm tra nhưng Stryker không chạy tích hợp. Điểm này nên dùng như chỉ báo, không như cam kết chất lượng.

## 7. Ánh xạ ca thủ công (`docs/qa/input/Kiểm thử phần mềm.pdf`)

| Nhóm | Đã có ca tự động | Chưa tự động / lý do |
|---|---|---|
| AUTH-01 | IT-OTP-01…07, IT-AUTH-01/02, E2E-AUTH-01/02 | Hiện tượng "thoát popup OTP rồi đăng nhập lại vẫn vào": API luôn đòi OTP khi bật 2FA (IT-OTP-01); chưa tái hiện được ở mức API, cần E2E có 2FA bật |
| AUTH-02/04/05/06 | IT-REG-01…07, IT-LOG-01…03, IT-AUTH-04/05, IT-CPW-01…04, IT-PWD-01…07, UT-MAIL-15/16, E2E-AUTH-04/05 | AUTH-03 (đăng xuất) chỉ được dùng như bước phụ trong E2E-RES-04; E2E-AUTH-05 bị FIND-05 chặn |
| BOOK-03…07, 10 | UT-BOOK-*, IT-BOOK-*, UT-REC-*, IT-REC-*, E2E-BOOK-04/05 | BOOK-01/02 (lọc, thẻ chi tiết), BOOK-09 (in tem) là hành vi giao diện |
| BOOK-08, EXCEL-01…04 | IT-EBK-*, UT-EXC-*, IT-EXC-* | giao diện từ chối file (EXCEL-04) chỉ kiểm tra ở API (FIND-15) |
| RES-01…05 | UT-RES-*, IT-RES-*, E2E-RES-01…05 | RES-04: việc nhận sách đặt trước **không** tạo phiếu mượn/lịch sử — yêu cầu chưa rõ (pending) |
| MEM-02…05 | IT-REG-*, IT-BL-01…05, DEF-001/002 (Chương 5) | MEM-01 (lọc/đếm ở giao diện), MEM-05 hạng thẻ ở UI |
| INV-01…04 | UT-INV-*, IT-INV-*, E2E-INV-02/03/04/06 | INV-05, DASH-02: xuất Excel/PDF (DEF-003) |
| DASH-01 | UT-ANA-*, IT-ANA-* (số liệu API, FIND-14) | đối chiếu "độc giả hoạt động" giữa Dashboard và tab Quản lý độc giả (định nghĩa khác nhau, xem mục 8) |
| NOTI-01/02 | UT-NOT-*, IT-NOT-*, E2E-RES-04 (chuông) | giao diện đánh dấu/xóa ở Header chưa có E2E |
| SET-01/02 | E2E-SET-01 (FIND-05) | SET-02 bị FIND-05 chặn (trang trắng) |
| PAY-01/02 | UT-PAY-*, IT-PAY-* (FIND-11/12/13) | giao diện cổng giả lập chưa có E2E |
| MAIL-01 | UT-MAIL-*, UT-RMD-*, IT-LST-15…18 | chỉ stub mail; chưa chứng minh giao mail thật (cần SMTP/Ethereal thật) |

## 8. Yêu cầu chưa rõ (pending requirement) — không dùng để khẳng định lỗi

1. **Phí tối thiểu giả lập 10.000đ** khi phiếu không quá hạn và chưa có phạt (`create-url`, `details`): ghi nhận hành vi hiện tại ở UT-PAY-08c/d, UT-PAY-15b.
2. **Sửa sách không giảm được số bản sao**; **xóa sách xóa luôn lịch sử phiếu mượn** (kể cả đã trả); tham số `available` của thêm sách chỉ được kiểm tra rồi bị bỏ qua; **Smart Merge** gộp theo tiêu đề + tác giả dù khác ISBN (UT-BOOK-11/24b, IT-BOOK-09/15).
3. **Gợi ý sách (BOOK-03)**: backend cá nhân hóa đúng (IT-REC-02/03 đạt). `BookRecommendations.tsx` dùng khóa react-query `['book-recommendations']` không gắn theo người dùng — có thể là nguyên nhân hiện tượng hai tài khoản thấy cùng danh sách khi đổi tài khoản trong một phiên trình duyệt; **chưa xác minh** (cần E2E).
4. **Dashboard "Độc giả hoạt động"** = người đang có sách chưa trả (backend); tab Quản lý độc giả tính khác (không phải danh sách đen). Cần nhóm chốt định nghĩa.
5. **OTP sinh bằng `Math.random()`**, `resend-otp` không cần đăng nhập và dùng `tempUserId` tuần tự, không giới hạn số lần thử OTP: ghi nhận như rủi ro bảo mật, chưa có ca (không có oracle xác định cho giới hạn tốc độ).
6. **Callback thanh toán là cổng giả lập**: nếu cố ý để mở thì FIND-11/12 là chủ ý thiết kế — nhóm cần xác nhận.

## 9. Giới hạn

- Chỉ Chromium; E2E không phủ responsive/đa trình duyệt. Không có unit test cho React component (jsdom/Testing Library chưa cài).
- Mock không chứng minh SQLite persistence, JWT cryptography hay giao mail; tích hợp stub mail.
- Condition coverage/MC/DC: chỉ có ledger thủ công cho Authentication (Chương 4); các module mới chỉ đo Branch Coverage (V8).
- Unit mock `$transaction` bằng cách thực thi callback; chưa chứng minh rollback, ràng buộc UNIQUE hay đồng thời (race). Ví dụ: hai yêu cầu mượn song song cùng một bản sách chưa được kiểm thử vì kết quả không xác định.
- Mutation chỉ chạy unit (xem mục 6).

## 10. Chạy lại

```bash
npm install && npm --prefix server install && npx --prefix server prisma generate --schema server/prisma/schema.prisma && npx playwright install chromium

npm test                          # unit + tích hợp (+ ngưỡng coverage khi thêm :coverage)
npm run test:coverage             # unit + coverage (ngưỡng 90/85/90/90)
npm run test:integration:coverage # tích hợp + coverage (ngưỡng 75/65/85/75)
npm run test:e2e                  # Playwright (cổng 5000 và 5173 phải trống)
npm run typecheck                 # tsc server + tests + e2e
npm run lint                      # ESLint (mã sản phẩm hiện có lỗi/cảnh báo đã ghi nhận)
npm run test:mutation:ext         # Stryker cho module bổ sung

# Xem lỗi thật của các ca expected-fail
node server/tests/support/verify-known-bugs.mjs vitest.backend.config.ts server/tests/unit/reservation/reservationController.test.ts
node server/tests/support/verify-known-bugs.mjs vitest.integration.config.ts server/tests/integration/payment.api.test.ts
```

Để lưu evidence riêng, đặt `LMS_WB_RUN_DIR` / `LMS_IT_RUN_DIR` tới thư mục mới. Playwright ghi cứng vào `test-results/e2e/`: sao lưu thư mục này trước khi chạy lại rồi chuyển kết quả mới đi (đã làm ở lượt này, kết quả ở `extension/e2e/`; thư mục gốc `test-results/e2e/` được khôi phục nguyên trạng).
