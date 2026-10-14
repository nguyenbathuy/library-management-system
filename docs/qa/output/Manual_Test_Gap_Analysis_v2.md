# Manual Testing — QA Baseline v2

**Nguồn thực tế:** chưa có docs/qa/input/Manual_Test_Notes_Final.docx trong workspace. Tệp có sẵn Kiểm thử phần mềm.docx đã được cập nhật so với nguồn v1 (SHA256 hiện tại f0c76ff93d329d715f37b6f9519a134d746497470541ab85f39b6683534d9a9b); dùng nội dung này theo yêu cầu tiếp tục khi thiếu file, không tự đổi tên input. Có ghi nhận mới cho cả 7 ca NOT RUN v1. Không coi tên file thiếu là lý do bỏ qua các ghi nhận mới; không suy ra 44 ca đều đạt hoặc đã đủ evidence.

Nguồn đọc: [manual đã cập nhật](<../input/Kiểm thử phần mềm.docx>), [kết quả v1](Manual_Test_Results.xlsx), [defect v1](Defect_Log.xlsx), [gap analysis v1](Manual_Test_Gap_Analysis.md), [báo cáo đã cập nhật](Nhom8-DGVKDCLPM_Manual_Test_Updated.docx). Đã đọc lại OOXML 44 testcase: 193 run, màu RGB/kế thừa, italic, paragraph mark và 32 ảnh. Tái sử dụng 24 ảnh v1 theo Test ID/SHA256 và trích 8 ảnh mới nguyên byte vào evidence/v2; không tạo hoặc chỉnh ảnh.

## Kết quả có thể báo cáo

| Chỉ số | Số lượng / giá trị |
| --- | --- |
| Total Testcases | 44 |
| PASS | 30 |
| FAIL | 3 |
| BLOCKED | 0 |
| NOT RUN | 0 |
| Unconfirmed Status | 11 |
| Classified Scope | 33 |
| Executed With Conclusion | 33 |
| Confirmed Defects | 3 |
| Potential Defects | 6 |
| UX Improvements | 5 |
| Requirement Clarifications | 7 |
| Evidence Enough For Scoped Expected | 3 |
| Partial Screenshot Evidence | 23 |
| No Direct Screenshot | 18 |
| Missing Test Metadata | 44 |
| Final Input Available | False |
| Reconciliation | 33 + 11 = 44 |

- PASS: AUTH-01, AUTH-02, AUTH-04, AUTH-05, BOOK-02, BOOK-05, BOOK-06, BOOK-07, BOOK-09, BOOK-10, EXCEL-01, EXCEL-02, EXCEL-03, EXCEL-04, RES-01, RES-03, RES-05, MEM-01, MEM-03, INV-01, INV-02, INV-03, INV-04, INV-05, NOTI-01, NOTI-02, SET-01, SET-02, PAY-01, PAY-02.
- FAIL: MEM-02, MEM-05, DASH-02.
- BLOCKED: 0; không có ghi nhận một lần chạy bị chặn.
- NOT RUN: 0; cả 7 ca v1 nay có ghi nhận mới, ca thiếu đối chiếu Expected để Review.
- Status chưa xác nhận, cờ Needs Review: AUTH-03, AUTH-06, BOOK-01, BOOK-03, BOOK-04, BOOK-08, RES-02, RES-04, MEM-04, DASH-01, MAIL-01.
- Executed có kết luận = 30 + 3 = 33; Pass Rate = 30/33 = 90.91%; tỷ lệ trên bộ44 = 33/44 = 75.00%. Đây là số ca có kết luận, không phải tổng số thao tác/lần chạy.

**Đối soát:** 30 + 3 + 0 + 0 = 33; 33 + 11 chưa xác nhận = 44. NEEDS REVIEW là cờ riêng, không là trạng thái thực thi thứ năm. Không dùng tỷ lệ trên phần đã phân loại thay tỷ lệ bộ44.

## Thay đổi so với v1

| Record | Trước | V2 | Lý do |
| --- | --- | --- | --- |
| Manual_Test_Notes_Final.docx | Chưa có tên file | Dùng manual có sẵn đã cập nhật | SHA256 mới, có 32 ảnh và ghi nhận cả 7 ca NOT RUN v1; không tự đổi tên input. |
| BOOK-08 | PASS | Status trống; Needs Review | V2 điều chỉnh PASS của v1 thành trạng thái chưa xác nhận. Checklist xanh xác nhận mở e-book, nhưng câu "Thử file định dạng khác và ghi nhận thông báo lỗi" là hướng dẫn, chưa ghi kết quả file bị từ chối/không được lưu. Expected gốc yêu cầu cả nhánh từ chối file không hỗ trợ. Cần kết quả thực tế và file/screenshot cho hai nhánh; không tự điền thông báo lỗi. |
| DEF-003 / DASH-02 | DASH-02; INV-05 liên quan | Chỉ DASH-02 | Không gộp theo triệu chứng khi chưa có bằng chứng chung nguyên nhân. Bản ghi cũ nguyên văn giữ Archive. |
| INV-05 / IMP-006 | UX note + liên quan DEF-003 | POT-006 + REQ-006 | Giữ PASS trong phạm vi Expected nguyên văn: Excel/PDF mở và số lượng khớp ảnh đối chiếu 166/3/2/164/1. Screenshot xác nhận tên tiếng Việt bị lỗi trong PDF kiểm kê. Tách POT-006 khỏi DEF-003 Dashboard; chưa biết chung nguyên nhân. Cần chốt tiêu chí bảo toàn tiếng Việt cho PDF kiểm kê; không đổi Expected INV-05 để ép FAIL. |
| AUTH-06 | NOT RUN | Status chưa xác nhận | Đã có ghi nhận thực thi mới, không giữ NOT RUN. Expected báo cáo còn yêu cầu đăng nhập bằng mật khẩu mới; chưa có kết quả nhánh này. Thông báo reset trong NOTI-01 chỉ hỗ trợ reset, không chứng minh đăng nhập mới. |
| BOOK-03 | NOT RUN | Status chưa xác nhận | Expected cho phép tài khoản chưa có lịch sử nhận gợi ý thịnh hành, không yêu cầu hai danh sách phải khác nhau. Chưa có kết quả mở đúng chi tiết sách và dữ liệu lịch sử từng tài khoản; chưa chốt PASS/FAIL. Cá nhân hóa cần chốt yêu cầu riêng. |
| NOTI-01 | NOT RUN | PASS | Đối chiếu Expected với xác nhận Tester và ảnh đúng tài khoản/sự kiện. PASS từ ghi nhận mới, không phải agent thực thi; ảnh chỉ là snapshot sau sự kiện, thiếu số chưa đọc trước. |
| SET-02 | NOT RUN | PASS | Giữ PASS theo xác nhận đủ nội dung Expected của Tester; ảnh hỗ trợ phân biệt vai trò nhưng bị cắt phần cuối, cần ảnh toàn trang để kiểm chứng riêng sự vắng mặt nút tác vụ. |
| PAY-01 | NOT RUN | PASS | Kết quả hiển thị sau hủy khớp Expected giữ chưa tất toán. PASS từ kết quả Tester và screenshot, không chạy thanh toán. Chưa có Loan ID hoặc DB/API snapshot trong tài liệu. |
| PAY-02 | NOT RUN | PASS | Đạt Expected theo ghi nhận Tester và ảnh sau thanh toán. Chưa có ảnh màn hình giao dịch thành công. Hai ảnh PAY có cùng tên/ngày mượn/hạn trả; cần xác nhận Loan ID vì Scenario gốc dùng phiếu thử khác. Không tự đổi Scenario hoặc gán ID từ ảnh. |
| MAIL-01 | NOT RUN | Status chưa xác nhận | Đã có log thực thi, không giữ NOT RUN. Chưa có kết quả Admin kích hoạt/báo cáo xử lý đầy đủ và kiểm tra mail trong preview/hộp thư; chưa đủ đối chiếu toàn bộ Expected gửi/nhận và báo cáo. Không mở URL Ethereal hoặc gửi mail. |
| 44 ca / mọi lỗi cũ | v1 | Archive trong v2 | Không xóa ghi nhận trước; input và output v1 giữ nguyên byte. |

Không xóa lỗi hay quan sát cũ. Workbook v2 có v1 Results Archive / v1 Confirmed Archive / v1 Potential Archive / v1 UX Archive; toàn bộ file v1 giữ nguyên. BOOK-08 chỉ thay đánh giá QA; Actual cũ giữ nguyên. Bảy ca trước NOT RUN được cập nhật Actual từ ghi nhận/ảnh mới. Tất cả Scenario/Expected gốc nguyên văn được giữ. Agent không thực thi testcase.

## Đối chiếu các ca trọng tâm

| Test ID | Status chính thức | Ghi nhận / Kết luận QA | Evidence |
| --- | --- | --- | --- |
| AUTH-01 | PASS | Đề xuất PASS từ xác nhận bằng văn bản màu xanh, không phải lần thực thi mới; chưa có nhật ký kết quả riêng cho từng bước. Ghi chú vượt OTP cần xác minh yêu cầu 2FA; Expected AUTH-01 không có OTP. Không kết luận bảo mật đạt từ PASS này. | Nguồn ghi chú/đánh dấu DOCX; không có screenshot trực tiếp |
| MEM-02 | FAIL | Không đạt kỳ vọng tài khoản mới có thể đăng nhập. Sai email được ghi bằng văn bản của Tester; không suy diễn rằng email hợp lệ cũng thất bại. Thiếu dấu * là ghi chú UX riêng. | [MEM-02_rId14_image24.png](evidence/MEM-02_rId14_image24.png) |
| MEM-05 | FAIL | Sai lệch hạng đã được xác nhận so với kỳ vọng lưu đúng lựa chọn. Chỉ xác nhận nhánh hạng; ảnh dùng LECTURER, cần retest đúng PREMIUM và ADMIN trong kịch bản. Không khẳng định ADMIN cũng bị lưu USER. | [MEM-05_rId17_image12.png](evidence/MEM-05_rId17_image12.png) · [MEM-05_rId18_image16.png](evidence/MEM-05_rId18_image16.png) |
| INV-05 | PASS | Giữ PASS trong phạm vi Expected nguyên văn: Excel/PDF mở và số lượng khớp ảnh đối chiếu 166/3/2/164/1. Screenshot xác nhận tên tiếng Việt bị lỗi trong PDF kiểm kê. Tách POT-006 khỏi DEF-003 Dashboard; chưa biết chung nguyên nhân. Cần chốt tiêu chí bảo toàn tiếng Việt cho PDF kiểm kê; không đổi Expected INV-05 để ép FAIL. | [INV-05_rId23_image13.png](evidence/INV-05_rId23_image13.png) · [INV-05_rId24_image4.png](evidence/INV-05_rId24_image4.png) |
| DASH-02 | FAIL | FAIL vì Expected yêu cầu tiếng Việt không lỗi font. Chấp nhận ghi nhận trực tiếp của Tester; thiếu ảnh/file PDF Dashboard riêng. Source hiện tại không chứng minh bug đã được sửa. V2: DEF-003 chỉ áp dụng PDF Dashboard. Không dùng screenshot INV-05 làm evidence trực tiếp của DASH-02 và không gộp nguyên nhân hai luồng. | Nguồn ghi chú/đánh dấu DOCX; không có screenshot trực tiếp |
| BOOK-01 | Chưa xác nhận | Chưa xác định ô Header thuộc kịch bản BOOK-01 hay chức năng tìm kiếm riêng; cần kết quả tên/tác giả/thể loại/không tìm thấy trước khi chốt. | [BOOK-01_rId7_image23.png](evidence/BOOK-01_rId7_image23.png) |
| RES-02 | Chưa xác nhận | Không có nút đặt trước có thể là cơ chế từ chối hợp lệ; chưa xác nhận hành vi từ chối tạo yêu cầu. Không đủ căn cứ PASS/FAIL/BLOCKED. | Nguồn ghi chú/đánh dấu DOCX; không có screenshot trực tiếp |
| RES-04 | Chưa xác nhận | Thiếu ghi nhận tìm/lọc, đủ chuỗi WAITING → NOTIFIED → FULFILLED và thông báo khi NOTIFIED. Lịch sử mượn trả cần phối hợp thành viên phụ trách; không kết luận thay họ. | [RES-04_rId11_image3.png](evidence/RES-04_rId11_image3.png) |
| DASH-01 | Chưa xác nhận | Chưa có xác nhận đầy đủ sách nổi bật/hoạt động gần đây/không lỗi tải. Cần thống nhất định nghĩa KPI và ảnh cùng thời điểm; không suy ra mọi chỉ số đều sai. | [DASH-01_rId25_image7.png](evidence/DASH-01_rId25_image7.png) · [DASH-01_rId26_image5.png](evidence/DASH-01_rId26_image5.png) |
| BOOK-08 | Chưa xác nhận | V2 điều chỉnh PASS của v1 thành trạng thái chưa xác nhận. Checklist xanh xác nhận mở e-book, nhưng câu "Thử file định dạng khác và ghi nhận thông báo lỗi" là hướng dẫn, chưa ghi kết quả file bị từ chối/không được lưu. Expected gốc yêu cầu cả nhánh từ chối file không hỗ trợ. Cần kết quả thực tế và file/screenshot cho hai nhánh; không tự điền thông báo lỗi. | Nguồn ghi chú/đánh dấu DOCX; không có screenshot trực tiếp |

AUTH-01 PASS chỉ cho đăng nhập đúng/sai theo Expected gốc; POT-001 về OTP chưa được xác minh, không kết luận 2FA an toàn. MEM-05 FAIL trên biến thể LECTURER có cặp ảnh; chưa xác nhận nhánh ADMIN/PREMIUM. Không thay Scenario gốc để khớp biến thể.

INV-05 PASS vì file mở/số lượng khớp đúng Expected nguyên văn; lỗi chữ PDF quan sát được nhưng tiêu chí Unicode kiểm kê cần xác nhận. Theo dõi POT-006 độc lập, không gộp với PDF Dashboard. DASH-02 FAIL từ ghi chú Tester trái Expected không lỗi font; thiếu PDF Dashboard riêng, không dùng ảnh kiểm kê thay thế.

## Defect triage

### Confirmed Defect — OPEN, chưa có Fix/Retest

| Defect ID | Test ID | Summary | Severity / Priority | Mức evidence |
| --- | --- | --- | --- | --- |
| DEF-001 | MEM-02 | Tạo thành viên bằng email sai định dạng nhưng không đăng nhập được | Medium (đề xuất) / P2 (đề xuất) | Ghi nhận trực tiếp bằng văn bản của Tester; thiếu screenshot kết quả lỗi |
| DEF-002 | MEM-05 | Hạng thành viên lưu STANDARD khác lựa chọn trên form | Medium (đề xuất) / P2 (đề xuất) | Cặp screenshot trước/sau cùng email + ghi chú Tester |
| DEF-003 | DASH-02 | PDF Dashboard hiển thị lỗi font tiếng Việt | Medium (đề xuất) / P2 (đề xuất) | Ghi nhận trực tiếp bằng văn bản của Tester; thiếu screenshot kết quả lỗi |

Đây là xác nhận từ ghi nhận Tester trước, không phải agent tái hiện lại. Severity/Priority giữ mức đề xuất và cần nhóm chốt theo tác động. DEF-001/003 cần bổ sung ảnh/log/file đúng lỗi; DEF-002 có cặp ảnh cùng email. Draft Issue chỉ gồm ba defect này, không có issue được gửi lên GitHub.

### Potential Defect — chưa chốt yêu cầu hoặc tái hiện

| ID | Test ID | Summary | Cần xác minh |
| --- | --- | --- | --- |
| POT-001 | AUTH-01 | Có thể bỏ qua OTP khi đăng nhập | Xác nhận loại popup, tài khoản/cấu hình 2FA, phiên bản test; tái hiện đúng luồng và lưu video/network. Expected AUTH-01 không quy định OTP. |
| POT-002 | BOOK-01 | Tìm kiếm Header không có tác dụng | Thống nhất phạm vi yêu cầu Header; test riêng từng ô và từng điều kiện; chốt trạng thái BOOK-01 sau đối chiếu. |
| POT-003 | RES-04 | Sau nhận sách đặt trước không cập nhật lịch sử mượn trả | Phối hợp thành viên mượn/trả xác nhận nghiệp vụ FULFILLED có tạo Loan không; ghi ID reservation/book/loan; bổ sung luồng NOTIFIED và thông báo. |
| POT-004 | DASH-01 | Định nghĩa/số lượng độc giả hoạt động không nhất quán | Thống nhất active = chưa blacklist hay đang có khoản mượn; đối soát cùng thời điểm. Tổng đầu sách/đang mượn là việc cần kiểm tra, chưa xác nhận sai. |
| POT-005 | MEM-05 | Nhánh ADMIN có thể bị lưu USER | Thực thi nhánh ADMIN với tài khoản thử và kiểm tra dữ liệu lưu/đăng nhập đúng vai trò; source chỉ là dấu hiệu kiểm tra. |
| POT-006 | INV-05 | Tên sách tiếng Việt bị lỗi trong PDF kiểm kê; cần chốt tiêu chí chất lượng | Ảnh xác nhận mất dấu/ký tự ở tên sách, nhưng Expected INV-05 chỉ yêu cầu mở file/số lượng khớp. Chốt yêu cầu PDF kiểm kê bảo toàn chữ tiếng Việt (không tự áp dụng đặc tả Dashboard B257). Sau chốt, tạo defect riêng hoặc xác nhận thay đổi phạm vi; không tự đổi Expected và không gộp với DEF-003. |

### UX Improvement

| ID | Test ID | Đề nghị / ghi nhận |
| --- | --- | --- |
| IMP-001 | AUTH-03 | Chữ trắng chìm vào nền trang đăng nhập |
| IMP-002 | BOOK-04 | Đơn giản hóa form thêm sách/tự điền NXB |
| IMP-003 | MEM-02 | Thiếu dấu * cho trường bắt buộc |
| IMP-004 | MEM-04 | Thiếu mục liên hệ Admin khi bị chặn |
| IMP-005 | INV-04 | Khó đọc kết quả kiểm kê ở chế độ tối |

IMP-006 v1 giữ Archive và được phân tích độc lập tại POT-006. Các đề nghị tự điền NXB/năm từ ISBN chưa được kiểm chứng khả thi; không tự đổi business rules.

### Requirement Clarification

| ID | Test ID | Câu hỏi | Xác nhận cần có |
| --- | --- | --- | --- |
| REQ-001 | AUTH-01 | OTP/2FA có bắt buộc trong luồng đăng nhập đang test? | AUTH-01 không quy định OTP. Xác nhận cấu hình, loại popup và luồng. PASS đăng nhập cơ bản không chứng minh OTP an toàn. |
| REQ-002 | BOOK-01 | Ô Header có thuộc phạm vi tìm/lọc của BOOK-01? | Phân biệt Header search với ô danh mục; ghi kết quả theo tên/tác giả/thể loại/không tìm thấy. Không tự đổi Expected. |
| REQ-003 | RES-02 | Ẩn nút đặt trước khi còn bản có đáp ứng từ chối tạo yêu cầu? | Expected là không tạo yêu cầu; vắng nút có thể là hành vi đúng. Cần dữ liệu AVAILABLE và xác nhận trước/sau. |
| REQ-004 | RES-04 | FULFILLED có tự tạo Loan hay cần thao tác mượn/nhận riêng? | Expected RES-04 chỉ yêu cầu trạng thái/thông báo. Chốt nghiệp vụ nối sang Loan; không kết luận phần mượn/trả của thành viên khác. |
| REQ-005 | DASH-01 | Định nghĩa độc giả hoạt động và tập dữ liệu KPI? | Phân biệt đang mượn, chưa blacklist và các role; đối chiếu cùng snapshot/thời điểm. Chưa khẳng định tổng đầu sách/đang mượn sai. |
| REQ-006 | INV-05 | Tiêu chí bảo toàn tiếng Việt có áp dụng PDF kiểm kê? | Ảnh PDF có lỗi tên tiếng Việt; mở/số lượng vẫn đạt Expected INV-05. Đặc tả Unicode Dashboard không tự trở thành Expected kiểm kê. |
| REQ-007 | BOOK-03 | Gợi ý bắt buộc cá nhân hóa hay cho phép cùng danh sách thịnh hành? | Ghi chú mới nói hai tài khoản có/không lịch sử nhận gợi ý giống nhau. Expected không yêu cầu danh sách phải khác; cần chốt yêu cầu và ghi kết quả mở đúng chi tiết. |

## Evidence: đủ, thiếu và giới hạn

- Đủ đối chiếu Expected tại mức ghi nhận chức năng hẹp: **INV-04, INV-05, PAY-01**. Chưa đầy đủ metadata/file kết quả gốc hoặc DB/API snapshot.
- Có screenshot một phần: **AUTH-03, BOOK-01, BOOK-03, BOOK-04, RES-01, RES-03, RES-04, RES-05, MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, INV-01, INV-02, INV-03, DASH-01, NOTI-01, NOTI-02, SET-01, SET-02, PAY-02, MAIL-01**. Screenshot tồn tại không chứng minh toàn bộ nhánh/hành động.
- Không có screenshot/log/file trực tiếp nhưng có ghi nhận hoặc đang chờ review: **AUTH-01, AUTH-02, AUTH-04, AUTH-05, AUTH-06, BOOK-02, BOOK-05, BOOK-06, BOOK-07, BOOK-08, BOOK-09, BOOK-10, EXCEL-01, EXCEL-02, EXCEL-03, EXCEL-04, RES-02, DASH-02**.
- Không còn NOT RUN trong manual cập nhật. AUTH-06, BOOK-03 và MAIL-01 đã có ghi nhận mới nhưng chưa đủ đối chiếu toàn bộ Expected, nên Status trống.
- Cả **44/44** ca thiếu ngày test/commit/môi trường đầy đủ; nếu xét hồ sơ evidence hoàn chỉnh gồm metadata thì chưa có ca nào đủ.

Các nhóm trên tách theo nội dung screenshot; Evidence Gaps ghi chi tiết đủ 44 ca. Evidence Manifest gồm 32 ảnh, relationship/part DOCX hiện tại, SHA256, quan sát và giới hạn. 24 tên tệp evidence v1 giữ nguyên dù relationship của DOCX mới đổi; mapping được kiểm chứng bằng Test ID/hash, không đoán theo tên. Source Runs giữ màu/italic/raw XML; ghi chú trong Test Results giữ italic từng đoạn. Không dùng docs/local-preview hoặc dữ liệu Loan chuẩn bị làm evidence; chỉ screenshot PAY thực tế trong manual mới được dùng.

## Retest và công việc còn lại

1. Xác nhận quản lý tên phiên bản tài liệu: file yêu cầu Manual_Test_Notes_Final.docx chưa có, nội dung mới nằm ở Kiểm thử phần mềm.docx. Đã xử lý đủ 44 ca của nguồn có sẵn; nếu có bản Final khác, đối chiếu tiếp và giữ lịch sử baseline này.
2. Retest sau khi có bản sửa Dev: MEM-02/DEF-001, MEM-05/DEF-002, DASH-02/DEF-003. Ghi commit sửa, dữ liệu, môi trường và ảnh/file kết quả. Chưa có bản sửa để tự đánh dấu Fixed.
3. Chạy bổ sung/xác nhận các ca Status trống: AUTH-03, AUTH-06, BOOK-01, BOOK-03, BOOK-04, BOOK-08, RES-02, RES-04, MEM-04, DASH-01, MAIL-01. BOOK-08 cần cả file hợp lệ và nhánh từ chối file không hỗ trợ; BOOK-04 cần đúng 2 barcode; MEM-04 cần cả đưa vào/gỡ blacklist; AUTH-06 cần đăng nhập bằng mật khẩu mới.
4. MAIL-01 cần báo cáo xử lý và mở preview/hộp thư nhận để đối soát; log Ethereal hiện có chưa xác nhận đủ Expected. BOOK-03 cần kết quả mở chi tiết, dữ liệu lịch sử và yêu cầu cá nhân hóa. Không tự gán FAIL từ ghi chú cam hoặc NOT RUN khi đã có ghi nhận.
5. Xác minh POT-001…006 và REQ-001…007. Theo dõi PDF Dashboard và kiểm kê bằng file riêng. Đối soát Dashboard với snapshot cùng thời điểm; phối hợp nghiệp vụ đặt trước → Loan với người phụ trách.
6. Với PAY-02, Scenario gốc dùng “phiếu thử khác”; ghi Loan ID thực tế và xác nhận biến thể nếu dùng lại phiếu sau PAY-01. Chuẩn bị dữ liệu không phải kết quả thực thi; không sửa Scenario/Expected để khớp dữ liệu.

Regression đề xuất, chưa được chạy: AUTH-02/MEM-01/02/03/05 khi sửa thành viên; INV-04/05 và DASH-01/02 khi sửa PDF; BOOK-01/02 khi sửa tìm kiếm; RES-01/03/04/05 và NOTI-01/02 khi sửa đặt trước. Phần mượn/trả của người khác chỉ phối hợp, không ghi kết quả thay họ.

## Kỹ thuật thiết kế có căn cứ

Design Techniques ánh xạ đủ 44 ca với căn cứ Scenario/Expected: phân lớp đầu vào hợp lệ/không hợp lệ; chuyển trạng thái/chuỗi sự kiện; quyền theo role; kịch bản chức năng/đối chiếu đầu ra. Đây là nhận diện thiết kế, không chứng minh mọi lớp/transition đã chạy. Không khẳng định BVA hoặc bảng quyết định chính thức khi không có bộ giá trị biên/bảng trong tài liệu. BOOK-06 gộp ISBN khi thêm và EXCEL-03 bỏ dòng trùng khi import giữ quy tắc riêng.

## Báo cáo và phạm vi

Manual_Test_Updated_v2.docx là bản sao báo cáo đã cập nhật; chỉ sửa vùng kết quả 44 ca và tổng hợp trong Chương 3, bổ sung thiết kế/defects/giới hạn. Scenario, Expected và phần các thành viên khác giữ nguyên; mọi ZIP part ngoài document.xml giữ byte. Đây là baseline có giới hạn của Tester hiện tại từ manual cập nhật, không phải kết quả cuối toàn nhóm. Mục lục giữ nguyên; số trang cache cần cập nhật khi chốt toàn báo cáo.

Năm output: Manual_Test_Results_v2.xlsx; Defect_Log_v2.xlsx; Manual_Test_Gap_Analysis_v2.md; Manual_Test_Updated_v2.docx; GitHub_Issues_Draft.md. Không sửa ứng dụng/database, không chạy seed/migration/testcase, không commit/push/tạo Issue.
