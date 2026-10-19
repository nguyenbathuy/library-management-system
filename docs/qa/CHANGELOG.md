# QA Changelog

Lịch sử được tổng hợp từ tài liệu/evidence có sẵn, không phải danh sách commit hoặc xác nhận đã retest toàn hệ thống. Các báo cáo [sửa lỗi sách](../bug_fix_report.md) và [feature walkthrough](../feature_walkthrough.md) là lịch sử phát triển riêng, được giữ lại; trước nhiệm vụ này chưa có changelog QA tổng hợp. Không suy ngày thực thi từ ngày sửa file.

## 2026-10-19 — GitHub Actions chạy lần đầu và cập nhật báo cáo

- **Sự kiện:** nhánh `test/automation-ch5-ch6` được push (4 commit, HEAD `36689f0f`); workflow CI chạy lần đầu (run #1) và **thành công** cả hai job. Chi tiết, số liệu artifact và ảnh: [github-actions-run1.md](../../test-results/ci/github-actions-run1.md). Lần push đầu bị chặn vì token `gh` thiếu phạm vi `workflow`; được khắc phục bằng cách cấp lại phạm vi này.
- **Báo cáo** `docs/qa/output/Nhom8-DGVKDCLPM-Reportt.docx`: thay đoạn "workflow chưa chạy" ở mục 5.4 bằng kết quả thật, thêm Hình 5.1 (ảnh trang Actions; hình Vitest cũ thành Hình 5.2 và tham chiếu ở Chương 4 được đổi theo), cập nhật mục 7.4, 7.5 và Kết luận. Chỉ `word/document.xml`, quan hệ và một ảnh mới thay đổi; `validate.py` đạt. File báo cáo chưa được commit theo yêu cầu của người dùng (chỉ push phần mã kiểm thử và tài liệu kỹ thuật).
- **Giới hạn:** CI mới chạy bằng `push`, chưa chạy ở chế độ pull request vào `main`; chênh lệch nhỏ về coverage giữa CI và máy cục bộ (xem tệp chi tiết).
- **Rút gọn báo cáo (92 → 78 trang theo bản render LibreOffice; đề bài yêu cầu 50 – 80 trang):** (1) tiêu đề mọi bảng đổi sang nền trắng chữ đen; (2) hợp nhất số liệu cuối vào mục 5.4 – 5.6, 6.2, 6.4 và Chương 7, bỏ Bảng 5.4/5.5/Hình vitest của lượt 14/10 vốn đã lỗi thời (số liệu cũ vẫn có ở `SUMMARY_CH5_CH6.md`), 17 dòng DEF mới chỉ còn ở Bảng 7.2 (kèm mã ca); (3) tách mục 4.8 (chi tiết 65 ca) sang tệp đính kèm `docs/qa/output/Nhom8-PhuLucC-ChiTiet65CaHopTrang.docx`, báo cáo chính trỏ tới tệp này như Phụ lục A; (4) ảnh minh họa thu nhỏ còn 75%; (5) bỏ các đoạn rỗng trước tiêu đề chương (gây trang trống) và rút gọn đoạn cuối Chương 6, 7 và Kết luận. Mục lục được dựng lại và kiểm tra khớp số trang; số trang Word có thể lệch 1 – 2 trang so với LibreOffice.
- **Chỉnh báo cáo theo yêu cầu của người dùng:** bỏ khỏi báo cáo các câu "cần xác nhận"/"mức độ do nhóm kiểm thử đề xuất" của DEF-021 → 037 và mọi tham chiếu thư mục/đường dẫn mã nguồn (chỉ giữ tên file, lệnh `npm`, tên cấu hình); Phụ lục B viết lại bằng lệnh `npm` và mô tả. Các tài liệu kỹ thuật trong repo (CHANGELOG, SUMMARY_EXTENSION) không thay đổi nội dung này.

## 2026-10-19 — Cập nhật báo cáo Nhóm 8 theo đợt mở rộng kiểm thử

- **Tệp đích:** cập nhật trực tiếp `docs/qa/output/Nhom8-DGVKDCLPM-Reportt.docx`; backup nguyên bản tại `docs/qa/output/backups/Nhom8-DGVKDCLPM-Reportt_before_extension_20261019.docx` (SHA256 `1acbb754…7a62 → 5e17e3f5…`). Chỉ `word/document.xml` thay đổi so với backup; ảnh, header, style và các part khác giữ nguyên byte.
- **Nội dung thêm/sửa:** mục 5.6 (kết quả 770 ca, số ca theo module, bao phủ đơn vị và tích hợp, ngưỡng bao phủ), 5.7 (phân tích tĩnh), 6.2.4 (8 ca E2E bổ sung), bảng mutation mở rộng (6.4b), sổ lỗi DEF-021 → DEF-037 (Bảng 3.15, 7.1, 7.2; FIND-nn ↔ DEF-(nn + 15)), cập nhật Chương 1 (công cụ), 5.1, 5.4 (trạng thái CI), 6.5, 7.1, 7.3 – 7.5, Kết luận, Phụ lục B và danh mục bảng. Các bảng 5.3 – 5.5 giữ nguyên là số liệu lượt chuẩn 14/10/2026 và được chú thích.
- **Mục lục:** mục lục chính trước đó thiếu 5.1 – 5.5, 6.x và có các mục rỗng; được dựng lại cho mọi tiêu đề (kể cả 5.6, 5.7, 6.2.4) với số trang lấy từ bản render LibreOffice (92 trang); cờ cập nhật trường của Word vẫn bật.
- **Validation:** `validate.py` (XSD) đạt; render lại bằng LibreOffice và kiểm tra trực quan các trang mục lục, 5.6, 5.7, 6.2.4, 6.4b, Chương 7 và Phụ lục B; số liệu trong văn bản đối chiếu với `test-results/extension/` và `test-results/mutation-ext/`.
- **Giới hạn:** chưa có ảnh tab GitHub Actions vì chưa push được (token thiếu phạm vi `workflow`); báo cáo ghi rõ chỗ cần chèn. Mức độ nghiêm trọng của DEF-021 → 037 là đề xuất của nhóm kiểm thử. Không chạy lại test hay sửa mã/evidence trong bước này.

## 2026-10-19 — Mở rộng kiểm thử tự động: controller chưa phủ, tích hợp toàn bộ router, E2E, phân tích tĩnh

Ngày lấy từ [run-metadata](../../test-results/extension/run-metadata.json). Nhánh `test/automation-ch5-ch6`, chưa commit/push. Tổng kết số liệu và danh sách lỗi: [SUMMARY_EXTENSION](../../test-results/SUMMARY_EXTENSION.md). **Không sửa mã sản phẩm** (`server/src`, `src`) theo yêu cầu của người dùng; chỉ thêm test, tooling, CI và tài liệu.

- **Thay đổi:**
  - Unit mới cho 6 controller trước đó 0% (inventory, reservation, payment, notification, analytics, book) cùng `mailService`, `reminderJob` và phần `loanController` chưa phủ (`loan.borrowAndLists`, `loan.returnAndRenew`).
  - Tích hợp API mới cho mọi router (`inventory`, `reservation`, `payment`, `notification`, `analytics`, `book`, `loans.lists`, `auth.account`), gồm upload Excel/e-book multipart.
  - E2E: `reservation.spec.ts` (RES-01…05, thông báo chuông), `inventory.spec.ts` (INV-02/03/04/06) và Page Object `ReservationPage`, `InventoryPage`; thêm dữ liệu seed `reserver`, sách `soldout`/`inventory`.
  - Tooling: ESLint (+ typescript-eslint), `tsconfig.frontend.json`, scripts `typecheck`, `typecheck:frontend`, `lint`, `lint:report`, `test:mutation:ext`; ngưỡng coverage trong hai config Vitest; scope `modules`; `jobs/**` vào mẫu số coverage; bước phân tích tĩnh trong CI.
  - Dọn lint trong mã test cũ (không đổi hành vi): `cause` cho lỗi ở `e2e/pages/SettingsPage.ts`; `eslint-disable` cho hook ở `server/tests/setup/isolation.ts`.
- **File ảnh hưởng:** `server/tests/unit/{inventory,reservation,payment,notification,analytics,book,mail,jobs,loan}/*`, `server/tests/integration/*`, `server/tests/helpers/unitHarness.ts`, `server/tests/setup/integrationDb.ts`, `server/tests/support/verify-known-bugs.mjs` (xử lý thêm `test.fails.each`), `e2e/{pages,specs,fixtures}/*`, `vitest.backend.config.ts`, `vitest.integration.config.ts`, `stryker.extension.config.mjs`, `eslint.config.mjs`, `tsconfig.frontend.json`, `package.json`, `package-lock.json` (chỉ thêm 80 package, không đổi phiên bản package hiện có), `.github/workflows/ci.yml`, `AGENTS.md`, `README.md`, `docs/qa/QA_WORKFLOW.md`.
- **Kết quả lượt chuẩn** (`test-results/extension/`):
  - Unit: 513 ca, 484 PASS và 29 expected fail; Tích hợp: 235 ca, 197 PASS và 38 expected fail; E2E: 22 ca, 18 PASS và 4 expected fail. Mọi lượt exit 0; shuffle cho cùng kết quả.
  - Coverage unit (scope `all`, mẫu số mới có `jobs/**`): 97,62% statements, 95,79% branches, 96,33% functions, 97,61% lines. Tích hợp: 82,37% / 73,46% / 91,74% / 82,87%. Baseline whitebox Chương 4 giữ nguyên 201/213 và 107/111.
  - Mutation (8 file, báo cáo riêng `test-results/mutation-ext/`): 68,57%; lượt đầu 62,87% trước khi bổ sung `loan.returnAndRenew`.
  - Phân tích tĩnh: `typecheck` exit 0; ESLint mã test sạch; ESLint toàn repo 5 lỗi + 147 cảnh báo (mã sản phẩm); `tsc` strict frontend 4 lỗi (gồm FIND-05).
- **Lỗi:** phát hiện mới FIND-06…FIND-22 (xem bảng ở SUMMARY_EXTENSION) và biểu hiện bổ sung của DEF-005; các ca expected-fail cũ (unit 18, tích hợp 16, E2E 4) giữ nguyên. Các ca mới đều viết theo đặc tả đúng, đánh dấu `test.fails`, đã chứng minh thất bại đúng assertion bằng `verify-known-bugs.mjs`. FIND-21 gây sai lệch dữ liệu (bản sách bị đặt `AVAILABLE` khi đang được mượn).
- **Bảo toàn:** hash `server/prisma/dev.db` không đổi trước/sau các lượt tích hợp và E2E. Evidence Chương 5–6 (`test-results/{unit,integration,e2e,mutation,...}`) giữ nguyên; E2E được chạy sau khi sao lưu `test-results/e2e/`, kết quả mới chuyển sang `test-results/extension/e2e/` và thư mục gốc được khôi phục giống hệt (so sánh `diff -rq`). Một lần "sửa lint" làm hỏng hook Vitest (`FixtureParseError`) đã được phát hiện bằng chạy lại suite và hoàn tác.
- **Validation:** `npm run typecheck` exit 0; unit/tích hợp/E2E exit 0; kiểm tra ngưỡng coverage đạt; CI chưa chạy trên GitHub.
- **Còn tồn tại:**
  - CI GitHub vẫn chưa chạy; chưa commit/push.
  - DEF-003 (PDF font) và các ca giao diện thuần (lọc, in tem, xuất file, cài đặt SET-02 do FIND-05) chưa tự động hóa.
  - FIND-06…22 chờ nhóm phân loại; FIND-06/07/11/12/13/20/22 dựa trên chú thích mã nguồn hoặc nguyên tắc bảo mật; các yêu cầu chưa rõ liệt kê ở mục 8 của SUMMARY_EXTENSION.
  - Mutation chỉ chạy unit nên điểm thấp ở tham số Prisma/chuỗi thông báo; chưa có unit test cho React component.

## 2026-10-14 — Kiểm thử tự động, tích hợp, E2E và property-based (Chương 5–6)

Ngày/giờ lấy từ [run-metadata](../../test-results/run-metadata.json). Nhánh `test/automation-ch5-ch6` dựng trên `origin/main` = `90f35a26` (OTP 2FA). Tổng kết đầy đủ: [SUMMARY_CH5_CH6](../../test-results/SUMMARY_CH5_CH6.md).

- **Thay đổi:**
  - Bỏ `node_modules` khỏi Git index, bổ sung `.gitignore` và `server/.env.example`.
  - Commit bộ QA/white-box có sẵn thành một commit riêng.
  - Tách `server/src/utils/loanRules.ts` khỏi `loanController` (giữ nguyên hành vi, xem [CHANGES_TO_APP](../../test-results/CHANGES_TO_APP.md)).
  - Thêm unit loan (UT-*, SM-*), 20 ca WB-OT cho 2FA, tích hợp API trên SQLite tạm (IT-*), E2E Playwright (E2E-*), fast-check (PBT-P0…P7, fuzz API P5), Stryker và workflow CI.
- **Re-baseline:** oracle S của WB-LG-01…04 và WB-ME-02…04 được cập nhật theo contract 2FA của `90f35a26`. Lượt hồi quy trước khi cập nhật được lưu tại `test-results/regression/` (56 passed, 9 failed). WB-RG-04/05 giữ Expected và chuyển sang `test.fails` (DEF-002).
- **Kết quả lượt chuẩn:**
  - Unit: 149 ca, 131 PASS và 18 expected fail.
  - Tích hợp: 53 ca, 37 PASS và 16 expected fail.
  - E2E: 14 ca, 10 PASS và 4 expected fail.
  - Mọi lượt chạy exit 0; chạy lại với shuffle cho cùng kết quả.
  - Mutation score: 81,52% (loanRules 94,44%, authController 81,00%).
- **Coverage V8 (mẫu số mới):** whitebox scope 3 file 201/213 statements và 107/111 branches; không so trực tiếp với Phase 3 (131/133) vì commit 2FA làm tăng mẫu số. `loanController` 60,58% (unit) / 68,40% (tích hợp); `loanRules` 100%.
- **Lỗi:** 13/14 DEF của brief được tái hiện tự động; DEF-003 chưa tự động hóa. Phát hiện mới FIND-01…05, trong đó FIND-05 là `/settings` crash do `useEffect` không được import (regression `90f35a26`). Không sửa lỗi ứng dụng, không đánh dấu Fixed.
- **Bảo toàn:** `server/prisma/dev.db` của nhánh giữ hash `ee536593…4fc66c` trước/sau mọi lượt (integration và E2E so hash tự động). DB cục bộ của `main` trước khi chuyển nhánh được lưu ở `server/prisma/backups/dev.db.local-before-automation-20261014T044249Z` và `git stash@{0}`.
- **Validation:** `tsc` cho source, test và E2E đều exit 0. Các bước `ci.yml` được chạy lại trên clone sạch ([local-simulation](../../test-results/ci/local-simulation.md)), không phải GitHub Actions.
- **Còn tồn tại:**
  - CI GitHub chưa chạy và chưa có PR (push 403 với `Twananh19`).
  - Mã BOR/RET/EXT/SRCH và DEF-004…014 chưa có định nghĩa trong repo nên chưa đối chiếu được.
  - DEF-012/014 dùng tham số API giả định.
  - FIND-01…05 chờ nhóm phân loại.

## 2026-10-13 — Chuẩn hóa văn phong báo cáo Nhóm 8

- **Tệp đích:** cập nhật trực tiếp `docs/qa/input/Nhom8-DGVKDCLPM_bao-cao-dang-test.docx`; backup trước thay đổi tại `docs/qa/output/backups/Nhom8-DGVKDCLPM_before_plain_language_20261012_234700.docx`.
- **Nội dung:** bỏ đường dẫn mã nguồn, cấu hình, evidence và đường dẫn màn hình khỏi phần trình bày; viết lại Chương 3–4 theo chức năng và ý nghĩa nghiệp vụ; Việt hóa nhãn bảng, giải thích coverage và sơ đồ luồng cho người đọc không chuyên. Các tên công cụ, mã ca, mã lỗi và giá trị nghiệp vụ cần truy vết được giữ lại.
- **Checksum và bảo toàn:** SHA256 `9e9186f6…265 → d210fd9b…f2a3`; giữ 43 trang A4, 27 bảng, 690 ô, 2 hình và 5 section. Chỉ `word/document.xml` thay đổi so với backup; định dạng chữ đen, nền trắng tiếp tục được giữ.
- **Validation:** DOCX hợp lệ; LibreOffice mở/render lại chính tệp đích; mục lục giữ đúng trang; tìm kiếm trên bản render không còn tham chiếu nội bộ dạng đường dẫn; Chương 3–4 được kiểm tra trực quan. Chi tiết tại [Readability validation](output/Nhom8_Report_Readability_Validation.md).
- **Giới hạn:** không chạy lại test hoặc thay đổi số liệu, trạng thái lỗi, source, Unit Test, evidence hay database.

## 2026-10-12 — Chuẩn hóa báo cáo Nhóm 8 sang chữ đen, nền trắng

- **Tệp đích:** cập nhật trực tiếp `docs/qa/input/Nhom8-DGVKDCLPM_bao-cao-dang-test.docx`; backup trước thay đổi tại `docs/qa/output/backups/Nhom8-DGVKDCLPM_before_monochrome_20261012_232507.docx`.
- **Định dạng:** đổi toàn bộ fill xanh/xám của bảng thành trắng; đổi màu chữ/style và đường viền bảng thành đen. Ảnh minh chứng được giữ nguyên để bảo toàn evidence.
- **Checksum và bảo toàn:** SHA256 `6acb9d4b…6048 → 9e9186f6…265`; giữ 43 trang A4, 27 bảng, 690 ô, 2 drawing/media và 5 section. Nội dung text/field không thay đổi; chỉ `word/document.xml` và `word/styles.xml` thay đổi trong gói DOCX.
- **Validation:** DOCX/backup hợp lệ; mở/render lại chính tệp đích bằng LibreOffice; font Unicode embedded, không có `U+FFFD`. Trang tài liệu số 24 được kiểm tra trực quan và có 0 pixel ngoài thang xám. Chi tiết tại [Monochrome validation](output/Nhom8_Report_Monochrome_Validation.md).
- **Giới hạn:** đây là thay đổi trình bày; không chạy lại test hoặc sửa kết quả, evidence, source, Unit Test hay database.

## 2026-10-12 — Đồng bộ báo cáo Nhóm 8 với Manual v2 và White-box Phase 3

- **Tệp đích:** cập nhật trực tiếp `docs/qa/input/Nhom8-DGVKDCLPM_bao-cao-dang-test.docx`; backup nguyên bản tại `docs/qa/output/backups/Nhom8-DGVKDCLPM_before_whitebox_phase3_20261012_230319.docx`.
- **Nội dung:** điền Actual/Status/Evidence của 44 testcase ở Chương 3, giữ Expected; bổ sung bảng kết quả, defect và NEEDS REVIEW. Hoàn thiện Chương 4 với 65 unit Test ID, mock/isolation, source/CFG, execution, V8 coverage, condition ledger, DEF-002 và giới hạn. Mục lục được cập nhật theo heading/số trang mới.
- **Checksum và bố cục:** SHA256 `79ed23a9…60ab → 6acb9d4b…6048`; số trang `34 → 43`; bảng `15 → 27`; ảnh `2 → 2`; header XML `5 → 5`.
- **Validation:** mở/render lại chính file đích bằng LibreOffice 7.3; OOXML hợp lệ, A4, font Unicode embedded, không có ký tự thay thế. 29/30 package parts giữ nguyên byte, chỉ `word/document.xml` đổi; 44 Expected giữ nguyên; Chương 1–2 và 5–7 đối chiếu không đổi. Chi tiết tại [Report validation](output/Nhom8_Report_Whitebox_Phase3_Validation.md).
- **Giới hạn:** không chạy test mới hoặc sửa evidence/source/Unit Test/database. DEF-002 giữ OPEN và chỉ được White-box xác nhận đến controller → Prisma call; không tuyên bố persistence/UI đã retest.

## 2026-10-12 — White-box Member Management Phase 3

Ngày lấy từ [canonical run metadata](whitebox/evidence/phase3/combined-coverage/run-metadata.json): bắt đầu `2026-10-12T15:09:00.543844+07:00`, kết thúc `2026-10-12T15:09:02.060111+07:00`.

- **Thay đổi/lý do:** thêm 25 unit/controller và unit-wiring cases cho register/getMe/getAllUsers/toggleBlacklist/permission routes; chạy regression 40 ca Authentication, shuffle và coverage riêng/combined. Runner có selector `LMS_WB_SCOPE=all|authentication|member`; mặc định `all`.
- **File ảnh hưởng:** `server/tests/unit/member/memberManagement.phase3.test.ts`, `server/tests/fixtures/phase3-cases.json`, `vitest.backend.config.ts`; thêm [Results](whitebox/Whitebox_Phase3_Results.md), [Chapter 4 Draft](whitebox/Whitebox_Phase3_Chapter4_Draft.md), `whitebox/evidence/phase3/`; đồng bộ [QA Workflow](QA_WORKFLOW.md) và README.
- **Kết quả đã lưu:** Phase 3 `23 PASS/2 FAIL/0 SKIPPED/0 TODO`; Authentication regression `40 PASS`; combined và shuffle `63 PASS/2 FAIL`. Hai FAIL duy nhất WB-RG-04/05 giữ bằng chứng DEF-002; không đổi assertion, production source hoặc đánh dấu Fixed. Type-check exit 0.
- **Coverage V8:** Member-only trên toàn ba source file `59/133` statements, `20/71` branches, `7/13` functions, `55/128` lines; Authentication `101/133`, `58/71`, `10/13`, `98/128`, khớp Phase 2; combined `131/133`, `70/71`, `13/13`, `126/128`. Selected bodies của bốn hàm Member được báo riêng với phương pháp/mẫu số, không thay whole-scope metric.
- **Isolation/validation:** mock Prisma trước import, network gates 0 attempt, không gọi connect/disconnect/transaction; combined coverage `strace trace=%file` không match DB chính/production bootstrap trong phạm vi trace. HTML, raw maps, logs, traces, metadata và validation nằm tại [evidence index](whitebox/evidence/phase3/README.md).
- **Còn tồn tại:** DEF-002 chỉ được tái hiện đến controller-to-Prisma-call; SQLite/UI chưa retest. DEF-001 chưa được tái hiện độc lập. Tám design items chờ oracle/policy không đăng ký runner; Member UI, full Express integration và Book/Excel chưa test.

## 2026-10-12 — Persistent Project Rules & Rules Maintenance

- **Thay đổi:** thêm [AGENTS.md](../../AGENTS.md), [QA Workflow](QA_WORKFLOW.md), [Rules Audit](Rules_Audit.md) và changelog này; đồng bộ README và ghi chú phạm vi/link của ba tài liệu kỹ thuật cũ.
- **Lý do:** lưu quy tắc lâu dài về phát triển/kiểm thử, database/Git safety, kiểm tra quy tắc và đồng bộ tài liệu sau mọi nhiệm vụ có sửa file; phân biệt implementation hiện tại, thiết kế dự kiến và kết quả lịch sử.
- **File ảnh hưởng:** `AGENTS.md`, `README.md`, `docs/qa/QA_WORKFLOW.md`, `docs/qa/Rules_Audit.md`, `docs/qa/CHANGELOG.md`, `docs/system_analysis_report.md`, `docs/bug_fix_report.md`, `docs/feature_walkthrough.md`.
- **Validation:** kiểm tra link, diff, nội dung quy tắc và SHA256 trước/sau; kết quả đối soát được ghi ở cuối [Rules Audit](Rules_Audit.md). Đây là validation tài liệu, không phải lượt unit execution mới.
- **Còn tồn tại:** oracle/business policy chưa được chốt, metadata manual chưa đủ, ảnh tham chiếu ngoài repository của walkthrough không có tại workspace. Quy tắc được thực hiện bởi agent theo AGENTS; chưa có hook/CI tự động cưỡng chế checklist.

## 2026-10-12 — White-box Authentication Phase 2

Ngày lấy từ [canonical run metadata](whitebox/evidence/phase2/coverage/run-metadata.json): bắt đầu `2026-10-12T13:38:11.892430+07:00`, kết thúc `2026-10-12T13:38:13.071962+07:00`; không dùng fake clock fixture làm ngày thực thi.

- **Thay đổi/lý do:** bổ sung branches input/permission/OTP reuse/fault injection; kiểm tra regression Phase 1, execution độc lập và tăng coverage trên cùng source/mẫu số.
- **File ảnh hưởng:** `server/tests/unit/auth/authController.phase2.test.ts`, `authMiddleware.phase2.test.ts`, `server/tests/fixtures/phase2-cases.json`, `server/tests/support/phase2Evidence.ts`; đổi label/output của `vitest.backend.config.ts` và hook/evidence theo module của `server/tests/setup/isolation.ts`. Thêm [Results](whitebox/Whitebox_Phase2_Results.md), [Chapter 4 Draft mới](whitebox/Whitebox_Phase2_Chapter4_Draft.md) và `whitebox/evidence/phase2/`.
- **Validation đã lưu:** 25 ID mới, tổng 40 ID; canonical 40 PASS/0 FAIL/0 SKIPPED/0 TODO, exit 0. Run riêng Phase 1, Phase 2, toàn suite, shuffle và coverage đều thành công sau sửa hook; type-check exit 0. [Execution validation](whitebox/evidence/phase2/execution-validation.json).
- **Lỗi harness được giữ lịch sử:** regression đầu có 15 body PASS nhưng hook/suite FAIL, exit 1; sửa cú pháp callback `afterAll(({}, suite) => ...)` trong test setup, không đổi Expected/source. [Finding](whitebox/evidence/phase2/test-harness-finding.json), [log lỗi gốc](whitebox/evidence/phase2/initial-hook-error/execution.log).
- **Coverage V8 đã lưu:** statements `101/133`, branches `58/71`, functions `10/13`, lines `98/128`; scope nguyên authController/middleware/auth/authRoutes. [Summary công cụ](whitebox/evidence/phase2/coverage/coverage/coverage-summary.json). Condition ledger thủ công cùng catalog 19: `38/38`; catalog mở rộng 30: `58/60`, báo riêng. Không phải full Authentication Condition Coverage.
- **Bảo toàn đã lưu:** 222 file được bảo vệ và 59 file Phase 1 evidence giữ nguyên; mock/network gates và syscall trace không ghi nhận access DB/production bootstrap trong lượt coverage theo phạm vi trace. [Preservation validation](whitebox/evidence/phase2/preservation-validation.json).
- **Còn tồn tại:** getMe/getAllUsers/toggleBlacklist, route wiring và một số error paths chưa test; policy OTP login và oracle R còn pending. Không xác nhận defect ứng dụng mới; không đóng các lỗi manual. Bcrypt/JWT/SMTP thật, SQLite/concurrency chưa được chứng minh bằng các mocks.

## 2026-10-11 — White-box Authentication Phase 1

Ngày lấy từ [canonical run metadata](whitebox/evidence/phase1/coverage/run-metadata.json): bắt đầu `2026-10-11T16:01:40.320662+00:00`, kết thúc `2026-10-11T16:01:41.091822+00:00` (UTC).

- **Thay đổi/lý do:** thiết lập unit runner/cách ly và chạy các ca Authentication có oracle rõ ràng. Thêm Vitest + coverage-v8 4.1.0, scripts root và npm override Vite hiện có; không đổi direct runtime dependency declarations/versions.
- **File ảnh hưởng:** `package.json`, `package-lock.json`, `vitest.backend.config.ts`, `server/tsconfig.tests.json`, `server/tests/unit/auth/authController.test.ts`, mocks/setup/fixtures Phase 1; thêm [Results](whitebox/Whitebox_Phase1_Results.md), [Chapter 4 Draft](whitebox/Whitebox_Phase1_Chapter4_Draft.md) và `whitebox/evidence/phase1/`.
- **Validation đã lưu:** 15 ID, unit/shuffle/coverage đều 15 PASS/0 FAIL/0 SKIPPED/0 TODO, exit 0. Test type-check và frontend build exit 0; build không phải frontend test execution. [Execution validation](whitebox/evidence/phase1/execution-validation.json).
- **Coverage V8 đã lưu:** statements `58/133`, branches `32/71`, functions `4/13`, lines `58/128`; condition guard ledger thủ công `28/38`, catalog 19 predicates. [Summary công cụ](whitebox/evidence/phase1/coverage/coverage/coverage-summary.json).
- **Bảo toàn đã lưu:** 154 file được bảo vệ giữ hash; Prisma hoisted mock/alias gate, 8 network guards và syscall trace theo phạm vi đã công bố. [Preservation validation](whitebox/evidence/phase1/preservation-validation.json).
- **Còn tồn tại:** coverage gaps và oracle R; không kết luận email/tier/OTP manual defects đã sửa. Installer lỗi peer resolution đã xử lý trong tooling, không tính là testcase FAIL ứng dụng.

Hai phase ghi nhận HEAD `3623171535cde61d8fb8dd7f02d248da3864e2e5` với **workspace dirty**. Đây là HEAD quan sát khi chạy, không phải commit mới được tạo cho QA hoặc commit chứa toàn bộ test/config; các hash thực chạy nằm trong metadata. Không có ngày commit/fix được suy từ giá trị này.

## 2026-10-11 — White-box Test Design

Ngày khảo sát được ghi trong [Test Plan](whitebox/Whitebox_Test_Plan.md).

- **Thay đổi/lý do:** lập kế hoạch cho Authentication, Member Management, Book Management/Excel Import, ưu tiên rủi ro/defects của baseline manual.
- **File ảnh hưởng:** bốn tài liệu `Whitebox_Test_Plan.md`, `Whitebox_Test_Matrix.md`, `Whitebox_Coverage_Strategy.md`, `Whitebox_Implementation_Plan.md`.
- **Validation đã ghi trong tài liệu:** đối chiếu source/baseline, thiết kế 160 ID/24 mục tiêu; 18 ca cần xác nhận oracle. Đây là kế hoạch, không có kết quả unit/coverage ở bước này.
- **Còn tồn tại:** paths/config/dependencies trong kế hoạch là đề xuất tại thời điểm đó; triển khai Phase 1/2 dùng cấu trúc test thực khác. Kế hoạch cũ giữ nguyên; QA Workflow chỉ rõ cách đọc theo phiên bản.

## Ngày chưa xác nhận — Manual Testing baseline v2

- **Thay đổi/lý do:** chuẩn hóa ghi nhận của Tester cho 44 testcase, giữ màu/italic/ảnh/Expected và lịch sử v1; tách cờ review và phân loại defects.
- **File ảnh hưởng:** [Manual Results v2](output/Manual_Test_Results_v2.xlsx), [Defect Log v2](output/Defect_Log_v2.xlsx), [Gap Analysis v2](output/Manual_Test_Gap_Analysis_v2.md), [Report v2](output/Manual_Test_Updated_v2.docx), [Issue Draft](output/GitHub_Issues_Draft.md).
- **Kết quả ghi nhận, không phải agent execution:** 30 PASS, 3 FAIL, 0 BLOCKED, 0 NOT RUN, 11 chưa có kết luận chính thức; 3 Confirmed Defects, 6 Potential Defects. Expected và phần báo cáo của thành viên khác được giữ; defect chưa được đánh dấu Fixed, Issue chưa đăng GitHub. Căn cứ/giới hạn tại Gap Analysis v2.
- **Còn tồn tại:** tên input Final yêu cầu chưa có, dùng `Kiểm thử phần mềm.docx` đã được người dùng xác nhận. Không đủ metadata ngày/môi trường/commit cho từng lần manual execution; không gán ngày/SHA từ các phase white-box. `QA_Validation.json` đang có là v1.
