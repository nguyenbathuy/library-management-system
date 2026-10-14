# Persistent Project Rules — Audit & Synchronization

Ngày đối chiếu: **12/10/2026**, theo ngày của nhiệm vụ/múi giờ Asia/Ho_Chi_Minh. Phạm vi: thiết lập hướng dẫn repository và workflow cuối nhiệm vụ; không triển khai chức năng hoặc Unit Test.

## 1. Hướng dẫn/lịch sử tìm thấy trước thay đổi

Đã tìm trong repository gồm thư mục ẩn, loại trừ nội dung dependencies/build/evidence khỏi tìm hướng dẫn; kiểm tra thêm các thư mục cha và Codex home. Dependencies không được coi là nguồn quy tắc riêng của dự án.

| Vị trí | Kết quả và cách xử lý |
| --- | --- |
| Root/nested `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md` | Không tìm thấy trong repository; không có hướng dẫn hiệu lực cần ghi đè hoặc gộp |
| Các thư mục cha của workspace | Không tìm thấy ba tên hướng dẫn trên |
| `~/.codex/AGENTS.md` | Có file nhưng rỗng; không có quy tắc toàn cục để sao chép/sửa. Không thay cấu hình ngoài repository |
| `.codex`, `.cursor`, `.claude`, `.windsurf`, `.agents`, `.github/instructions`, `rules` | Không có thư mục quy tắc như trên trong repository khảo sát |
| [guidelines/Guidelines.md](../../guidelines/Guidelines.md) | Mẫu “Add your own guidelines here”, ví dụ nằm trong comment HTML; chưa có project rules cụ thể. Giữ nguyên |
| [README](../../README.md) | Hướng dẫn kiến trúc/chạy local có sẵn; giữ phần chuẩn bị môi trường trước đây, bổ sung QA/rules và sửa các mô tả không phù hợp hiện trạng |
| [System analysis](../system_analysis_report.md) | Mô tả kiến trúc/schema/API cũ và ví dụ/đề xuất test; thêm chú thích snapshot và nguồn hiện tại |
| [Bug fix report](../bug_fix_report.md), [Feature walkthrough](../feature_walkthrough.md) | Có lịch sử phát triển tương đương nhưng không phải changelog QA hoặc evidence retest hiện tại; giữ nội dung, bổ sung phạm vi/link |
| Changelog của dự án | Không có file changelog QA tổng hợp trước nhiệm vụ; thêm [QA Changelog](CHANGELOG.md), dẫn lại lịch sử cũ thay vì xóa hoặc suy diễn ngày/commit |

Không tạo nested AGENTS/override vì chưa có quy tắc riêng cần phân phạm vi. Không đổi README/CLAUDE thành fallback filename hoặc sửa Codex config toàn cục.

## 2. Căn cứ kỹ thuật và thông tin Phase 1/2 trở thành hướng dẫn

Đã đối chiếu Phase 1/2 Results, bốn kế hoạch, root/server packages, test config/tsconfig, isolation setup, Prisma guard, test/fixture metadata và raw evidence liên quan.

| Nội dung được giữ lâu dài | Căn cứ hiện tại / nơi lưu hướng dẫn |
| --- | --- |
| Cấu trúc React/Vite frontend, Express/Prisma backend, root ESM/server CommonJS | Manifest, `src/`, `server/src/`; Project Understanding trong AGENTS |
| Vitest + coverage-v8 cùng phiên bản, scripts chạy ở root | `package.json`, `vitest.backend.config.ts`; AGENTS và QA Workflow |
| Test tsconfig riêng, không sửa production module type để xử lý loader | `server/tsconfig.tests.json`; QA Workflow |
| Hoisted Prisma mock trước import, test-only guard alias và beforeAll gate | `prismaGuard.ts`, các controller suites; Testing/Database Safety và QA Workflow |
| Không dùng DB chính; không import bootstrap/cron/seed; network/service isolation | Schema hardcode datasource, production index side effects, `setup/isolation.ts`; QA Workflow |
| IDs/oracle B/S/R, trace input/response/calls, pending khác skipped | Matrix, fixtures và summaries; QA Workflow |
| Evidence riêng từng run, lưu cả lỗi hook/harness, kiểm tra suite + exit | Phase 2 initial-hook-error/finding và final logs; QA Workflow, changelog |
| Scope coverage nguyên file, statement/branch/function/line từ V8; condition ledger riêng | Config/maps/summary và ledger hai phase; QA Workflow |
| Không thay Expected, không đóng defect manual từ unit happy path ngoài phạm vi | Manual v2, Results Phase 1/2; AGENTS và QA Workflow |

Không đưa số PASS, phần trăm coverage, ngưỡng mục tiêu phase hoặc tiến độ tạm thời vào AGENTS làm rule. Các số lịch sử chỉ có trong changelog/báo cáo kèm nguồn. Không chuyển đề xuất UI dependencies/paths của kế hoạch cũ thành khẳng định đã triển khai.

## 3. Khác biệt, trùng lặp và cách đồng bộ

| Phát hiện | Xử lý có căn cứ |
| --- | --- |
| README badge/backend ghi Node 20.x nhưng mục cài đặt và metadata Phase 1/2 dùng Node 22.23.3 | Đồng bộ mô tả môi trường đã xác minh sang Node 22; không thay dependency/source hoặc suy khả năng tương thích chưa kiểm thử |
| README diagram nêu SQLite/PostgreSQL trong khi schema chỉ cấu hình SQLite | Mô tả SQLite hiện tại; không tự triển khai/chấp nhận migration PostgreSQL |
| README khẳng định PDF “100% không lỗi font”/“giải quyết triệt để”, baseline v2 còn DEF-003/DASH-02 | Ghi mục tiêu/implementation xuất PDF và liên kết defect/retest chưa xác nhận; không sửa Expected hoặc đánh dấu Fixed |
| System analysis dùng Loan.bookId, Token.expiresAt/refresh-token và `/auth/logout` | Ghi rõ là mô tả cũ: schema hiện có Loan.bookItemId; Token không có expiresAt; authRoutes không có logout endpoint. Giữ bảng/SQL cũ làm tham khảo lịch sử, không dùng làm contract hiện hành |
| Tài liệu cũ nêu Jest/“production-ready”/“mọi lỗi đã sửa” nhưng không có raw retest tương ứng hiện tại | Ghi chú giới hạn ở đầu file; hướng dẫn runner hiện tại và trạng thái QA dẫn từ reports/evidence, không xác nhận lại các kết luận lịch sử |
| Kế hoạch white-box nói chưa triển khai và paths `tests/unit/backend`, trong khi test thật ở `server/tests/unit/auth` | Giữ snapshot kế hoạch; QA Workflow/README chỉ rõ trạng thái hiện hành và cách tra Results; không ghi đè kế hoạch/baseline |
| Default output Phase 1 khác config sau Phase 2 | Ghi hai thời điểm trong QA Workflow; dùng config hiện tại làm hướng dẫn run mới, không sửa report lịch sử |
| Liên kết source trong hai báo cáo cũ trỏ `file:///e:/...` | Chuyển sang đường dẫn tương đối đúng file thực của repository |
| Hai ảnh reference walkthrough trỏ `file:///C:/...` ngoài repository, không có tại workspace | Giữ đường dẫn gốc dưới dạng tham chiếu văn bản và nêu thiếu file; không tạo ảnh, không gán local-preview thành ảnh đó |
| Hướng dẫn QA trùng với mô tả kế hoạch/báo cáo | Root AGENTS lưu quy tắc chung; QA Workflow lưu cách thực hiện; các report giữ lịch sử. Không xóa nội dung baseline để giảm lặp |

Không có xung đột giữa các file rules hiệu lực trước nhiệm vụ vì chưa có bộ rules cụ thể. Những khác biệt trên là sai lệch tài liệu/phiên bản hoặc kết luận chưa có evidence mới; đã được nêu rõ, không tự lựa chọn business rule.

## 4. Những điều chưa đủ căn cứ xác nhận

- Mandatory MFA/OTP login, error contract/email validation, quyền tạo ADMIN, biên OTP expiry=T và các oracle R còn chờ xác nhận theo Phase 2 Results/Manual Gap Analysis. Không tạo business rule mới từ code.
- Không có `Manual_Test_Notes_Final.docx`; dùng input được xác nhận trước. Manual v2 thiếu metadata execution đầy đủ; `QA_Validation.json` là hồ sơ v1.
- Không biết ngày/commit/retest thực của hai báo cáo phát triển cũ hoặc nguồn gốc/khả năng truy cập hai ảnh tham chiếu ngoài repository.
- Kế hoạch cũ có placeholder chưa nội suy `{ORACLES['R']}` tại phần giới hạn. Số oracle lấy từ Matrix, không dùng placeholder làm kết quả; chưa sửa snapshot thiết kế trong nhiệm vụ này.
- Unit mocks không xác nhận persistence/concurrency/SMTP/JWT cryptography, route integration hay mọi business rule. Không mở rộng scope hoặc chạy lại để lấp các điểm chưa xác nhận trong nhiệm vụ tài liệu.

## 5. Cơ chế áp dụng ở nhiệm vụ tiếp theo

[AGENTS.md](../../AGENTS.md) yêu cầu sau mọi nhiệm vụ có sửa file phải review diff/file mới, đánh giá tác động lâu dài, cập nhật rule/tài liệu khi có thay đổi thật, ghi changelog cho thay đổi đáng kể, đồng bộ và báo nguyên block `RULES MAINTENANCE CHECK`. Nếu chỉ có kết quả tạm thời, giữ AGENTS nguyên và giải thích lý do.

Codex đọc chuỗi hướng dẫn khi bắt đầu run/session; `AGENTS.override.md` được chọn trước `AGENTS.md` trong cùng thư mục, hướng dẫn sâu hơn áp dụng theo phạm vi. Nếu session chưa nạp file vừa tạo, dùng run/session mới hoặc đọc lại file trước nhiệm vụ tiếp theo. Đây là instruction workflow trong repository; chưa cài hook/CI tự cưỡng chế. Căn cứ: [OpenAI — Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## 6. Validation của nhiệm vụ

Đã kiểm tra nội dung file mới, diff, staged diff và danh sách changed/untracked so với trạng thái trước nhiệm vụ. Chỉ tạo bốn file hướng dẫn/lịch sử và sửa bốn file tài liệu đã liệt kê ở changelog; không stage, commit hoặc push.

- `git diff --check -- README.md docs/` **exit 0**. Code fences cân bằng và file hướng dẫn mới không có trailing whitespace; mục maintenance chứa đúng block bắt buộc và đủ mười nhóm thay đổi lâu dài.
- **100 liên kết tới file/thư mục** trong tám tài liệu tạo/sửa đều có target tồn tại. Liên kết external chỉ được kiểm tra định dạng, không xác minh toàn bộ nội dung/tính sẵn sàng; trang OpenAI được dùng làm căn cứ đã mở và đối chiếu. Các anchor menu README có sẵn không được đổi hoặc chứng nhận bằng render GitHub trong lần này.
- Snapshot SHA256 gồm **361 file** có sẵn ngoài dependencies/build/Git internals: chỉ bốn tài liệu cũ được sửa; **357 file còn lại giữ nguyên hash**, không có file bị xóa. Bao gồm 75 frontend source, 22 backend source, 4 file schema/database, 10 file test/helper/fixture, 2 input QA, 43 output manual và toàn bộ kế hoạch/báo cáo/evidence white-box cũ.
- **59 file evidence Phase 1 và 113 file evidence Phase 2** giữ nguyên byte; original Unit Test, mocks/setup, test config/tsconfig và package/lockfiles không đổi. Hash source/config/test hiện tại vẫn khớp snapshot canonical Phase 2; các khác biệt config/setup so với snapshot Phase 1 là thay đổi Phase 2 đã có trước nhiệm vụ.
- Database đã có Git modification trước nhiệm vụ. Đối soát hash chứng minh nhiệm vụ này giữ nguyên trạng thái đầu vào, không tự restore hoặc coi diff có sẵn là thay đổi mới. Các thay đổi package/node_modules/QA có sẵn được giữ lại.
- **Không chạy Unit Test/coverage/build mới**, không khởi động app, seed/migration/reset/ghi DB, không sửa business rule/API/source và không tạo evidence thực thi giả. Các số test trong changelog là dữ liệu archived đã đối chiếu, không phải kết quả execution của nhiệm vụ tài liệu.

Kết luận maintenance của nhiệm vụ: Rules reviewed **YES**; Rules updated **YES**; Documentation synchronized **YES** trong phạm vi hướng dẫn hiện hành và việc phân biệt snapshot lịch sử. Những thiếu sót chưa xác minh ở mục 4 được giữ rõ, không ghi thành business rule hoặc kết quả đã đạt.
