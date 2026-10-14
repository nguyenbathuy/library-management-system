# White-box Implementation Plan — công việc tương lai

Ngày: 2026-10-11. **Tài liệu hướng dẫn, chưa cài test framework, chưa tạo Unit Test/config, chưa chạy test hoặc coverage.** Chỉ bốn file Markdown của nhiệm vụ hiện tại được tạo. Có 160 ID thiết kế, 18 ca pending oracle; chi tiết tại [Matrix](Whitebox_Test_Matrix.md).

## 1. Dependency cần thiết

Kiểm tra package.json và package đã cài: root chưa có Vitest/coverage-v8/jsdom/Testing Library/TypeScript; server đã có TypeScript và thư viện ứng dụng. Đề xuất cài tool test ở root để quản lý một phiên bản runner, giữ server dependencies hiện có phục vụ resolve import.

| Dependency | Phiên bản đề xuất | Mục đích |
| --- | --- | --- |
| vitest | 4.1.0 | Runner TS/TSX, mocks, timers |
| @vitest/coverage-v8 | 4.1.0 | Coverage cùng phiên bản runner |
| jsdom | 26.1.0 | DOM cho UI test; engines >=18 phù hợp Node 22 |
| @testing-library/react | 16.3.0 | Component testing, hỗ trợ React 18 hiện tại |
| @testing-library/dom | 10.4.1 | Peer bắt buộc của React Testing Library |
| @testing-library/user-event | 14.6.1 | Tương tác người dùng qua DOM |
| @testing-library/jest-dom | 6.6.3 | Matcher DOM, dùng entry vitest; không cần Jest runner |
| typescript | 5.9.3 | Type-check code test riêng; Vitest transpile không kiểm tra kiểu |
| @types/node / @types/react / @types/react-dom | Major 22 / 18 / 18, pin phiên bản resolve trong lockfile khi triển khai | Types tương ứng runtime/React; không đổi tsconfig ứng dụng |

Vitest/coverage, jsdom và Testing Library metadata đã kiểm tra read-only bằng npm view. React Testing Library 16.3.0 khai báo React/ReactDOM ^18 hoặc ^19 và DOM ^10. Nguồn: [package metadata React Testing Library](https://registry.npmjs.org/@testing-library/react/16.3.0), [jsdom](https://registry.npmjs.org/jsdom/26.1.0); hướng dẫn môi trường và rendering tại [Testing Library setup](https://testing-library.com/docs/react-testing-library/setup/).

Không cần Supertest ở bước unit đầu tiên vì gọi controller bằng req/res mock; không cần jest-mock-extended nếu dùng vi.fn và mock cấu trúc delegate rõ ràng. Supertest chỉ xem xét khi có nhiệm vụ kiểm thử middleware/route wiring riêng bằng app thử không listen và không DB.

Lệnh **đề xuất cho nhiệm vụ sau**, chưa thực thi trong nhiệm vụ này:

```bash
npm install --save-dev --save-exact vitest@4.1.0 @vitest/coverage-v8@4.1.0
npm install --save-dev --save-exact jsdom@26.1.0 @testing-library/react@16.3.0 @testing-library/dom@10.4.1 @testing-library/user-event@14.6.1 @testing-library/jest-dom@6.6.3
npm install --save-dev --save-exact typescript@5.9.3 @types/node@22 @types/react@18 @types/react-dom@18
```

Các lệnh sẽ thay package.json/package-lock.json khi triển khai; phải được đưa vào phạm vi nhiệm vụ viết test sau này. Chưa cần cập nhật React/Vite, cài thêm backend test tool ở server hoặc đổi script test placeholder hôm nay. Không chạy npm run dev để test unit.

## 2. Cấu trúc file sẽ tạo khi được giao triển khai

```text
vitest.backend.config.ts                 # config test riêng ở root
vitest.ui.config.ts                      # node và jsdom tách biệt
tsconfig.tests.json                      # types/check cho tests, không đổi app tsconfig
tests/setup/backend.ts                   # env giả lập riêng; không import app/controllers sớm
tests/setup/ui.ts                        # jest-dom/vitest, cleanup, DOM/provider setup
tests/support/prisma.mock.ts             # mock constructor/delegates, tx callback
tests/support/http.mock.ts               # req/res/next Express stubs
tests/unit/backend/auth.middleware.test.ts
tests/unit/backend/auth.login.test.ts
tests/unit/backend/auth.password.test.ts
tests/unit/backend/member.controller.test.ts
tests/unit/backend/book.controller.test.ts
tests/unit/backend/book.import.test.ts
tests/unit/ui/members.test.tsx
tests/unit/ui/books.search.test.tsx
tests/unit/ui/import.file.test.tsx
artifacts/qa/whitebox/                    # CHỈ có sau chạy thật: logs và coverage
```

Đây là đường dẫn **đề xuất**, không khẳng định đang có trong repository. Không thêm helper nghiệp vụ, export, hay đổi business logic của app để làm test dễ hơn. Hai helper private được gọi gián tiếp qua controllers thật; handlers/filter UI chạy qua render. Kết quả về module resolution/TypeScript CommonJS cần xác minh ở bước smoke test trước bộ test rộng.

## 3. Cách test hoàn toàn cách ly database chính

1. Mock `@prisma/client` trước lần import controller/service đầu tiên. authController và bookController tạo PrismaClient ngay ở module scope; chỉ spy delegate sau import là quá muộn. Factory cần constructor hợp lệ, trả mock object; constructor thật tuyệt đối không được gọi.
2. Dùng `vi.hoisted` để tạo trạng thái mock và `vi.mock` factory ở file test; không import controllers trong setup file trước mock. Source TS đang dùng cú pháp import nhưng server package/tsconfig là CommonJS: nạp trực tiếp .ts qua Vitest, không require bản dist. `vi.mock` không mock require; phải kiểm tra pipeline thực ở smoke test. Nguồn: [Vitest 4 vi.mock/vi.hoisted](https://v4.vitest.dev/api/vi.html).
3. Stub đầy đủ delegate cần dùng: user.findUnique/create/findMany/update; book.findMany/findUnique/findFirst/create/update/delete; category/author/publisher.upsert; bookItem.findUnique/create/count/findMany/deleteMany; loan/reservation.deleteMany; auditLog.create; và $transaction. Mặc định delegate chưa thiết lập nên fail test, tránh trả success tùy tiện.
4. `$transaction` mock phải await callback(txMock) và trả output, không chỉ mockResolvedValue khi testcase cần chạy tạo book/items. Tx delegates là mocks có sequence; while collision dùng sequence [collision..., null]. Đây là kiểm tra điều phối và vòng lặp, không xác nhận database rollback.
5. Stub mailService.sendPasswordResetOtpEmail và notificationService.createNotification trước import, để không nạp transporter/Prisma service thật. Không SMTP/Ethereal/cron, không token production. JWT mock cho guard/claims; env JWT_SECRET chỉ là giá trị dùng trong test và được restore. Fake timers/Math.random riêng mỗi testcase, restore sau test.
6. bookController dòng 31–34 có existsSync/mkdirSync khi import, uploadEbook dùng diskStorage. Mock node fs trước import; existsSync return true, mkdirSync spy; mock Multer capture memory/diskStorage/options/single để không upload hoặc ghi file. Không có thao tác tạo thư mục từ source thật. Kiểm tra __dirname/CJS loading trước chạy cases.
7. UI mock module client.ts trước render vì API cố định localhost:5000/api. Không gọi API live, không lấy localStorage token thật, không gửi form tới server đang chạy. QueryClient retry=false, cache riêng; providers/toast/confirm được stub. Nếu có fetch/XHR/socket ngoài mock ngoài dự kiến thì fail setup, không tiếp tục test với live network.
8. Hai ca password→login dùng bcrypt thật với user state ở RAM; sau mỗi test xóa state. Dữ liệu mock/fixture chỉ tồn tại trong tiến trình test, không seed/migrate/ghi SQLite. Không tải dữ liệu thành viên thật để làm fixture.

Schema thực dùng **url=file:./dev.db** trong [schema.prisma](../../../server/prisma/schema.prisma#L5); đặt DATABASE_URL sang file khác **không tự đổi datasource này**. Vì vậy unit suite không dùng Prisma thật. Hash dev.db/source/config/baseline trước và sau lần chạy; nếu có app live đang ghi DB thì hash khác cần đối chiếu nguyên nhân, không tự restore hoặc kết luận unit đã an toàn chỉ nhờ hash.

Nếu sau này cần integration để kiểm chứng SQL unique/FK/transaction, lập nhiệm vụ riêng với datasource override rõ ràng, DB disposable nằm ngoài server/prisma/dev.db, schema compatible và fixture được cho phép; không dùng seed/migration hiện có tự động. Phần đó chưa được thực hiện hoặc đưa vào bộ unit hiện tại. Không dùng transaction trên DB chính rồi rollback như một cách “an toàn”.

## 4. Trình tự triển khai

| Bước | Phạm vi | Test ID/mục tiêu | Điều kiện hoàn tất |
| --- | --- | --- | --- |
| 0 | Chốt oracle và snapshot | 18 ca R; POT-001/POT-002; dữ liệu retest MEM-02 | Lưu quyết định email/Admin/count/expiry; không sửa Expected v2 hoặc chuyển Potential thành Confirmed từ source |
| 1 | Tooling và isolation | Config, mocks, smoke import controller | CJS/TS/mock/default import xlsx/multer và __dirname hoạt động; constructor/SMTP/HTTP/fs thật không được gọi |
| 2 | Middleware và login | AT/AA/OA/LG/ME | Guard T/F, OR short-circuit, claim/DTO; không nhầm test API với UI route |
| 3 | Member regression | RG/MA/GU, ưu tiên RG-04/05 | Chứng minh request form và data persistence intent khác nhau; Expected lưu tier giữ nguyên, lỗi nếu app vẫn bỏ tier được ghi thật |
| 4 | Mật khẩu/OTP | CP/FP/RP | Guards, 5/6/7, OTP sai/hết hạn/đúng/xóa/replay; CP-11/RP-16 dùng bcrypt thật trong RAM |
| 5 | Blacklist/filter | TB/MF/MT | Explicit/toggle/self/not-found/confirm, lọc và counts; không gọi loan API |
| 6 | Book controller | GB/BF/CB/UB/DB | New/merge, guard counts, barcode collision, metadata optional, cấm xóa khi borrowed; delete chỉ mock |
| 7 | Excel | XF/IB/NK/EV | MIME/ext, row branches, aliases/duplicate/transaction row error/audit; không merge duplicate import |
| 8 | Catalog search và coverage | BS; backend/UI runs riêng | Actual tool reports, condition ledger T/F/NE, branches thiếu/backlog và denominator công bố |
| 9 | Tổng hợp cho Chương 4 | Bảng test/coverage/defect thực tế | Chỉ viết kết quả từ logs; giữ scope Tester và phần thành viên khác |

Các ca R chưa chốt có thể để TODO/SKIP có lý do, nhưng phải báo pending và không tính là PASS hoặc outcome đã cover. Ưu tiên RG-04 LECTURER tái hiện lỗi đã có evidence, RG-05 PREMIUM mở rộng đúng Expected. RG-07 ADMIN không triển khai assertion nâng quyền từ public endpoint trước khi chốt authorization.

## 5. Nguyên tắc assertion và lỗi phát hiện

Assert output/HTTP/query intent/side effect và invariant độc lập: guard fail không hash/update/transaction; duplicate import không create; merge không create đầu sách thứ hai; barcode retry đến giá trị chưa có; password lưu là hash; DTO không chọn secret. Không snapshot nguyên implementation hoặc sao chép biểu thức vào helper test rồi chỉ test bản sao.

Không dùng fake state đã trả tier đúng để kết luận app đã lưu tier: RG-04/05 phải kiểm tra `user.create` nhận membershipTier đúng. GU/ME select assertions xác nhận API yêu cầu DTO an toàn, không giả lập ORM tự lọc rồi tuyên bố DB privacy được kiểm chứng. Có thể dùng sequential in-memory record cho credential/replay, nhưng phải công bố giới hạn concurrency/persistence.

Khi regression fail, lưu input, response/mock calls, source hash và test log; liên kết DEF-001/002/POT-005 nếu đúng phạm vi. New finding từ source là dấu hiệu; chỉ triage theo test thật sau này, không tự sửa Defect_Log_v2 hoặc đóng lỗi. Không đổi Expected để phản ánh hành vi sai. Notification reject giả lập phải được ghi “dependency fault injection”, vì service thực có catch và trả null.

Nếu smoke test cho thấy Vitest không xử lý CJS/module cache phù hợp, điều chỉnh test loader/config riêng, không đổi package type/tsconfig của app. Jest+ts-jest cho backend là fallback cần đánh giá riêng, không tự cài thêm hoặc claim đã chạy. Chỉ mở rộng tests khi failures/coverage thực chỉ ra khoảng trống có giá trị.

## 6. Ghi kết quả vào Chương 4 sau khi thực thi

[Manual_Test_Updated_v2.docx](../output/Manual_Test_Updated_v2.docx) hiện có Chương 4 và mục 4.1/4.2 chưa có nội dung. **Chưa sửa DOCX trong nhiệm vụ lập kế hoạch này.** Khi được giao cập nhật sau thực thi, tạo bản sao báo cáo và giữ phần thành viên khác. Đề nghị cấu trúc:

- **4.1. Phạm vi và phương pháp:** ba module của Tester, source snapshot/hash, framework/version, đơn vị được test, mock boundary, tiêu chí statement/branch/condition và CFG login/reset/import.
- **4.2. Thiết kế và thực thi:** bảng WB ID → function/path/line → branch/condition → manual/defect, input/Expected, actual riêng từ runner; số executed/pass/fail/skipped/pending, không gọi 160 designs là 160 executed.
- **4.3. Coverage thực đo:** bốn metric từ report, covered/total, provider/include/exclude, source version; condition ledger riêng T/F/NE, giới hạn feasibility; whole-file và selected-block denominators tách rõ.
- **4.4. Defect/regression:** kết quả thật MEM-05/email/password/import, liên kết evidence logs. Phân biệt defect cũ/đã retest, potential và requirement chưa chốt; không ghi Fixed khi thiếu fix/retest.
- **4.5. Hạn chế và công việc còn lại:** mock DB không chứng minh SQL rollback/concurrency, unit không chứng minh SMTP/PDF/UI navigation, nhánh chưa test, R pending và kế hoạch integration riêng.

Nếu chưa chạy, Chương 4 chỉ được mô tả “kế hoạch dự kiến”, kết quả/coverage ghi “chưa đo/chưa thực thi”. Không chuyển số Manual PASS/FAIL vào bảng kết quả Unit Test; không gọi đây là kết quả cuối toàn nhóm.

## 7. Việc cần làm để bắt đầu viết Unit Test

Chốt các oracle R trọng yếu → giao nhiệm vụ triển khai riêng → cài tool đã pin ở root → tạo cấu hình/mocks cách ly → smoke import → viết các middleware/login cases và regression tier trước → chạy bằng binary local → đọc log/coverage thật, hoàn thiện condition ledger. Lệnh chạy dự kiến và reporter nằm tại [Coverage Strategy](Whitebox_Coverage_Strategy.md).

Nhiệm vụ hiện tại dừng ở tài liệu. Không có Unit Test được tạo hoặc chạy; không sửa source/business rule/database/baseline, không seed/migrate, không commit/push.
