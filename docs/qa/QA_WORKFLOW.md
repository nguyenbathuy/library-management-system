# QA Workflow — hướng dẫn thực thi và lưu bằng chứng

Quy tắc chung và quy trình kiểm tra sau mỗi nhiệm vụ nằm tại [AGENTS.md](../../AGENTS.md). Tài liệu này hướng dẫn QA dựa trên implementation đang có; khi thay config hoặc convention, đồng bộ phần tương ứng. Kết quả từng lượt chạy được lưu riêng, không trở thành yêu cầu PASS/coverage cho mọi nhiệm vụ.

## 1. Nguồn tham khảo và phạm vi

| Công việc | Đọc trước khi thực hiện |
| --- | --- |
| Manual results/defect/retest | [Manual Results v2](output/Manual_Test_Results_v2.xlsx), [Defect Log v2](output/Defect_Log_v2.xlsx), [Gap Analysis v2](output/Manual_Test_Gap_Analysis_v2.md), [Report v2](output/Manual_Test_Updated_v2.docx), input và evidence đúng Test ID |
| Thiết kế white-box | [Test Plan](whitebox/Whitebox_Test_Plan.md), [Matrix](whitebox/Whitebox_Test_Matrix.md), [Coverage Strategy](whitebox/Whitebox_Coverage_Strategy.md), [Implementation Plan](whitebox/Whitebox_Implementation_Plan.md), source hiện tại |
| Tiếp tục unit Authentication/Member | [Phase 1 Results](whitebox/Whitebox_Phase1_Results.md), [Phase 2 Results](whitebox/Whitebox_Phase2_Results.md), [Phase 3 Results](whitebox/Whitebox_Phase3_Results.md), config/mocks/tests hiện tại và evidence từng phase |
| Lịch sử/phạm vi tài liệu | [QA Changelog](CHANGELOG.md), [Rules Audit](Rules_Audit.md); báo cáo kiến trúc/sửa lỗi cũ có ghi chú snapshot ở đầu file |

Bốn kế hoạch white-box là snapshot thiết kế ngày 11/10/2026, trước khi triển khai. Các câu “chưa cài/chưa chạy”, paths/dependency/config đề xuất và lệnh dừng nhiệm vụ trong đó thuộc bước lập kế hoạch. Không áp dụng chúng thành cấm triển khai ở nhiệm vụ được giao sau này; không đổi baseline cũ thành kết quả mới. Dùng package/config hiện tại để xác định tool đã có, báo cáo/evidence để xác định phần đã thực thi.

Manual v2 dùng tài liệu có sẵn `docs/qa/input/Kiểm thử phần mềm.docx` theo xác nhận của người dùng. Tên `Manual_Test_Notes_Final.docx` trong yêu cầu cũ chưa có trong input; không tự tạo/đổi tên file để che thiếu sót. `output/QA_Validation.json` thuộc baseline v1, không được dùng làm validation v2.

## 2. Tooling và lệnh hiện tại

- [Root package.json](../../package.json) khai báo Vitest **4.1.0**, `@vitest/coverage-v8` **4.1.0** và Vite **6.3.5**. Hai test packages cùng phiên bản; npm override `vite: "$vite"` giữ Vite theo khai báo root. Khi đổi dependency, kiểm tra peer/version/lockfile và ảnh hưởng tooling, không nâng runtime packages để tiện viết test.
- Backend source là TS/CommonJS; Vitest nạp trực tiếp TS trong môi trường `node`. [Test tsconfig](../../server/tsconfig.tests.json) riêng dùng ESNext/Bundler/noEmit. Vitest transpile không thay thế type-check. Không đổi production package type/tsconfig chỉ để vượt lỗi loader.
- Runner tại [vitest.backend.config.ts](../../vitest.backend.config.ts): forks, một worker, không chạy file song song, isolate, retry=0. `LMS_WB_SCOPE=authentication` chỉ chạy `server/tests/unit/auth/**/*.test.ts`; `LMS_WB_SCOPE=member` chỉ chạy `server/tests/unit/member/**/*.test.ts`; mặc định `all` chạy cả hai. Book/Excel và UI trong kế hoạch chưa được include.
- jsdom/Testing Library/Jest/Supertest chưa được thêm như direct test dependencies trong cấu hình hiện tại. Kiểm tra lại manifest khi có nhiệm vụ cần chúng; các phiên bản đề xuất trong kế hoạch chưa phải đã cài.

Chạy từ **repository root**, sau khi đã review isolation và có nhiệm vụ cần execution:

```bash
npm test
npm run test:unit
npm run test:coverage
LMS_WB_SCOPE=member npm run test:coverage
LMS_WB_SCOPE=authentication npm run test:coverage
./server/node_modules/.bin/tsc --project server/tsconfig.tests.json --noEmit
```

`npm test` trong `server/` vẫn là placeholder trả lỗi, không phải runner trên. Dùng Node đúng môi trường đã thiết lập trong README; phiên bản execution phải lấy từ metadata thực. Không cài lại dependency, tạo Prisma Client, khởi động app hoặc seed để chạy unit đã cách ly.

Để lưu run riêng, đặt `LMS_WB_RUN_DIR` tới **thư mục mới**. Ví dụ Bash tạo tên theo UTC; kiểm tra tên chưa dùng nếu chạy lại:

```bash
LMS_WB_SCOPE=member LMS_WB_RUN_DIR="artifacts/qa/whitebox/member/$(date -u +%Y%m%dT%H%M%SZ)-coverage" npm run test:coverage
```

Default hiện tại là `artifacts/qa/whitebox/<scope>/latest/`, trong đó `<scope>` là `all`, `authentication` hoặc `member`; có thể bị ghi đè khi chạy lại. Đây là output tạm; báo cáo chính thức cần thư mục run riêng và lưu/đối soát đủ evidence. Đường dẫn `artifacts/qa/whitebox/phase1/latest/` và `artifacts/qa/whitebox/authentication/latest/` trong các phase trước là lịch sử của config tại thời điểm chạy.

## 3. Isolation trước import và execution

1. Đọc source được import và các side effect. Controller Authentication tạo `new PrismaClient()` ở module scope. Production [index.ts](../../server/src/index.ts) khởi động cron/listener; không import file đó, cron hoặc seed vào unit suite.
2. Giữ test-only alias `@prisma/client` tới [prismaGuard.ts](../../server/tests/mocks/prismaGuard.ts). Module guard throw nếu mock chưa đăng ký, tránh fallback sang Prisma thật. Dùng `vi.hoisted`/`vi.mock` trước import controller/service; spy delegate sau import không đủ cách ly.
3. Gate `beforeAll` xác nhận constructor là mock, số lần khởi tạo phù hợp module và object/delegates đúng, không có truy vấn trước testcase. Khi gate fail, ghi lỗi setup/collection và không kết luận case body đã được thực thi.
4. Delegate chưa arrange mặc định phải throw. Fixture tổng hợp ở RAM; reset mock/record/response mỗi ca; restore clock/random/spies. Không lấy dữ liệu thành viên thật hoặc token localStorage thật làm fixture.
5. Mock mail/notification/JWT/bcrypt theo boundary case. Kiểm tra response/DTO/call arguments, số lần và những thao tác **không được gọi** trên guard fail. Ca dùng bcrypt thật trong RAM, nếu được triển khai, phải ghi rõ boundary khác; mock compare=true không chứng minh password mới/cũ.
6. Giữ [network guards](../../server/tests/setup/isolation.ts) khi collection và execution: fetch, HTTP/HTTPS request/get, net connect/createConnection, TLS connect. Kiểm tra attempted calls cuối từng module. Không gửi SMTP/Ethereal hoặc gọi API live. Guard này không phải bằng chứng đã kiểm soát mọi API/network interface có thể có trong test tương lai.
7. Không gọi Prisma thật/$connect/$disconnect/$transaction trong unit Authentication hiện tại. Khi test Book/Excel có transaction callback, mock phải thực thi callback với tx mock để chạy logic source; ghi rõ chưa chứng minh SQL rollback/unique/FK/concurrency.
8. Với module mới có filesystem/upload side effect, mock/cách ly trước import theo source thực tế; không suy isolation của Authentication đã bảo vệ module khác.

Schema hiện hardcode `file:./dev.db`; `DATABASE_URL` khác không chuyển datasource. Integration dùng DB disposable chỉ khi nằm trong nhiệm vụ được giao, có override được xác minh trước kết nối và fixture/setup riêng được cho phép. Không dùng DB chính rồi rollback. So sánh hash source/schema/DB trước/sau hỗ trợ kiểm tra bảo toàn, nhưng hash không đổi không chứng minh không có read/access; kết hợp gate/guards và kiểm tra runtime phù hợp. Nếu app khác đang ghi DB, lưu/đối chiếu nguyên nhân thay đổi, không tự restore dữ liệu.

## 4. Test ID, oracle và kết quả

- Giữ ID `WB-<nhóm>-<số>` trong Matrix; mô tả test bắt đầu bằng ID như các suite hiện có. Không tái sử dụng một ID cho hành vi khác; case bổ sung cần cập nhật thiết kế và trace phù hợp.
- Oracle **B**: từ baseline manual; **S**: hành vi source/contract kỹ thuật quan sát được; **R**: cần xác nhận nghiệp vụ/contract. S không biến code hiện có thành nghiệp vụ đã được duyệt. R chưa chốt ghi pending; nếu chưa tạo test trong runner thì không báo SKIPPED.
- Viết AAA gọi function source thật. Assert output và invariant có ý nghĩa, không test bản sao biểu thức implementation. Dữ liệu giả lập/expected mocked response là precondition unit, không phải actual của hệ thống live.
- Đếm ID testcase riêng biệt; nhiều invocation trong một ID hoặc nhiều lượt rerun không tự tăng tổng testcase. Ghi kết quả từng run và canonical run được dùng trong báo cáo.
- Đọc cả exit code, suite/hook/collection failures và trạng thái body. Body PASS nhưng hook FAIL/exit 1 là lượt thất bại; giữ log lỗi trước rerun. Lỗi installer/harness/mock/test design cần phân loại riêng với production defect.
- Fault injection có Expected lỗi không tự chứng minh dịch vụ thật hỏng. Unit happy path ngoài phạm vi manual defect không đủ Retest/Fixed. Giữ riêng Confirmed Defect, Potential Defect, UX Improvement và Requirement Clarification; chỉ gộp defect khi có bằng chứng cùng nguyên nhân.
- Khi xử lý manual DOCX, giữ màu, italic, ảnh và Expected gốc; đối chiếu actual, không mặc định xanh=PASS hoặc cam=FAIL. NEEDS REVIEW là cờ riêng; status chưa xác nhận phải có lý do.

## 5. Coverage công cụ và condition ledger

Scope coverage hiện tại gồm nguyên ba file: [authController.ts](../../server/src/controllers/authController.ts), [middleware/auth.ts](../../server/src/middleware/auth.ts), [authRoutes.ts](../../server/src/routes/authRoutes.ts). Exclude `node_modules` và `server/tests`. Selector execution chỉ đổi tập test, không đổi ba source file hoặc mẫu số coverage. Giữ các hàm/route chưa test trong mẫu số đã công bố; không thu nhỏ include để tăng tỷ lệ. Khi mở rộng module hoặc đổi provider/source/config, báo scope mới và tách so sánh khỏi baseline khác mẫu số.

Khi báo thêm coverage cho một nhóm hàm, phải lưu raw map và mô tả cách suy dẫn location/slot, gắn nhãn **selected function-body coverage** và trình bày song song với whole-scope metric. Số suy dẫn này không phải report V8 độc lập và không được so trực tiếp với tỷ lệ whole-file/whole-scope khác mẫu số. Import route làm các dòng khai báo route được hit không chứng minh Express đã dispatch HTTP đầy đủ; test gọi chuỗi handler đã đăng ký vẫn là unit wiring nếu không chạy `Router.handle`/server thật.

| Metric | Cách đọc |
| --- | --- |
| Statement | Statement có hit / tổng statement instrumented; không suy từ số dòng |
| Branch | Branch slot có hit / tổng slot trong branchMap; không đồng nhất slot với số if hay predicate |
| Function | Function/callback có hit / tổng fnMap; gồm callback anonymous |
| Line | Executable line có hit / tổng executable line |
| Condition | Outcome T/F của atomic predicates trong catalog công bố; ledger riêng, không lấy Branch % hoặc `branchesTrue` làm chỉ số này |

Ledger ghi source/location, predicate, Test ID/vector, T/F/NE và căn cứ. **NE do short-circuit không phải F**. Phân biệt outcome được instrument trực tiếp với suy luận QA từ captured values + thứ tự source; nêu giới hạn của phương pháp. Không dùng case pending làm observed outcome. So sánh cùng catalog; catalog mở rộng phải có mẫu số và bảng riêng. Không khẳng định full-module Condition Coverage/MC/DC khi chưa đo đủ.

V8 xuất text/HTML/JSON-summary/coverage-final/LCOV. JSON summary/raw maps xác định covered/total và vị trí thiếu. Với denominator=0, trình bày N/A thay vì suy rằng 100% raw đồng nghĩa đã test chức năng. Trung bình các phần trăm không thay thế merge coverage map có căn cứ. Coverage cao không xác nhận yêu cầu đúng, bảo mật đạt hoặc lỗi manual đã sửa.

## 6. Evidence và báo cáo

Lưu mỗi run riêng theo mô hình đã có ở `docs/qa/whitebox/evidence/phase1/` và `phase2/`. Không ghi vào thư mục archived run để tái tạo kết quả; không thay raw file lỗi bằng log đã thành công.

| Evidence | Nội dung/cách tạo |
| --- | --- |
| `execution.log` | Command thực, stdout/stderr; thu thập từ execution, giữ exit code |
| `vitest-results.json` | Runner JSON tự tạo; đối chiếu ID/body/suite/hooks với log |
| `run-metadata.json` | Thu thập timestamp UTC/timezone, command/cwd, versions, HEAD, workspace dirty và hash source/config/test; timestamp fixture không phải thời gian chạy |
| `case-traces.json`, `phase2-*-traces.json`, `phase3-member-traces.json` | Helper hiện có ghi actual input/response/calls; phase sau đặt tên phù hợp và trace được về ID |
| `isolation-gate.json`, `phase2-*-isolation-gate.json`, `phase3-member-isolation-gate.json` | Suite hiện có ghi kiểm tra mock trước body |
| `network-guard-results.<module>.json` | Setup hiện tại ghi guard/call counts mỗi module; file generic là bản ghi cuối, không thay evidence riêng các module |
| `coverage/` | Report do V8 tạo từ run thật; HTML, summary, maps, LCOV cùng run |
| `condition-ledger.json` và bảng `.md` | Phân tích QA có căn cứ actual execution; ghi rõ thủ công/suy luận và giới hạn |
| Preservation/runtime checks | Hash trước/sau; syscall trace nếu đã thực hiện, ghi đúng lệnh/tool/phạm vi và giới hạn |

Scripts npm hiện không tự thu thập đầy đủ log, timestamps, Git status, hashes hoặc syscall/preservation checks. Phải chủ động thu thập/đối soát phần còn thiếu khi lập evidence chính thức; không tự điền rằng đã kiểm tra. SHA HEAD khi workspace dirty không phải commit chứa test/config mới; phải kèm snapshot hashes. Không suy ngày thực thi từ mtime tài liệu.

Báo cáo chỉ thuộc phạm vi Tester được giao; kết quả manual và unit tách riêng. Dùng report/Chapter 4 draft phiên bản mới, giữ baseline cũ và phần thành viên khác; chỉ cập nhật DOCX khi nhiệm vụ yêu cầu. Truy vết findings tới source/test/evidence, ghi nhánh chưa cover và pending. Kết thúc nhiệm vụ theo mục **Rules Maintenance & Documentation Synchronization** trong AGENTS; thay đổi đáng kể ghi changelog cùng validation và hạn chế.
