# Project Rules — Library Management System

## Scope & Instruction Conflicts

Áp dụng cho toàn repository. Trước khi sửa một thư mục, kiểm tra hướng dẫn tại đó và các thư mục cha: `AGENTS.override.md`, `AGENTS.md` và tài liệu được chỉ định. Tôn trọng phạm vi hướng dẫn thư mục con; không tạo bản sao quy tắc khi chưa có nhu cầu riêng. Chỉ dẫn hệ thống/developer và yêu cầu trực tiếp của người dùng được ưu tiên hơn tài liệu repository. Khi có xung đột, nêu rõ file, điều khoản và tác động; không âm thầm bỏ một quy tắc hoặc tự sửa yêu cầu. Tiếp tục phần công việc không phụ thuộc xung đột, chỉ hỏi khi chưa có đủ căn cứ quyết định.

## Project Understanding

- Frontend React 18/TypeScript, Vite 6, Tailwind CSS 4 ở `src/`; trang tại `src/app/components/`, state tại `src/app/contexts/`, Axios tại `src/app/api/client.ts`. React Query quản lý server state; `xlsx`, `html2canvas-pro`, `jspdf` phục vụ nhập Excel/xuất PDF.
- Backend Express 5/TypeScript ở `server/src/`: `routes/`, `controllers/`, `middleware/`, `services/`, `jobs/`. Prisma 5, `bcryptjs`, `jsonwebtoken`, `nodemailer`, `node-cron`, `multer`, `xlsx` là các dependency liên quan. Root package ESM; server package CommonJS.
- `server/src/index.ts` đăng ký API, khởi động cron và mở listener. Frontend hiện gọi `http://localhost:5000/api`; cấu hình chạy local xem [README](README.md).
- Schema thực ở [server/prisma/schema.prisma](server/prisma/schema.prisma): SQLite `file:./dev.db`, tương ứng `server/prisma/dev.db`. Schema/source thể hiện implementation hiện tại, không tự xác nhận business requirement hoặc trạng thái defect.
- Đọc theo nhiệm vụ: chạy local → README; kiến trúc/API → source/routes/schema liên quan và [phân tích hệ thống có ghi chú phạm vi](docs/system_analysis_report.md); QA → [QA Workflow](docs/qa/QA_WORKFLOW.md), baseline trong `docs/qa/output/`, [White-box Plan](docs/qa/whitebox/Whitebox_Test_Plan.md) và [Matrix](docs/qa/whitebox/Whitebox_Test_Matrix.md). Báo cáo từng phase là lịch sử thực thi; cấu hình/package hiện tại quyết định lệnh và phạm vi runner hiện tại.

## Development Rules

- Đọc source, caller, dependency và test liên quan trước khi chỉnh sửa. Giữ thay đổi nhỏ, có thể kiểm chứng, trong phạm vi được giao.
- Không tự đổi business requirements, API contract hoặc Expected Result. Phân biệt hành vi quan sát trong code với nghiệp vụ đã được xác nhận.
- Trước khi xóa/đổi tên file, xác định tác động tới import, route, scripts, dữ liệu, test và liên kết tài liệu. Không xóa thay đổi của người khác.
- Xác minh phù hợp với thay đổi: test cho hành vi có rủi ro, type-check/build khi ảnh hưởng code/tooling, kiểm tra cấu trúc/link/diff khi chỉ sửa tài liệu. Báo rõ kiểm tra đã chạy, chưa chạy, kết quả và giới hạn. Không chạy app hoặc suite chỉ để tạo thêm kết quả khi không cần thiết.

## Testing Rules

- Unit kiểm tra đơn vị source thật với dependency được cách ly; integration kiểm tra tương tác giữa các thành phần; E2E kiểm tra luồng người dùng trên hệ thống chạy thật. Ghi rõ boundary, không dùng kết quả loại này để khẳng định loại khác.
- Đọc code, thiết kế testcase, chuẩn bị dữ liệu và ảnh mở ứng dụng không thay thế test execution. Không tạo PASS/FAIL/coverage/evidence giả; không đổi Expected/assertion để hợp thức hóa lỗi.
- Test mới phải có ID duy nhất, input, oracle và lý do; liên kết requirement/defect khi có căn cứ. Giữ nguyên ID, Expected và lịch sử baseline. Requirement chưa rõ phải ghi pending, không suy Expected từ hành vi đáng ngờ.
- Branch Coverage khác Condition Coverage. Công bố provider, include/exclude, covered/total và phạm vi module/file; không gọi coverage phạm vi chọn là coverage toàn hệ thống. Condition ledger thủ công ghi T/F/NE và căn cứ; không biến nó thành metric tự đo của V8.
- Khi viết/chạy white-box, đọc [QA Workflow](docs/qa/QA_WORKFLOW.md), giữ mock Prisma trước import và kiểm tra isolation. Không import production bootstrap/cron/seed để chạy unit; không gọi HTTP/SMTP/Ethereal thật. Mock không chứng minh SQLite persistence, JWT cryptography hoặc mail delivery.
- Lệnh hiện có chạy **từ root**: `npm test`, `npm run test:unit`, `npm run test:coverage`. Runner tại [vitest.backend.config.ts](vitest.backend.config.ts); test tại `server/tests/`; type-check riêng: `./server/node_modules/.bin/tsc --project server/tsconfig.tests.json --noEmit`. `server/package.json` vẫn có script test placeholder.
- Tooling đang khai báo Vitest và `@vitest/coverage-v8` cùng **4.1.0**; kiểm tra package/lockfile khi đổi tool. Không mặc định các dependency UI được đề xuất trong kế hoạch cũ đã được cài. Giữ riêng log lỗi harness/môi trường và lỗi ứng dụng.
- Mỗi lượt cần lưu kết quả vào đường dẫn riêng qua `LMS_WB_RUN_DIR`; giữ nguyên evidence đã dùng cho báo cáo. Không đánh dấu defect Fixed chỉ từ source review hoặc unit PASS ngoài phạm vi retest.

## Database Safety

- Không seed, migration, `db push`, reset, restore hoặc chỉnh dữ liệu thật nếu nhiệm vụ không yêu cầu. Quyền đã được người dùng cấp cho đúng thao tác/phạm vi trong phiên làm việc vẫn có hiệu lực; không hỏi lại chỉ vì quy tắc này.
- Unit Test không dùng database chính, kể cả transaction rồi rollback. Mock hoặc cách ly database và external dependencies trước khi nạp source có side effect.
- Datasource hiện viết trực tiếp `file:./dev.db`; chỉ đặt `DATABASE_URL` khác không đổi kết nối này. Đối với integration được giao, xác minh datasource override và dùng DB riêng có thể hủy, không suy rằng đã cách ly từ tên biến môi trường.
- Khi được giao sửa dữ liệu/schema: xác định đường dẫn/kết nối thực, mục tiêu và phạm vi ảnh hưởng; sao lưu phù hợp trước ghi; kiểm tra sau thao tác. Không tự restore khi thấy hash khác: xác định cả hoạt động của tiến trình khác.

## Git Rules

- Không commit/push nếu chưa được yêu cầu. Không reset/clean/checkout để xóa thay đổi có sẵn; phân biệt diff của nhiệm vụ với trạng thái workspace trước đó.
- Kiểm tra diff và file mới trước khi kết thúc. Repo hiện theo dõi một số `node_modules`; không đưa thay đổi cài đặt có sẵn vào nhiệm vụ mới hoặc tự dọn chúng.
- Không đưa credentials, JWT/SMTP secrets, `.env` chứa bí mật hoặc dữ liệu nhạy cảm vào commit, fixtures hay evidence mới. Kiểm tra nội dung và phạm vi file khi được yêu cầu commit.

## Rules Maintenance & Documentation Synchronization

**Bắt buộc ở cuối mọi nhiệm vụ có thay đổi file, kể cả chỉ sửa tài liệu/test/config:**

1. Kiểm tra `git diff`, `git diff --cached`, `git status` và danh sách file mới/untracked; đối chiếu với trạng thái trước nhiệm vụ. Đọc cả file mới vì `git diff` không hiển thị nội dung untracked.
2. Đánh giá tác động lâu dài tới **kiến trúc, business rules đã xác nhận, API contracts, database schema, coding conventions, testing conventions, test commands, dependency/tooling requirements, security constraints và development workflow**.
3. Nếu có tác động, cập nhật `AGENTS.md` hoặc tài liệu chuyên biệt liên quan trong cùng nhiệm vụ; cập nhật liên kết ở đây nếu nơi lưu hướng dẫn thay đổi. Nếu không có thay đổi quy tắc lâu dài, **không sửa AGENTS.md chỉ để tạo thay đổi**; ghi rõ lý do trong báo cáo cuối.
4. Không biến số PASS, tỷ lệ coverage, lỗi tạm thời hoặc tiến độ phase thành quy tắc lâu dài. Đưa kết quả vào báo cáo/evidence và lịch sử; hướng dẫn chỉ giữ phương pháp có căn cứ.
5. Với thay đổi đáng kể, cập nhật changelog phù hợp. Công việc QA ghi tại [docs/qa/CHANGELOG.md](docs/qa/CHANGELOG.md): thay đổi, file ảnh hưởng, lý do, validation và vấn đề còn tồn tại. Không tự tạo ngày thực thi, commit SHA hay lịch sử chưa xác minh.
6. Đồng bộ tài liệu với implementation hiện tại; giữ snapshot lịch sử/baseline và giải thích khác biệt phiên bản. Kiểm tra link, xung đột và validation phù hợp; báo rõ những chỗ chưa thể xác nhận thay vì tự lựa chọn yêu cầu.
7. Báo cáo cuối **phải có nguyên block** dưới đây, điền giá trị thực tế. `Updated files` liệt kê file rules/tài liệu được tạo hoặc sửa; `Validation` ghi kiểm tra thực chạy và kiểm tra chưa chạy có lý do.

```text
RULES MAINTENANCE CHECK:
- Rules reviewed: YES/NO
- Rules updated: YES/NO
- Updated files:
- Reason:
- Documentation synchronized: YES/NO
- Validation:
```
