# QA Changelog

Lịch sử được tổng hợp từ tài liệu/evidence có sẵn, không phải danh sách commit hoặc xác nhận đã retest toàn hệ thống. Các báo cáo [sửa lỗi sách](../bug_fix_report.md) và [feature walkthrough](../feature_walkthrough.md) là lịch sử phát triển riêng, được giữ lại; trước nhiệm vụ này chưa có changelog QA tổng hợp. Không suy ngày thực thi từ ngày sửa file.

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
