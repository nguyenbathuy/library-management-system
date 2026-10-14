# White-box Coverage Strategy

Ngày: 2026-10-11. **Chưa chạy test/coverage, chưa có tỷ lệ thực đo.** Các ngưỡng dưới đây là mục tiêu đề xuất cho lần triển khai sau. [Plan](Whitebox_Test_Plan.md) có phạm vi source và [Matrix](Whitebox_Test_Matrix.md) có 160 ID thiết kế.

## 1. Lựa chọn framework và phiên bản

Chọn **Vitest 4.1.0 + @vitest/coverage-v8 4.1.0** cho TypeScript backend và React frontend. Đây là phiên bản cụ thể đã kiểm tra metadata bằng `npm view`, không khẳng định là bản mới nhất. Vitest 4.1.0 khai báo Node `^20 || ^22 || >=24` và Vite `^6 || ^7 || ^8.0.0-0`; Node 22.23.3 và Vite 6.3.5 của workspace phù hợp. Coverage package khai báo peer Vitest cùng 4.1.0. Nguồn metadata: [Vitest 4.1.0](https://registry.npmjs.org/vitest/4.1.0), [coverage-v8 4.1.0](https://registry.npmjs.org/@vitest/coverage-v8/4.1.0).

Lý do dự án: frontend đã có Vite, nên dùng cùng pipeline TS/TSX và alias; Vitest cung cấp mocks/timers và môi trường node/jsdom. Jest cũng phù hợp nếu nhóm đã có chuẩn Jest, nhưng repository này chưa có cấu hình Jest và sẽ cần thêm thiết lập TS/ESM/JSX. Không cài hai runner trong bước đầu. Thông tin cấu hình tham khảo [tài liệu Vitest 4](https://v4.vitest.dev/guide/) và [môi trường test](https://v4.vitest.dev/guide/environment.html).

V8 phù hợp Node hiện tại; Vitest cung cấp reporter coverage và cấu hình include. Có thể dùng provider Istanbul thay thế nếu có lỗi remapping được tái hiện, nhưng phải ghi rõ provider và không so tỷ lệ giữa hai cấu hình khác mẫu số. Tham khảo [Coverage chính thức](https://v4.vitest.dev/guide/coverage.html).

## 2. Định nghĩa năm loại coverage

| Chỉ số | Cách tính trong phạm vi công bố | Ý nghĩa và giới hạn |
| --- | --- | --- |
| Statement | Số executable statement được chạy / tổng executable statement × 100% | Một line có thể nhiều statement. Đi qua statement không chứng minh assertion đúng hoặc output hợp nghiệp vụ. |
| Branch | Số nhánh instrumenter báo đã chạy / tổng nhánh instrumenter × 100% | Phải xem branch map. if true/false, ternary, logical expression/optional chaining có thể có mapping riêng của provider; không chỉ đếm số if trong source. |
| Function | Số function/callback được gọi / tổng function/callback instrumented × 100% | Có cả callback anonymous, helper và transaction callback. Việc gọi controller không tự đảm bảo chạy transaction callback nếu mock chỉ resolve. |
| Line | Số executable line có hit / tổng executable line × 100% | Không tính comment/blank như code thực thi; statement coverage và line coverage có thể khác. |
| Condition | Số outcome T/F đã quan sát của từng điều kiện nguyên tử khi được đánh giá / tổng outcome T/F khả thi trong danh sách công bố × 100% | Đo bằng condition ledger và assert/evidence riêng. NE do short-circuit không được tính là F. Outcome không khả thi cần chứng minh và công bố mẫu số raw/feasible. |

Vitest/V8 xuất bốn chỉ số statement/branch/function/line; báo cáo tiêu chuẩn không có cột Condition Coverage độc lập. Một số nhánh logical expression trong branch map giúp kiểm tra toán hạng, nhưng **không được đổi tên Branch % thành Condition %**. Các công thức/ledger bên dưới là phương pháp QA thiết kế riêng cho source này, không phải claim một tính năng condition report của Vitest.

## 3. Ví dụ branch khác condition — login

Biểu thức nguồn LG.1: `!user || !(await bcrypt.compare(password, user.password))`. Đặt A=`!user`, B=`!compare`. Chỉ hai outcome quyết định 401/token có thể đạt khi dùng một ca user không tồn tại và một ca login đúng; B chưa từng true. Vì vậy quyết định if đã đi cả hai cạnh không chứng minh condition B đã có cả hai outcome. Instrumenter có thể ghi thêm nhánh cho logical expression; vẫn phải đối chiếu từng condition riêng.

| Test thiết kế | A đánh giá | B đánh giá | Decision | Side effect phải kiểm tra |
| --- | --- | --- | --- | --- |
| WB-LG-01 | T | NE | T | Không gọi compare hoặc sign; 401 |
| WB-LG-02 | F | T | T | compare được gọi; sign không gọi; 401 |
| WB-LG-03 | F | F | F | sign được gọi; response token |

B khi A=T không thể được đánh giá do short-circuit, không tạo case cưỡng ép đọc user.password của null. Ba đường này là dữ liệu dự kiến, chưa là bảng observed coverage.

## 4. Bảng condition dự kiến cho các biểu thức trọng yếu

### 4.1. resetPassword — RP.1, OR ba toán hạng

| Test ID | !email | !otp | !newPassword | Decision |
| --- | --- | --- | --- | --- |
| WB-RP-01 | T | NE | NE | T |
| WB-RP-02 | F | T | NE | T |
| WB-RP-03 | F | F | T | T |
| WB-RP-12 | F | F | F | F |

Từng field cần thiếu riêng, còn field trước phải hợp lệ để đến toán hạng phía sau. Áp dụng cùng mẫu bốn ca cho required fields createBook CB.2/ import IB.6: WB-CB-02/03/04/05/09 và WB-IB-09/10/11/12/05 là các vector thiếu từng field + all valid. Một ca thiếu tất cả không thay thế được các ca thiếu riêng.

### 4.2. resetPassword — loại, OTP và thời hạn

| Predicate | A | B | Vector testcase đề xuất |
| --- | --- | --- | --- |
| RP.2: sai kiểu password OR length<6 | typeof != string | length<6 | RP-04: T/NE; RP-05: F/T; RP-06 hoặc RP-12: F/F |
| RP.4: không OTP lưu OR OTP khác | !resetOtp | resetOtp != cleanOtp | RP-07: T/NE; RP-08: F/T; RP-12: F/F |
| RP.5: không expiry OR expiry<now | !expiry | expiry<now | RP-09: T/NE; RP-10: F/T; RP-12: F/F; RP-11 biên T pending |

RP-11 pending không được tính là đã quan sát. Password input number đủ truthy để vượt RP.1 và đến type guard. OTP input number được String() hóa: cần tách rủi ro kiểu email khỏi kiểu OTP.

### 4.3. Filter UI và file filter

| Expression | Vector cần có | Test thiết kế |
| --- | --- | --- |
| nameMatch OR emailMatch | T/NE, F/T, F/F | MF-01, MF-02, MF-03 |
| searchMatch AND statusMatch | T/T, T/F, F/NE | MF-01, MF-06, MF-03 |
| ALL OR (ACTIVE AND !blacklist) OR (BLACKLISTED AND blacklist) | ALL; ACTIVE active/blacklist; BLACKLISTED blacklist/active | MF-01, MF-04, MF-05; fixture cần có cả hai trạng thái |
| titleMatch OR authorMatch | T/NE, F/T, F/F | BS-01, BS-02, BS-03 |
| categoryAll OR categoryMatch | T/NE, F/T, F/F | BS-01, BS-02, BS-04 |
| searchMatch AND categoryMatch | T/T, T/F, F/NE | BS-01, BS-04, BS-03 |
| MIME allowed OR extension match | T/NE, F/T, F/F | XF-01 pending, XF-02, XF-03 |
| copies defined AND Number(copies)>0 | F/NE, T/F, T/T | UB-04, UB-06, UB-05 |

MF.2 lưu `matchesStatus` trước return `matchesSearch && matchesStatus`, nên predicates của status vẫn chạy ngay cả khi search không match; chỉ toán hạng đọc biến matchesStatus ở return có thể NE. Cần phân biệt thứ tự tính biến với short-circuit tại return để không ghi sai ledger.

**MC/DC** có thể bổ sung cho guard required/password khi rubric yêu cầu: dựng cặp vector chứng minh từng condition làm thay đổi decision khi các condition còn lại giữ nguyên về giá trị logic, đồng thời lưu thực tế short-circuit. Đây là mục tiêu tùy chọn, không đồng nhất MC/DC với branch hoặc condition. Không khẳng định MC/DC đã đạt từ bảng thiết kế; các condition phụ thuộc như user/password phải phân tích feasibility riêng.

## 5. Mẫu condition ledger khi triển khai

| Source hash + function/predicate | Condition nguyên tử | Test ID | Input vector | T/F/NE thực tế | Assertion/evidence | Feasible outcome thiếu |
| --- | --- | --- | --- | --- | --- | --- |
| Chưa thực thi | Chưa ghi observed value | — | — | — | — | — |

Trước chạy, lập catalog condition từ branch inventory, kể cả `&&`, `||`, ternary, optional chaining và điều kiện vòng lặp cần đưa vào phạm vi. Sau chạy mới điền observed outcome dựa vào đầu vào, thứ tự guard, các spy cho side effect và coverage source location. Có thể inference đơn giản từ guard với input xác định, nhưng phải đánh dấu “suy ra từ test” và liên kết log/assertion, không giả làm counter đo tự động. Những predicate không thể quan sát độc lập phải ghi giới hạn. Không instrument/sửa source ứng dụng trong giai đoạn hiện tại.

Mẫu số cơ bản là 2×số atomic condition đã công bố; chỉ loại outcome bất khả thi có lý do và reviewer đồng ý, không loại thiếu test hoặc testcase R để tăng tỷ lệ. Báo cả raw outcomes và feasible outcomes khi có loại trừ. Coverage % của condition chỉ công bố sau thực thi thật và ledger đầy đủ, không điền tỷ lệ từ testcase dự kiến.

## 6. Phạm vi coverage và mục tiêu dự kiến

Primary tool report phải giữ **toàn bộ code trong các file được include**, bao gồm các hàm chưa chọn, để người đọc biết khoảng trống. Giai đoạn backend include authController.ts, middleware/auth.ts, bookController.ts. Giai đoạn UI include MembersManagement.tsx, BooksManagement.tsx, ImportExcelModal.tsx. Đây là coverage của 3 hoặc 6 file công bố, không phải toàn repository và không phải toàn hệ thống.

| Phạm vi | Statement | Branch | Function | Line | Condition |
| --- | --- | --- | --- | --- | --- |
| authController.ts, mục tiêu trưởng thành | ≥85% | ≥80% | ≥90% | ≥85% | 100% T/F khả thi của các guard P0 được chọn; còn thiếu phải ghi |
| middleware/auth.ts | ≥90% | ≥90% | 100% | ≥90% | Hai outcome khả thi của auth/role guards |
| Các block hàm Book/Excel được chọn | ≥85% | ≥80% | Gọi mọi hàm/callback đã chọn | ≥85% | Ưu tiên required, duplicate, số bản và loop exit |
| Logic lọc/guard UI được chọn | ≥85% | ≥80% | Gọi các callback đã chọn | ≥85% | T/F của filter/required/file-size guards |
| Toàn bookController và toàn 3 component UI | Ghi tỷ lệ thật, chưa đặt gate giai đoạn 1 | Ghi tỷ lệ thật | Ghi tỷ lệ thật | Ghi tỷ lệ thật | Không công bố khi ledger chưa đủ |

Các ngưỡng là đề xuất QA, chưa thử tính khả thi bằng runner. Không áp gate 85% cho toàn bookController trong giai đoạn 1 vì recommendations/template/e-book còn ngoài thiết kế. Không exclude các hàm đó trong file để đạt mục tiêu. Nếu cần báo tỷ lệ cho selected blocks, tính bản tổng hợp riêng từ `coverage-final.json` với statementMap/fnMap/branchMap và ranh giới hàm source, hash cố định, công bố mẫu số; không thay thế whole-file report hoặc dùng lệnh exclude để che code. Function/callback lồng nhau và branch vượt biên cần quy tắc phân bổ rõ, không tự ước lượng bằng đếm dòng.

Không đưa test fixtures/mocks/node_modules/build artifacts vào mẫu số ứng dụng. Không thêm ignore pragma trên source. Startup `server/src/index.ts`, seed, generated Prisma, mail/cron internals và các module không chọn đều ngoài phạm vi file include đã công bố; không kết luận coverage cho chúng.

## 7. Cấu hình và cách chạy dự kiến

Chỉ là nội dung cấu hình để tạo trong nhiệm vụ triển khai sau; **chưa có các file config/test được nêu dưới đây**. Cấu hình backend độc lập frontend, tránh nạp app startup và plugin ngoài nhu cầu test. Tất cả đường dẫn tương đối tính từ repository root.

```ts
// vitest.backend.config.ts — đề xuất tương lai, chưa tạo
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/backend/**/*.test.ts'],
    setupFiles: ['tests/setup/backend.ts'],
    testTimeout: 5000,
    coverage: {
      provider: 'v8',
      include: [
        'server/src/controllers/authController.ts',
        'server/src/middleware/auth.ts',
        'server/src/controllers/bookController.ts',
      ],
      reporter: ['text', 'html', 'json-summary', 'json', 'lcov'],
      reportsDirectory: 'artifacts/qa/whitebox/coverage/backend',
      reportOnFailure: true,
    },
  },
})
```

Sau này tạo `vitest.ui.config.ts`: React plugin hiện có, alias @→src, environment=jsdom, include `tests/unit/ui/**/*.test.tsx`, setup `tests/setup/ui.ts`; coverage.include ba component nêu trên, reportsDirectory UI riêng. Dùng cùng các reporter. Không cần merge toàn vite.config hoặc đổi tsconfig ứng dụng. Vitest transpile TS không thay việc type-check; thêm tsconfig test riêng nếu kiểm tra kiểu.

```bash
# Chỉ chạy SAU khi cài framework, hoàn thành mock và viết test ở nhiệm vụ tiếp theo.
./node_modules/.bin/vitest run --config vitest.backend.config.ts
./node_modules/.bin/vitest run --config vitest.backend.config.ts --coverage
./node_modules/.bin/vitest run --config vitest.ui.config.ts --coverage
```

Dùng binary local đã pin, tránh npx tự tải bản khác nếu chưa cài. Chạy backend/UI riêng và báo riêng. Muốn aggregate phải giữ coverage map từng run, thực hiện merge phù hợp rồi ghi chính xác source/version/mẫu số; không lấy trung bình phần trăm. Khi test fail, reportOnFailure giúp lưu phần coverage thực chạy, nhưng fail vẫn là fail.

## 8. Bằng chứng và cách đọc kết quả tương lai

Lưu log command/exit code, UTC timestamp, Node/Vitest/provider version, source hash và config include/exclude. HTML mở `artifacts/qa/whitebox/coverage/backend/index.html` hoặc UI tương ứng sau chạy; json-summary đọc tổng số covered/total và phần trăm bốn chỉ số; coverage-final.json dùng maps xác định nhánh thiếu; LCOV phục vụ lưu trữ hoặc CI nếu nhóm yêu cầu.

Đối chiếu runner ID với ma trận. Tách pending/skipped do thiếu requirement khỏi testcase executed; skipped không chứng minh coverage. Mocked dependency không được tính là kiểm chứng implementation của dependency. Báo điều kiện còn thiếu và tác động kỹ thuật (rollback, concurrency, routing, SMTP, PDF) thay vì kết luận toàn hệ thống đã an toàn.

Khóa source/config và chạy lại sau sửa lỗi chỉ trong nhiệm vụ được cấp phép. Không công bố tỷ lệ mới khi chưa có report; không thay threshold hoặc oracle để khiến build/test xanh.
