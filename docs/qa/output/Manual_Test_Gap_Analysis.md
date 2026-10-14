# Phân tích khoảng trống kiểm thử thủ công — phạm vi được phân công

Nguồn: `docs/qa/input/Kiểm thử phần mềm.docx` được người dùng xác nhận thay cho tên `Manual_Test_Notes.docx`; đối chiếu Chương 3 của báo cáo gốc. Đây là chuẩn hóa ghi nhận đã có, không phải lần chạy mới. Báo cáo, mã nguồn ứng dụng và dữ liệu gốc được giữ nguyên; không có commit/push.

## 1. Những testcase đã hoàn thành đối chiếu

Đã ánh xạ đủ **44/44 Test ID**, giữ nguyên Test Scenario và Expected Result. Có **30 ca chốt được kết quả đề xuất**: 27 PASS, 3 FAIL. FAIL là kết quả kiểm thử hoàn thành, không có nghĩa đã sửa lỗi. 25 PASS xanh dựa trên màu phủ mô tả/kỳ vọng; không có nhật ký kết quả từng bước, nên cần bổ sung evidence để hoàn thiện báo cáo.

- PASS: AUTH-01, AUTH-02, AUTH-04, AUTH-05, BOOK-02, BOOK-05, BOOK-06, BOOK-07, BOOK-08, BOOK-09, BOOK-10, EXCEL-01, EXCEL-02, EXCEL-03, EXCEL-04, RES-01, RES-03, RES-05, MEM-01, MEM-03, INV-01, INV-02, INV-03, INV-04, INV-05, NOTI-02, SET-01.
- FAIL: MEM-02, MEM-05, DASH-02.

Hai ca màu cam PASS:

- **INV-04**: Tester ghi chức năng ổn; ảnh nhóm Thiếu/Bất thường phù hợp. Khó nhìn ở chế độ tối là Improvement Note.
- **INV-05**: ảnh cho thấy Excel/PDF mở được, cùng số lượng 166 dự kiến / 3 quét / 2 hợp lệ / 164 thiếu / 1 bất thường, khớp ảnh màn hình. Expected riêng chỉ yêu cầu mở và khớp số lượng, không có tiêu chí font. Giữ nguyên ghi chú “excel ổn nhưng PDF thì không”; vấn đề chữ PDF liên quan DEF-003 và yêu cầu Unicode chung. **DASH-02 FAIL** vì Expected riêng yêu cầu tiếng Việt không lỗi font. Không sửa Expected của INV-05 để thêm/bỏ điều kiện.

## 2. Những testcase chưa thực hiện / chưa có kết quả

AUTH-06, BOOK-03, NOTI-01, SET-02, PAY-01, PAY-02, MAIL-01.

Giữ NOT RUN cho 7 ca không có đánh dấu màu kết quả và không có ghi nhận quan sát. Đây là trạng thái theo dữ liệu đầu vào, cần Tester xác nhận nếu đã chạy nhưng chưa ghi. Không lấy screenshot của RES-01/SET-01 để đánh dấu NOTI-01/SET-02 đã chạy. AUTH-06/MAIL-01 cần mail thử; PAY-01/02 cần phiếu phạt do đồng đội chuẩn bị. Chưa có xác nhận đã thử nhưng bị chặn nên **BLOCKED = 0**; không tự coi điều kiện cần là lỗi cấu hình đã xảy ra.

## 3. Những testcase còn thiếu bằng chứng

Mọi ca có Source Reference tới ghi chú gốc. “Evidence Missing” ở đây là thiếu screenshot/log/file kết quả trực tiếp, không phải tài liệu nguồn không tồn tại. 24 ảnh được trích nguyên byte từ DOCX, không tạo ảnh mới; có SHA256 trong Evidence Manifest và JSON nguồn.

**17 ca đã có đánh dấu nhưng thiếu ảnh/log/file trực tiếp:** AUTH-01, AUTH-02, AUTH-04, AUTH-05, BOOK-02, BOOK-05, BOOK-06, BOOK-07, BOOK-08, BOOK-09, BOOK-10, EXCEL-01, EXCEL-02, EXCEL-03, EXCEL-04, RES-02, DASH-02.

**MEM-02** có ảnh form nhưng thiếu ảnh/log lúc email sai được chấp nhận và đăng nhập thất bại. Các ảnh của 7 ca review chỉ xác nhận một phần: AUTH-03 thiếu hủy phiên/mở lại trang; BOOK-01 thiếu từng nhánh tìm/lọc; BOOK-04 thiếu kết quả/barcode; RES-02 chưa có ảnh; RES-04 thiếu chuỗi trạng thái/NOTIFIED; MEM-04 thiếu gỡ/lọc; DASH-01 thiếu đủ khu/đối soát cùng thời điểm. DASH-02 có ghi chú trực tiếp nhưng ảnh dùng tham chiếu từ INV-05, không có PDF Dashboard riêng.

Ảnh đặt dưới testcase không mặc nhiên chứng minh toàn bộ kịch bản. Ví dụ ảnh RES-05 hiển thị danh sách phiếu mượn, chưa có CANCELLED; INV-02 chỉ ghi nhận quét, chưa có nhóm kết quả; NOTI-02 chỉ thấy đánh dấu tất cả đã đọc; SET-01 có hai giao diện nhưng chưa có bước reload. PASS của các ca xanh dựa trên xác nhận màu của Tester, không tuyên bố ảnh đã bao phủ mọi nhánh. Giới hạn quan sát của từng ảnh nằm trong Evidence Manifest và Evidence Gaps.

**Tất cả 44 ca** thiếu ngày test, commit đã test và môi trường thực thi đầy đủ. Các cột ngày/commit để trống; không lấy ngày tạo thành viên/ngày xuất trong ảnh hoặc commit hiện tại làm ngày/commit test.

## 4. Những testcase cần Tester xác nhận lại

7 ca có Status trống, Review Flag = NEEDS_REVIEW:

| Test ID | Cần xác nhận |
| --- | --- |
| AUTH-03 | Cần xác nhận cả hủy phiên và chuyển /login khi mở lại trang bảo vệ; lỗi màu chữ là ghi chú UX riêng. |
| BOOK-01 | Chưa xác định ô Header thuộc kịch bản BOOK-01 hay chức năng tìm kiếm riêng; cần kết quả tên/tác giả/thể loại/không tìm thấy trước khi chốt. |
| BOOK-04 | Thiếu xác nhận 1 đầu sách, 2 bản sao, 2 barcode khác nhau, khả dụng 2; dữ liệu ảnh khác kịch bản gốc. |
| RES-02 | Không có nút đặt trước có thể là cơ chế từ chối hợp lệ; chưa xác nhận hành vi từ chối tạo yêu cầu. Không đủ căn cứ PASS/FAIL/BLOCKED. |
| RES-04 | Thiếu ghi nhận tìm/lọc, đủ chuỗi WAITING → NOTIFIED → FULFILLED và thông báo khi NOTIFIED. Lịch sử mượn trả cần phối hợp thành viên phụ trách; không kết luận thay họ. |
| MEM-04 | Chưa xác nhận thao tác Admin đưa vào/gỡ blacklist và bộ lọc sau gỡ. Không dùng ảnh chặn mượn để kết luận đầy đủ kịch bản; liên hệ Admin là đề nghị UX. |
| DASH-01 | Chưa có xác nhận đầy đủ sách nổi bật/hoạt động gần đây/không lỗi tải. Cần thống nhất định nghĩa KPI và ảnh cùng thời điểm; không suy ra mọi chỉ số đều sai. |

MEM-05 đã FAIL ở nhánh hạng vì cặp ảnh xác nhận lựa chọn khác dữ liệu lưu. Ảnh thực tế dùng LECTURER, trong khi kịch bản nêu ADMIN hoặc PREMIUM; cần retest dữ liệu đúng kịch bản. Chưa có căn cứ kết luận nhánh ADMIN bị lưu USER. Các cờ phụ TEST_DATA_DEVIATION/PARTIAL_BRANCH, EVIDENCE_MISSING, POTENTIAL_DEFECT, IMPROVEMENT_NOTE không phải 7 ca chưa phân loại.

## 5. Những lỗi cần Dev sửa / vấn đề cần xác minh

| Defect | Test liên quan | Sai lệch xác nhận | Mức độ đề xuất |
| --- | --- | --- | --- |
| DEF-001 | MEM-02 | Tạo thành viên bằng email sai định dạng nhưng không đăng nhập được | Medium (đề xuất); P2 (đề xuất) |
| DEF-002 | MEM-05 | Hạng thành viên lưu STANDARD khác lựa chọn trên form | Medium (đề xuất); P2 (đề xuất) |
| DEF-003 | DASH-02; INV-05 (triệu chứng liên quan, PASS theo Expected gốc) | PDF báo cáo hiển thị lỗi font tiếng Việt | Medium (đề xuất); P2 (đề xuất) |

Cả 3 defect ở trạng thái OPEN theo log mới. Không có bằng chứng sửa, fix commit hoặc retest. Mức Medium/P2 là **đề xuất**, giải thích tác động tại Severity Rationale; chưa tự khẳng định mức ảnh hưởng toàn nghiệp vụ. DEF-003 gộp triệu chứng tiếng Việt PDF, chưa khẳng định chung nguyên nhân. Source Dashboard/Inventory hiện dùng cách xuất khác nhau, Dev có thể tách defect khi xác minh nguyên nhân độc lập.

5 potential defects chưa tính vào confirmed:

| Potential | Test ID | Vấn đề | Cần xác minh |
| --- | --- | --- | --- |
| POT-001 | AUTH-01 | Có thể bỏ qua OTP khi đăng nhập | Xác nhận loại popup, tài khoản/cấu hình 2FA, phiên bản test; tái hiện đúng luồng và lưu video/network. Expected AUTH-01 không quy định OTP. |
| POT-002 | BOOK-01 | Tìm kiếm Header không có tác dụng | Thống nhất phạm vi yêu cầu Header; test riêng từng ô và từng điều kiện; chốt trạng thái BOOK-01 sau đối chiếu. |
| POT-003 | RES-04 | Sau nhận sách đặt trước không cập nhật lịch sử mượn trả | Phối hợp thành viên mượn/trả xác nhận nghiệp vụ FULFILLED có tạo Loan không; ghi ID reservation/book/loan; bổ sung luồng NOTIFIED và thông báo. |
| POT-004 | DASH-01 | Định nghĩa/số lượng độc giả hoạt động không nhất quán | Thống nhất active = chưa blacklist hay đang có khoản mượn; đối soát cùng thời điểm. Tổng đầu sách/đang mượn là việc cần kiểm tra, chưa xác nhận sai. |
| POT-005 | MEM-05 | Nhánh ADMIN có thể bị lưu USER | Thực thi nhánh ADMIN với tài khoản thử và kiểm tra dữ liệu lưu/đăng nhập đúng vai trò; source chỉ là dấu hiệu kiểm tra. |

Các đề nghị bỏ trường thêm sách/tự điền NXB, dấu * bắt buộc, kênh liên hệ Admin, contrast tối được giữ tại Improvement Notes; chưa tự chuyển thành business rules hoặc defect chính thức. Đề nghị suy NXB/năm từ ISBN là nguyên văn ý kiến Tester, chưa được kiểm chứng về tính khả thi.

## 6. Những trường hợp cần Retest

- **MEM-02 / DEF-001**: sau khi Dev cung cấp bản sửa, dùng email sai có/không có @ và email hợp lệ; lưu kết quả tạo/thử đăng nhập. Ghi chính xác dữ liệu, lỗi và phiên bản.
- **MEM-05 / DEF-002**: kiểm tra PREMIUM đúng kịch bản, LECTURER đúng biến thể có lỗi và STANDARD làm đối chứng; nhánh ADMIN thực thi riêng. Chỉ đối chiếu hạng/vai trò; tác động hạn mức mượn phối hợp thành viên phụ trách.
- **DASH-02 / DEF-003**: lấy PDF thống kê riêng, đối chiếu chữ tiếng Việt và file mở. **INV-05** kiểm tra lại triệu chứng liên quan cùng số lượng/file; không thay Expected gốc.
- 7 ca review cần thực thi bổ sung hoặc xác nhận kết quả gốc; đây chưa phải retest sau sửa lỗi.

Không điền Retest Result hoặc Fixed/Closed trước khi có bản sửa và kết quả chạy thực tế.

## 7. Những testcase có thể thực hiện Regression

- Sửa thêm thành viên: AUTH-02, MEM-01/02/03/05; MEM-04 nếu thay đổi trạng thái/quyền.
- Sửa xuất báo cáo: INV-04/05 và DASH-01/02; kiểm tra mở file, nhóm số liệu, chữ, theme.
- Sửa tìm kiếm: BOOK-01/02; Header và ô danh mục cần tách phạm vi rõ.
- Sửa đặt trước: RES-01/03/04/05 và NOTI-01/02; phần nối sang Loan do thành viên mượn/trả thực hiện.
- Nếu xác nhận OTP là lỗi 2FA: AUTH-01/03/05/06 và SET-02 sau chốt yêu cầu/cấu hình.

Đây chỉ là đề xuất ca regression, không phải kết quả đã chạy.

## 8. Những vấn đề cần trao đổi với thành viên khác

Ưu tiên xử lý theo ảnh hưởng:

1. **Cao — cần xác minh sớm**: POT-001 (OTP có thể bị bỏ qua) với người phụ trách xác thực; chốt loại OTP/2FA và commit. Chưa đủ căn cứ severity bảo mật.
2. **Cao — liên quan dữ liệu nghiệp vụ**: POT-003 (nhận sách đặt trước và lịch sử Loan) với thành viên mượn/trả; thống nhất FULFILLED tạo phiếu hay cần thao tác nhận sách riêng. Không bổ sung kết quả mượn/trả/gia hạn/phạt.
3. **Trung bình — defect xác nhận**: Dev xử lý DEF-001/002/003, cung cấp fix commit và dữ liệu retest; nhóm chốt Severity/Priority theo tác động thực tế.
4. **Trung bình — cần chốt yêu cầu**: định nghĩa “Độc giả hoạt động”, Header search, Unicode PDF chung, quyền/hạng thẻ; giữ quy tắc BOOK-06 gộp bản và EXCEL-03 bỏ dòng trùng độc lập.
5. **Trung bình — hoàn thiện bằng chứng**: Tester xác nhận 7 review, bổ sung metadata/evidence cho 30 ca chốt được kết quả; xác nhận 7 NOT RUN.
6. **Theo điều kiện phụ thuộc**: nhóm chuẩn bị phiếu phạt cho PAY-01/02 và hộp thư thử cho AUTH-06/MAIL-01; chỉ ghi BLOCKED khi thực tế đã bị chặn và có nguyên nhân.

## 9. Những điểm chưa nhất quán giữa test và báo cáo

- Mọi vùng kết quả 3.3 trong báo cáo gốc còn placeholder/Not Run mặc dù manual đã có màu. Bản sao chỉ cập nhật vùng kết quả và bảng sơ bộ Chương 3.
- AUTH-01 xanh nhưng có ghi chú vượt OTP: Expected gốc chưa có tiêu chí OTP, nên PASS cơ bản không có nghĩa 2FA an toàn. Source hiện tại xử lý OTP cho quên mật khẩu, chưa xác nhận phiên bản Tester chạy và popup nào.
- BOOK-01 mô tả tìm/lọc danh mục, ghi chú lỗi ô trên cùng: cần chốt mapping trước khi gán lỗi cho mọi nhánh BOOK-01.
- BOOK-04 kịch bản tạo 2 bản, ảnh form là 4/1; MEM-05 kịch bản ADMIN/PREMIUM, ảnh LECTURER. Không thay kịch bản để khớp ảnh.
- BOOK-08 manual yêu cầu thử định dạng khác và ghi thông báo, báo cáo yêu cầu từ chối file không hỗ trợ. PASS dựa trên xác nhận xanh toàn mục; cần evidence xác nhận nhánh từ chối. Không tự viết kết quả thông báo cụ thể.
- INV-05 expected mở/khớp số lượng, ghi chú PDF không ổn do font; DASH-02 expected có chữ đúng font. Không dùng chung kết luận. Yêu cầu chung B141 nêu PDF Unicode, cần BA chốt phạm vi cho kiểm kê.
- DASH-01 expected hiện dữ liệu/không lỗi tải, nhưng ghi chú lệch độc giả có thể do hai định nghĩa khác nhau; không tự đổi Expected thành phải bằng số người chưa blacklist.
- Báo cáo Chương 7 B348/R3 đang ghi Executed = Pass + Fail + Blocked, khác công thức nhiệm vụ. **Không sửa Chương 7**; thông báo thành viên phụ trách sửa khi tổng hợp. Phần sơ bộ Chương 3 dùng Executed = PASS + FAIL.
- Source hiện tại không chứng minh thời điểm test: ví dụ Dashboard xuất qua canvas và có comment tránh lỗi font, khác ghi chú DASH-02. Không đánh dấu Fixed hoặc PASS dựa trên code; cần commit test và retest.
- Mô tả nhập/gộp ISBN tổng quát ở B137/B232 cần đọc cùng đặc tả riêng import tại EXCEL-03, không tự áp dụng Smart Merge cho import. Source read-only hiện có nhánh gộp khi thêm và bỏ dòng ISBN trùng khi import; chưa dùng source làm kết quả test.

Các tham chiếu source chỉ hỗ trợ giải thích/xác minh: `src/app/components/Header.tsx:128`, `src/app/components/MembersManagement.tsx:100`/`:113`, `server/src/controllers/analyticsController.ts:10`, `server/src/controllers/authController.ts:11`, `server/prisma/schema.prisma:17`, `server/src/controllers/bookController.ts:209`/`:612`, `src/app/components/Dashboard.tsx:53`, `src/app/components/InventoryCheck.tsx:293`. Đây là code hiện tại, chưa phải commit đã test; không chạy server/DB/migration/seed.

## Metrics và đối soát

| Chỉ số | Giá trị |
| --- | --- |
| Bộ testcase gốc | 44 |
| Tổng phạm vi đã phân loại 4 trạng thái | 37 |
| Executed = PASS + FAIL | 30 |
| PASS | 27 |
| FAIL | 3 |
| BLOCKED |  |
| NOT RUN | 7 |
| NEEDS_REVIEW (Status trống) | 7 |
| Pass Rate = 27/30 | 90,00% |
| Execution Rate phạm vi chính thức = 30/37 | 81,08% |
| Execution Rate bộ gốc = 30/44 | 68,18% |
| Confirmed Defects | 3 |
| Severity — Medium (đề xuất) | 3 |
| Potential Defects | 5 |
| Thiếu ảnh/log/file trực tiếp | 17 |

**Đối soát:** 27 + 3 + 0 + 7 = **37** testcase có trạng thái chính thức; 37 + 7 review = **44**. Không thể vừa để Status của 7 review trống vừa buộc tổng 4 trạng thái bằng 44; vì vậy tách rõ hai phạm vi thống kê. Execution Rate 81,08% chỉ là phạm vi đã phân loại, không thay tỷ lệ bộ gốc 68,18%. Không trình bày số liệu thành kết quả cuối cả nhóm.

## Điều kiện đưa vào báo cáo bài tập lớn

**Đủ để đưa vào báo cáo dưới dạng kết quả thủ công sơ bộ của phạm vi được phân công; chưa đủ chốt kết quả hoàn tất hoặc nghiệm thu.** Đã đủ 44 Test ID, Expected nguyên văn, mapping màu/ghi chú/ảnh, 30 kết quả đề xuất, 3 defect có căn cứ và bảng đối soát. Còn 7 review, 7 chưa có kết quả, thiếu ngày/commit/môi trường và nhiều bằng chứng từng bước, thiếu nhánh ADMIN/PREMIUM, chưa có fix/retest. Hoàn tất các mục này và kết quả phần của thành viên khác trước khi tổng hợp Chương 7; không tự kết luận thay toàn nhóm.

## Tệp và kiểm chứng

- `Manual_Test_Results.xlsx`: 44 dòng gốc; Metrics/By Module/Review Queue/Evidence Gaps/Source Runs/Evidence Manifest/Split Proposals/Improvement Notes.
- `Defect_Log.xlsx`: 3 confirmed, 5 potential, cải tiến và giải thích severity.
- `Nhom8-DGVKDCLPM_Manual_Test_Updated.docx`: bản sao cập nhật Chương 3; các vùng khác giữ nguyên.
- `Manual_Test_Source_Extraction.json`: từng block/run/định dạng/ghi chú nguyên văn, mapping và SHA256 nguồn/ảnh.
- `evidence/`: 24 ảnh nguồn nguyên byte; `QA_Validation.json`: kết quả kiểm tra file, Test ID, Expected, phạm vi sửa và hash.

Mục lục/header/footer/styles/numbering được giữ nguyên XML. Bổ sung kết quả làm độ dài và số trang thay đổi; mục lục được giữ nguyên theo yêu cầu, số trang cache có thể cần người phụ trách cập nhật sau khi chốt toàn báo cáo. PDF render kiểm tra chỉ nằm thư mục tạm; không phải evidence thực thi ứng dụng.
