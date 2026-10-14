# White-box Test Matrix — thiết kế dự kiến

Ngày: 2026-10-11. **160 ID thiết kế, chưa triển khai/chưa chạy; không có PASS/FAIL hoặc coverage thực đo.** Nguồn, branch inventory và CFG: [Test Plan](Whitebox_Test_Plan.md). Hàm/callback và path ghi trong Plan là source hiện có; đường dẫn test/config trong Implementation Plan là đề xuất tương lai.

## 1. Quy ước và setup chung

- **B**: Expected từ baseline manual, tinh chỉnh assertion kỹ thuật phục vụ cùng hành vi; không đổi Expected gốc. Regression không sửa assertion để hợp thức hóa defect.
- **S**: hợp đồng/thuật toán quan sát từ source, dùng để kiểm tra điều phối/guard/DTO. Đây là oracle kỹ thuật, không xác nhận nghiệp vụ chưa rõ. Các đặc trưng đáng ngờ đã chuyển sang R.
- **R**: oracle nghiệp vụ hoặc xử lý lỗi cần chốt; chỉ là testcase thiết kế pending. Mô tả “theo code” là dự đoán khi đọc source, không Actual Result. Không assert hành vi đáng ngờ là PASS.
- T/F là kết quả Boolean; NE là toán hạng không được đánh giá vì short-circuit. Ghi tên branch theo Plan, không tự coi nhãn này là coverage counter.
- Controller mặc định req.body={}, req.params={}, headers={}; các ca CP/ME/TB dùng actor userId=1; book/import actor ADMIN trừ khi ghi khác. Response stub hỗ trợ status/json/sendStatus trả lại cùng đối tượng, default HTTP=200; next là spy.
- Các giá trị book hợp lệ không viết ra DB: title=Book A, author=Author A, isbn=9781234567890, category=Category A; copies=1. Mỗi testcase chỉ ghi phần input override. Prisma, JWT, mail, notification và fs được mock trước import; findUnique/findFirst/user.update/transaction trả kết quả đặt trước đúng kịch bản.
- OTP stored mặc định string 123456, password mới abcdef, email user@example.com, user tồn tại trừ khi ghi khác. Đồng hồ cố định T bằng fake clock. Mock error/return value là precondition unit test, không phải bằng chứng tester đã chạy ứng dụng.
- Component dùng QueryClient riêng retry=false, useLanguage/useAuth/provider mock phù hợp; client HTTP được stub toàn bộ trước import; tương tác qua DOM vì handler/filter không export. Fixture MF: hai member khác name/email, một blacklist; fixture BS: hai book khác title/author/category.
- Các ca CP-11 và RP-16 dùng bcrypt library thật cùng record lưu trong RAM được update mock cập nhật; không dùng compare=true cho cả password đúng/sai rồi tuyên bố xác minh login.
- Mỗi ID tính một thiết kế. Dữ liệu viết dạng “hoặc”, danh sách, hay nhiều row có thể tham số hóa khi triển khai; số lượt test runner cuối cùng cần báo từ log thật, không mặc định bằng 160.

## 2. Thống kê thiết kế

| Module | Số ID dự kiến |
| --- | --- |
| Authentication | 52 |
| Member Management | 30 |
| Book Management | 48 |
| Excel Import | 30 |
| Tổng | 160 |


| Oracle | Số ID | Trạng thái thiết kế |
| --- | --- | --- |
| B | 44 | Có căn cứ Expected baseline |
| S | 98 | Có căn cứ source; giới hạn ở oracle kỹ thuật |
| R | 18 | Cần xác nhận, chưa có assertion chức năng cuối |


## 3. Authentication

| Test ID | Module | Function | Input / precondition mock | Expected Output / side effect | Branch/Condition | Lý do dữ liệu | Oracle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WB-AT-01 | Authentication | authenticateToken | authorization undefined | 401; verify/next không gọi | AT.1 F; AT.2 T | Thiếu header | S |
| WB-AT-02 | Authentication | authenticateToken | authorization=Bearer (không token) | 401; next không gọi | AT.1 T; AT.2 T | Header có nhưng split thiếu token | S |
| WB-AT-03 | Authentication | authenticateToken | Bearer x; verify callback error | 403; next không gọi | AT.2 F; AT.3 T | Token sai/hết hạn | S |
| WB-AT-04 | Authentication | authenticateToken | Bearer x; verify(null, jwtUser) | req.user=jwtUser; next một lần | AT.3 F | Đường xác thực thành công | S |
| WB-AA-01 | Authentication | authorizeAdmin | req.user undefined | 403 Forbidden; next không gọi | AA.1 T; optional chaining thiếu | Anonymous | S |
| WB-AA-02 | Authentication | authorizeAdmin | role=USER | 403 Forbidden; next không gọi | AA.1 T | Quyền không đủ | S |
| WB-AA-03 | Authentication | authorizeAdmin | role=ADMIN | next một lần | AA.1 F | Đủ quyền | S |
| WB-OA-01 | Authentication | optionalAuthenticateToken | authorization undefined | next một lần; không verify | OA.1 F; OA.2 T | Anonymous được cho phép | S |
| WB-OA-02 | Authentication | optionalAuthenticateToken | Bearer x; verify(error, undefined) | next; req.user vẫn undefined | OA.2 F; OA.3 F | Token lỗi ở middleware optional | S |
| WB-OA-03 | Authentication | optionalAuthenticateToken | Bearer x; verify(null, jwtUser) | gán user; next một lần | OA.3 T | User dùng recommendations | S |
| WB-LG-01 | Authentication | login | email hợp lệ; findUnique=null | 401 Invalid credentials; không compare/sign | LG.1: T/NE | OR short-circuit | S |
| WB-LG-02 | Authentication | login | user có; compare=false | 401; không sign | LG.1: F/T | Password sai | S |
| WB-LG-03 | Authentication | login | user USER; compare=true | 200 token; JWT claims id/email/role, expiresIn=1h; DTO đúng tier, không password | LG.1: F/F | Login hợp lệ | B |
| WB-LG-04 | Authentication | login | user ADMIN; compare=true | 200 token; claims.role=ADMIN, response.role=ADMIN | LG.1 F | Vai trò trong token | B |
| WB-ME-01 | Authentication | getMe | req.user undefined | 401; không lookup | ME.1 T | Guard trước DB | S |
| WB-ME-02 | Authentication | getMe | jwtUser có; findUnique=null | 404 | ME.1 F; ME.2 T | Tài khoản không còn tồn tại | S |
| WB-ME-03 | Authentication | getMe | jwtUser có; findUnique=userDto | 200 userDto; select không password/OTP | ME.2 F | Thông tin cá nhân an toàn | S |
| WB-CP-01 | Authentication | changePassword | req.user undefined | 401; không hash/update | CP.1 T | Chưa xác thực | S |
| WB-CP-02 | Authentication | changePassword | currentPassword empty; newPassword=abcdef | 400; không DB | CP.2: T/NE | Toán hạng current thiếu | S |
| WB-CP-03 | Authentication | changePassword | currentPassword=oldpass; newPassword empty | 400; không DB | CP.2: F/T | Toán hạng new thiếu | S |
| WB-CP-04 | Authentication | changePassword | newPassword=abcde; current hợp lệ | 400; không lookup | CP.2 F/F; CP.3 T | Biên dưới 6 | S |
| WB-CP-05 | Authentication | changePassword | newPassword=abcdef; findUnique=null | 404 | CP.3 F; CP.4 T | Người dùng thiếu | S |
| WB-CP-06 | Authentication | changePassword | newPassword=abcdef; compare=false | 400; không hash/update | CP.4 F; CP.5 T | Mật khẩu cũ sai | B |
| WB-CP-07 | Authentication | changePassword | currentPassword=newPassword=oldpass; compare=true | 400; không hash/update | CP.5 F; CP.6 T | Cấm dùng lại mật khẩu hiện tại | S |
| WB-CP-08 | Authentication | changePassword | current=oldpass; new=abcdef; compare=true; dependencies resolve | 200; hash(new,10), update đúng userId; notification một lần | CP.3 F tại 6; CP.6 F; CP.E success | Biên hợp lệ tối thiểu | B |
| WB-CP-09 | Authentication | changePassword | newPassword=abcdefg; update reject | 500; không notification | CP.3 F tại 7; CP.E catch | Biên trên và lỗi lưu | S |
| WB-CP-10 | Authentication | changePassword | update resolve; notification mock reject | 500; update đã được gọi, không tự rollback | CP.E catch sau update | Phân biệt lỗi hậu xử lý với lưu mật khẩu | S |
| WB-CP-11 | Authentication | changePassword | Controller đổi mật khẩu + login; bcrypt thật, user record RAM do mock update giữ | Login mới thành công; cũ 401; không DB thật | CP.6 F → LG.1 F/F và F/T | Nối Expected AUTH-05, tránh compare luôn true | B |
| WB-FP-01 | Authentication | forgotPassword | email empty | 400; không lookup | FP.1: T/NE | Email thiếu | S |
| WB-FP-02 | Authentication | forgotPassword | email=123 | 400; không lookup | FP.1: F/T | Sai kiểu | S |
| WB-FP-03 | Authentication | forgotPassword | email=space+USER@EXAMPLE.COM+space; user=null | lookup user@example.com; 404 | FP.1 F/F; FP.2 T | Chuẩn hóa email trước lookup | S |
| WB-FP-04 | Authentication | forgotPassword | email hợp lệ; random=0; clock=T; previewUrl=URL mock | 200; OTP=100000; expiry=T+900000; mail(to,otp,15); trả previewUrl | FP.2 F; FP.3 T | Đáy miền OTP, hạn 15 phút | S |
| WB-FP-05 | Authentication | forgotPassword | random=0.999999; clock=T; previewUrl empty | 200; OTP=999999; previewUrl undefined | FP.3 F | Đỉnh miền OTP, mail không preview | S |
| WB-FP-06 | Authentication | forgotPassword | user có; user.update reject | 500; mail không gọi | FP.E catch | Không gửi mã chưa lưu | S |
| WB-FP-07 | Authentication | forgotPassword | user.update resolve; mail reject | 500; OTP update đã gọi | FP.E catch sau update | Lỗi dịch vụ email, không SMTP thật | S |
| WB-FP-08 | Authentication | forgotPassword | email chỉ whitespace; lookup(null) | lookup email empty, 404 theo code; cần chốt có phải 400 validation không | FP.1 F/F; FP.2 T | Khoảng trắng lọt guard | R |
| WB-RP-01 | Authentication | resetPassword | email empty; otp/new đủ | 400; không lookup/hash/update | RP.1: T/NE/NE | Toán hạng 1 | S |
| WB-RP-02 | Authentication | resetPassword | email đủ; otp empty; new đủ | 400; không lookup | RP.1: F/T/NE | Toán hạng 2 | S |
| WB-RP-03 | Authentication | resetPassword | email/otp đủ; newPassword empty | 400; không lookup | RP.1: F/F/T | Toán hạng 3 | S |
| WB-RP-04 | Authentication | resetPassword | newPassword=123456 (number) | 400; không lookup | RP.1 F/F/F; RP.2 T/NE | Sai kiểu, không đọc length | S |
| WB-RP-05 | Authentication | resetPassword | newPassword=abcde | 400; không lookup | RP.2 F/T | Password 5 | S |
| WB-RP-06 | Authentication | resetPassword | newPassword=abcdef; user=null | 404 | RP.2 F/F; RP.3 T | Password 6 rồi thiếu user | S |
| WB-RP-07 | Authentication | resetPassword | user.resetOtp=null | 400 OTP incorrect; không hash/update | RP.4: T/NE | Mã chưa có hoặc đã dùng | S |
| WB-RP-08 | Authentication | resetPassword | resetOtp=123456; input otp=999999 | 400; không hash/update | RP.4: F/T | Mã sai | B |
| WB-RP-09 | Authentication | resetPassword | OTP khớp; resetOtpExpiry=null | 400 expired; không hash/update | RP.4 F/F; RP.5 T/NE | Thiếu thời hạn | S |
| WB-RP-10 | Authentication | resetPassword | OTP khớp; expiry=T−1ms | 400 expired; không hash/update | RP.5: F/T | Vừa hết hạn | S |
| WB-RP-11 | Authentication | resetPassword | OTP khớp; expiry=T | Theo code cho đổi: 200, update password và OTP/expiry=null; biên cần xác nhận | RP.5 F/F, toán tử < | Đúng thời điểm hết hạn | R |
| WB-RP-12 | Authentication | resetPassword | email HOA có space; otp=space+123456+space; expiry=T+1ms; new=abcdef | 200; lookup lower/trim; hash(new,10); update password, xóa OTP+expiry; notification | RP.2 F/F; RP.4 F/F; RP.5 F/F | Còn hạn tối thiểu, trim OTP | B |
| WB-RP-13 | Authentication | resetPassword | otp=123456 (number), stored=123456 string; expiry>T; update reject | 500; không notification | RP.4 F/F; RP.E catch | String(otp) và lỗi lưu | S |
| WB-RP-14 | Authentication | resetPassword | email=42 truthy; otp/new đủ | Theo code catch 500 do trim; cần chốt validation 400 | RP.1 F/F/F; RP.E catch | Email sai kiểu khác password | R |
| WB-RP-15 | Authentication | resetPassword | Reset thành công rồi gọi lại; mock record RAM OTP=null | Lần 2 bị 400; không update lần 2 | RP.4 T/NE sau success | Xóa OTP chống dùng lại đơn luồng | S |
| WB-RP-16 | Authentication | resetPassword | Reset + login; bcrypt thật, user record RAM | Login mật khẩu mới thành công, cũ 401 | RP success → LG.1 | Bù nhánh login còn thiếu ở AUTH-06 | B |

## 4. Member Management

| Test ID | Module | Function | Input / precondition mock | Expected Output / side effect | Branch/Condition | Lý do dữ liệu | Oracle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WB-RG-01 | Member Management | register | email valid, name, password; hash=HASH; create resolve | 201; create nhận email/name/HASH/role USER; không plaintext | RG.1 success | Public đăng ký cơ bản | B |
| WB-RG-02 | Member Management | register | Email đã có; create reject P2002 | 400 User already exists | RG.1 catch | Không tạo trùng | B |
| WB-RG-03 | Member Management | register | bcrypt.hash reject trước create | Promise reject; create không gọi; không giả định HTTP 400 | RG.0 exception ngoài try | Ranh giới try/catch | S |
| WB-RG-04 | Member Management | register | req.user mock ADMIN; form tier=LECTURER | Luồng thêm có quyền phải lưu LECTURER, không rơi STANDARD; assert create data | RG.GAP tier bỏ qua | Regression DEF-002; dự kiến phát hiện sai khi chạy | B |
| WB-RG-05 | Member Management | register | req.user mock ADMIN; form tier=PREMIUM | Luồng thêm có quyền phải lưu PREMIUM; assert create data | RG.GAP tier bỏ qua | Nhánh gốc MEM-05 chưa được manual xác nhận | B |
| WB-RG-06 | Member Management | register | Email=no-at-sign | Không cho tài khoản không sử dụng được; cách từ chối/HTTP/message cần chốt trước assertion | RG.GAP validation thiếu | DEF-001 không đủ chi tiết để bịa lỗi login | R |
| WB-RG-07 | Member Management | register | Form ADMIN; actor ADMIN và public anonymous xét riêng | Luồng có quyền phải lưu role chọn theo MEM-05; anonymous không được nâng quyền. Chốt endpoint/auth contract trước viết | RG.GAP role USER; route public | POT-005, tránh sửa bằng tin role từ client | R |
| WB-GU-01 | Member Management | getAllUsers | findMany returns [] | 200 []; query select DTO, orderBy id asc | GU.1 thẳng | Danh sách rỗng | S |
| WB-GU-02 | Member Management | getAllUsers | findMany returns 2 DTO khác role/tier/blacklist | 200 đúng DTO; select không password/resetOtp/resetOtpExpiry | GU.1 thẳng | Hiển thị member và dữ liệu riêng tư | S |
| WB-TB-01 | Member Management | toggleBlacklist | targetUser=null | 404; không update | TB.1 T | Không có member | S |
| WB-TB-02 | Member Management | toggleBlacklist | target.id=actor.userId | 400; không update | TB.1 F; TB.2 T | Không tự blacklist | S |
| WB-TB-03 | Member Management | toggleBlacklist | target khác actor; old=false; body=true | 200; update true, message chặn | TB.2 F; TB.3 boolean; TB.4 T | Chặn explicit | B |
| WB-TB-04 | Member Management | toggleBlacklist | old=true; body=false | 200; update false, message gỡ | TB.3 boolean; TB.4 F | Gỡ explicit | B |
| WB-TB-05 | Member Management | toggleBlacklist | old=false; body undefined | 200; update true | TB.3 nonboolean; !old T | Toggle từ active | S |
| WB-TB-06 | Member Management | toggleBlacklist | old=true; body undefined | 200; update false | TB.3 nonboolean; !old F | Toggle từ blacklist | S |
| WB-TB-07 | Member Management | toggleBlacklist | old=false; body chuỗi false | Code đảo thành true; chưa chốt reject sai kiểu hoặc fallback toggle | TB.3 nonboolean | Sai kiểu có thể bị hiểu ngược | R |
| WB-TB-08 | Member Management | toggleBlacklist | target hợp lệ; update reject | 500 | TB.E catch | Lỗi dependency | S |
| WB-MA-01 | Member Management | MembersManagement.handleAddMember | name empty; email valid; click Lưu | Không post | MA.1 T/NE | Guard tên | S |
| WB-MA-02 | Member Management | MembersManagement.handleAddMember | name đủ; email empty; click Lưu | Không post | MA.1 F/T | Guard email | S |
| WB-MA-03 | Member Management | MembersManagement.handleAddMember | name/email đủ; role USER, tier LECTURER; post resolve | Gửi đúng tier/role/password mặc định; modal đóng, query users invalidated | MA.1 F/F; addUserMutation.onSuccess | Form thực sự gửi lựa chọn | B |
| WB-MA-04 | Member Management | MembersManagement.handleAddMember | Input email thiếu @; click Lưu | Cần chốt không gửi/hiện lỗi theo chính sách email; không lấy việc POST được làm oracle đạt | MA.GAP type=email + onClick | Đối chiếu DEF-001; chưa có validation contract | R |
| WB-MF-01 | Member Management | MembersManagement — callback của members.filter (filteredMembers) | Query HOA trùng name; filter ALL | Member khớp tên xuất hiện; KPI theo toàn members | MF.1 T/NE; MF.2 ALL | Case insensitive tên | B |
| WB-MF-02 | Member Management | MembersManagement — callback của members.filter (filteredMembers) | Query chỉ trùng email; filter ALL | Member khớp email xuất hiện | MF.1 F/T | Toán hạng email OR | B |
| WB-MF-03 | Member Management | MembersManagement — callback của members.filter (filteredMembers) | Query không trùng name/email | Không thẻ member, thông báo rỗng | MF.1 F/F; MF.3 F/NE | Không match | B |
| WB-MF-04 | Member Management | MembersManagement — callback của members.filter (filteredMembers) | Query empty; filter ACTIVE; old false/true | Chỉ member chưa blacklist; activeCount đúng | MF.2 ALL F; ACTIVE T và !blacklist T/F | Lọc active | B |
| WB-MF-05 | Member Management | MembersManagement — callback của members.filter (filteredMembers) | Query empty; filter BLACKLISTED; old false/true | Chỉ member blacklist; blacklistedCount đúng | MF.2 ACTIVE F; BLACKLISTED T và blacklist T/F | Lọc blacklist | B |
| WB-MF-06 | Member Management | MembersManagement — callback của members.filter (filteredMembers) | Query chỉ match member blacklist; filter ACTIVE | Không thẻ; KPI toàn danh sách không đổi | MF.3 T/F | Search đúng nhưng status sai | B |
| WB-MT-01 | Member Management | MembersManagement.handleToggleBlacklist | Member active; confirm=false | Không PATCH | MT.1 chặn; MT.2 F | Cancel không đổi dữ liệu | S |
| WB-MT-02 | Member Management | MembersManagement.handleToggleBlacklist | Member active; confirm=true | PATCH id, isBlacklisted=true | MT.1 chặn; MT.2 T | Confirm chặn | B |
| WB-MT-03 | Member Management | MembersManagement.handleToggleBlacklist | Member blacklist; confirm=true | PATCH id, isBlacklisted=false | MT.1 gỡ; MT.2 T | Confirm gỡ | B |

## 5. Book Management

| Test ID | Module | Function | Input / precondition mock | Expected Output / side effect | Branch/Condition | Lý do dữ liệu | Oracle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WB-GB-01 | Book Management | getBooks | findMany returns [] | 200 [] | GB.1; map 0 vòng | Danh mục rỗng | S |
| WB-GB-02 | Book Management | getBooks | findMany reject | 500 Không thể tải danh sách sách | GB.E catch | Lỗi đọc DB | S |
| WB-BF-01 | Book Management | formatBookResponse (private) | getBooks mock record items undefined; relations null; ebook empty | copies=0,available=0,status=Borrowed; relation names empty,ebookUrl=null | BF.1 fallback; BF.2 fallback; BF.3 F | Dữ liệu thiếu relations, không export helper | S |
| WB-BF-02 | Book Management | formatBookResponse (private) | getBooks record items=[available,BORROWED,LOST], names+ebook có | copies=3,available=1,status=Available; map giữ barcode/location/id/status | BF.1 filter T/F; BF.2 value; BF.3 T | Case normalize status, nhiều trạng thái | B |
| WB-BF-03 | Book Management | formatBookResponse (private) | getBooks record items=[BORROWED,LOST], ebook null | copies=2,available=0,status=Borrowed | BF.1 filter F; BF.3 F | 0 khả dụng với copies>0 | S |
| WB-CB-01 | Book Management | createBook | req.user USER hoặc undefined | 403; không upsert/transaction | CB.1 T | Cấm thêm ngoài ADMIN | S |
| WB-CB-02 | Book Management | createBook | title empty; fields còn lại đủ | 400; không DB | CB.2 T/NE/NE/NE | Required title | B |
| WB-CB-03 | Book Management | createBook | author empty; fields còn lại đủ | 400; không DB | CB.2 F/T/NE/NE | Required author | B |
| WB-CB-04 | Book Management | createBook | isbn empty; fields còn lại đủ | 400; không DB | CB.2 F/F/T/NE | Required ISBN | B |
| WB-CB-05 | Book Management | createBook | category empty; fields còn lại đủ | 400; không DB | CB.2 F/F/F/T | Required category | B |
| WB-CB-06 | Book Management | createBook | copies=-1; required đủ | 400 copies>=1; không DB | CB.4 T | Số lượng âm | S |
| WB-CB-07 | Book Management | createBook | copies=1; available=-1 | 400 available>=0; không DB | CB.4 F; CB.5 T | Khả dụng âm | S |
| WB-CB-08 | Book Management | createBook | copies=1; available=2 | 400 available>copies; không DB | CB.5 F; CB.6 T | Vượt số bản | S |
| WB-CB-09 | Book Management | createBook | copies=2; available undefined; existingBook=null; optional thiếu | 201 isMerged=false; tx.book.create một lần, 2 item AVAILABLE barcode khác nhau; defaults/null đúng | CB.2 all F; CB.3 default; CB.7 publisher F; CB.8 new; CB.10 for 2 | BOOK-04: đầu sách mới + 2 bản | B |
| WB-CB-10 | Book Management | createBook | copies=1; available=1; optional publisher/year/page/language/description/cover/ebook có | 201; trim inputs, publisher upsert, optional đúng; item AVAILABLE | CB.3 explicit; CB.6 F tại bằng; CB.7/11 truthy | Biên bằng copies, optional fields | S |
| WB-CB-11 | Book Management | createBook | ISBN trùng; existingBook có 2 items; copies=2; no barcode collision | 200 isMerged=true; không tx.book.create; thêm 2 item từ counter 3 | CB.8 merge; CB.10 while F | BOOK-06 cộng bản sao | B |
| WB-CB-12 | Book Management | createBook | New book; barcode lookup collision một lần rồi null | 201; barcode thứ hai được dùng, không trùng | CB.10 new while T→F | Nhánh tránh trùng barcode | S |
| WB-CB-13 | Book Management | createBook | Existing book; collision hai lần rồi null | 200 merge; counter tăng đến barcode trống | CB.10 merge while T,T,F | Retry merge; mock phải kết thúc | S |
| WB-CB-14 | Book Management | createBook | transaction reject P2002 | 400 ISBN đã tồn tại | CB.E P2002 T | Nhánh unique constraint giả lập | S |
| WB-CB-15 | Book Management | createBook | transaction reject code khác | 500 Không thể tạo sách mới | CB.E P2002 F | Lỗi DB thông thường | S |
| WB-CB-16 | Book Management | createBook | copies=0 hoặc abc; required đủ | Code fallback 1; quy tắc reject/coerce cần chốt, chưa có oracle nghiệp vụ | CB.3 Number(copies)\|\|1 fallback | 0 và NaN bị che bởi \|\| | R |
| WB-CB-17 | Book Management | createBook | copies=1.5; required đủ | Code chạy 2 vòng; cần chốt số lượng phải integer và cách báo lỗi | CB.4 F; CB.10 for biên lẻ | Không khẳng định số lẻ hợp lệ | R |
| WB-CB-18 | Book Management | createBook | copies=2; available=abc | Code NaN lọt CB.5/6; cần chốt validation số hữu hạn | CB.3 explicit NaN; CB.5/6 F | Boolean so sánh NaN | R |
| WB-CB-19 | Book Management | createBook | copies=2; available=0 | Code tạo 2 AVAILABLE; chốt ý nghĩa available trước oracle về status | CB.5/6 F tại 0; CB.10 | Field có validate nhưng không dùng | R |
| WB-UB-01 | Book Management | updateBook | req.user USER | 403; không lookup/update | UB.1 T | Quyền cập nhật | S |
| WB-UB-02 | Book Management | updateBook | id=abc | 400; không DB | UB.2 T | parseInt NaN | S |
| WB-UB-03 | Book Management | updateBook | id=7; findUnique=null | 404; không update | UB.3 T | Sách không còn tồn tại | S |
| WB-UB-04 | Book Management | updateBook | existing 2 items; body metadata+publisher/copies undefined | 200; không đổi metadata, không upsert/items; reload giữ barcode | UB.4/5/6 false; UB.7 first F | Bỏ field khác xóa field | S |
| WB-UB-05 | Book Management | updateBook | Metadata có title/isbn/year/page/language/description/cover/ebook, category/author/publisher truthy; copies=3, current=2 | 200; upserts+trim/update đúng; thêm 1 AVAILABLE; barcode cũ giữ | UB.4/5/6 T; UB.7 T/T; UB.8 T | BOOK-07 update+tăng số bản | B |
| WB-UB-06 | Book Management | updateBook | year/page/language/ebook empty; publisher empty; copies=0 | 200; year/page/language/ebook/publisherId=null; không tạo item | UB.4 falsy ternary; UB.6 nested F; UB.7 second F | Xóa optional và biên 0 | S |
| WB-UB-07 | Book Management | updateBook | copies=2; current=2 | 200; không tạo hoặc xóa item | UB.7 T/T; UB.8 F tại bằng | Target không tăng | S |
| WB-UB-08 | Book Management | updateBook | copies=1; current=2 | Code không giảm item; cần chốt giảm copies trước assertion nghiệp vụ | UB.8 F tại nhỏ hơn | Giảm số lượng chưa được đặc tả | R |
| WB-UB-09 | Book Management | updateBook | id=12abc; existing id=12 | Code lookup id 12; cần chốt ID strict numeric | UB.2 F sau parseInt | ID có hậu tố | R |
| WB-UB-10 | Book Management | updateBook | Metadata đã update; bookItem.create reject P2002 | 400; ghi nhận metadata update đã gọi trước; không giả định rollback | UB.E P2025 F; P2002 T | Barcode tăng không kiểm collision | S |
| WB-UB-11 | Book Management | updateBook | book.update reject P2025 | 404 | UB.E P2025 T | Record mất trong lúc cập nhật | S |
| WB-UB-12 | Book Management | updateBook | book.update reject code khác | 500 | UB.E P2025 F; P2002 F | Catch cuối | S |
| WB-DB-01 | Book Management | deleteBook | actor USER | 403; mọi delete không gọi | DB.1 T | Cấm xóa | S |
| WB-DB-02 | Book Management | deleteBook | id=abc | 400; mọi delete không gọi | DB.2 T | ID sai | S |
| WB-DB-03 | Book Management | deleteBook | borrowedCount=1 | 400; mọi delete không gọi | DB.3 T | Bảo vệ sách đang mượn | S |
| WB-DB-04 | Book Management | deleteBook | borrowedCount=0; items=[17] | 200; loan→bookItem→reservation→book delete đúng thứ tự qua mock | DB.3 F; DB.4 T | Cascade có bản sao | B |
| WB-DB-05 | Book Management | deleteBook | borrowedCount=0; items=[] | 200; bỏ delete loan/item; delete reservation+book | DB.4 F | Cascade không bản sao | S |
| WB-DB-06 | Book Management | deleteBook | book.delete reject P2025 | 404 | DB.E P2025 T | Sách không tồn tại | S |
| WB-DB-07 | Book Management | deleteBook | delete dependency reject khác | 500; không khẳng định rollback | DB.E P2025 F | Cascade lỗi giữa chừng | S |
| WB-BS-01 | Book Management | BooksManagement — callback của books.filter (filteredBooks) | Query HOA trùng title; category All | Đúng sách hiện | BS.1 T/NE; BS.2 T/NE | Case insensitive title | B |
| WB-BS-02 | Book Management | BooksManagement — callback của books.filter (filteredBooks) | Query chỉ trùng author; category đúng | Đúng sách hiện | BS.1 F/T; BS.2 F/T | Chỉ tác giả match | B |
| WB-BS-03 | Book Management | BooksManagement — callback của books.filter (filteredBooks) | Query không match title/author; category All | Danh sách rỗng | BS.1 F/F; BS.3 F/NE | Không match | B |
| WB-BS-04 | Book Management | BooksManagement — callback của books.filter (filteredBooks) | Query match title; category khác | Sách không hiện | BS.3 T/F; BS.2 F/F | Search match nhưng thể loại sai | B |
| WB-BS-05 | Book Management | BooksManagement — callback của books.filter (filteredBooks) | Query empty; category All | Tất cả sách hiện | BS.1 T/NE; BS.2 T/NE | Biên chuỗi rỗng | B |

## 6. Excel Import

| Test ID | Module | Function | Input / precondition mock | Expected Output / side effect | Branch/Condition | Lý do dữ liệu | Oracle |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WB-XF-01 | Excel Import | uploadExcel — fileFilter callback | MIME Excel allowed; name=sample.txt | cb(null,true) theo code OR; chốt nếu muốn cả MIME và đuôi đúng | XF.1 T/NE | MIME đủ để nhận, khác UI | R |
| WB-XF-02 | Excel Import | uploadExcel — fileFilter callback | MIME text/plain; name=sample.XLSX | cb(null,true) | XF.1 F/T | Extension đúng, case insensitive | S |
| WB-XF-03 | Excel Import | uploadExcel — fileFilter callback | MIME text/plain; name=sample.txt | cb(Error) một lần | XF.1 F/F | Cả hai không khớp | S |
| WB-XF-04 | Excel Import | uploadExcel — fileFilter callback | Capture options truyền vào multer, không chạy Multer thật | memoryStorage; fileSize=10485760; single(file) | XF.2 config | Giới hạn không phải branch của callback | S |
| WB-IB-01 | Excel Import | importBooks | actor USER; file có | 403; không XLSX/Prisma | IB.1 T | Guard trước parser | S |
| WB-IB-02 | Excel Import | importBooks | actor ADMIN; file thiếu | 400; không parser/DB | IB.2 T | Upload thiếu file | S |
| WB-IB-03 | Excel Import | importBooks | XLSX.read trả SheetNames=[] | 400 no sheet; không DB | IB.3 T | Workbook không sheet | S |
| WB-IB-04 | Excel Import | importBooks | sheet có; sheet_to_json trả [] | 400 empty; không DB/audit | IB.4 T | Chỉ header/no rows | S |
| WB-IB-05 | Excel Import | importBooks | Row hợp lệ English, ISBN mới, copies=2; optional thiếu | 200 imported=1,skipped=0,totalCopies=2; book+2 AVAILABLE trong tx; audit; defaults đúng | IB.5/6 all F; IB.8 F; IB.9 F; IB.10; IB.11 T; IB.12 F | EXCEL-02, copies 2 | B |
| WB-IB-06 | Excel Import | importBooks | Row hợp lệ cột Tiêu đề/Tác giả/ISBN/Thể loại/NXB; optional đầy đủ | Canonical values trim; publisher upsert, optional fields giữ đúng; import=1 | NK.1 alias; IB.9 T | Alias có dấu + optional truthy | S |
| WB-IB-07 | Excel Import | importBooks | Row hợp lệ cột ten sach/tac gia/ma isbn/the loai; key HOA+space | Canonical fields đúng; import=1 | NK.1 trim/lower/alias | Alias không dấu, case/whitespace | S |
| WB-IB-08 | Excel Import | importBooks | Row cột lạ headingXYZ thay title; các field khác đủ | Skip row 2 thiếu required; không transaction/audit | NK.1 unknown fallback; IB.6 T | Không bịa mapping unknown | S |
| WB-IB-09 | Excel Import | importBooks | Row title empty; các field khác đủ | Skip row 2, reason required; không DB | IB.6 T/NE/NE/NE | Missing title | B |
| WB-IB-10 | Excel Import | importBooks | Row author empty; fields khác đủ | Skip row 2 | IB.6 F/T/NE/NE | Missing author | B |
| WB-IB-11 | Excel Import | importBooks | Row isbn empty; fields khác đủ | Skip row 2, isbn label thiếu | IB.6 F/F/T/NE | Missing ISBN | B |
| WB-IB-12 | Excel Import | importBooks | Row category empty; fields khác đủ | Skip row 2 | IB.6 F/F/F/T | Missing category | B |
| WB-IB-13 | Excel Import | importBooks | Hai row ISBN=978 123 và 978123, hợp lệ | Row 1 nhập; row Excel 3 skip duplicate file; không DB lookup row 2 | IB.7 F→T; IB.12 T | Chuẩn hóa whitespace trong file | S |
| WB-IB-14 | Excel Import | importBooks | Row ISBN tồn tại theo findUnique | Skip DB duplicate, không transaction; audit không gọi khi imported=0 | IB.8 T; IB.11 F | EXCEL-03 khác BOOK-06, không merge | B |
| WB-IB-15 | Excel Import | importBooks | Hai row: row 1 transaction reject(message=oops), row 2 success ISBN khác | Imported=1,skipped=1; reason oops row 2; tiếp tục row Excel 3; audit | IB.E1 catch→loop tiếp; IB.11 T; IB.12 T | Lỗi từng dòng không hủy toàn file | S |
| WB-IB-16 | Excel Import | importBooks | Row transaction reject với Error không message | Skip reason Lỗi không xác định; 200 imported=0,skipped=1; không audit | IB.E1 fallback; IB.11 F | Fallback message khác empty data | S |
| WB-IB-17 | Excel Import | importBooks | copies undefined/0/−1/abc trong 4 rows ISBN khác | Theo code mỗi row 1 copy, total=4; cần chốt chính sách mặc định/coerce trước assertion nghiệp vụ | IB.5 parseInt\|\|1 + Math.max | Các dữ liệu biên có thể cùng fallback | R |
| WB-IB-18 | Excel Import | importBooks | Row copies=2.9 hoặc chuỗi 2.9 | Theo code parseInt=2; cần chốt integer/reject hay truncation | IB.5 parseInt | Biên số lẻ khác createBook | R |
| WB-IB-19 | Excel Import | importBooks | Row ISBN=ABC, createdBook.id=7, copies=1 | Theo code barcode BC-7-001; fallback id, không BOOK | IB.10 cleanIsbn fallback | ISBN không có chữ số; không kết luận valid ISBN nghiệp vụ | R |
| WB-IB-20 | Excel Import | importBooks | XLSX.read throw Error(parse failure) | 500 parse failure; không DB | IB.E2 message truthy | Parser lỗi file | S |
| WB-IB-21 | Excel Import | importBooks | XLSX.read throw Error không message | 500 Không thể import sách từ file Excel | IB.E2 fallback | Catch ngoài khác catch row | S |
| WB-IB-22 | Excel Import | importBooks | Row success; auditLog.create reject | 500; transaction đã gọi thành công; không giả định all rollback | IB.11 T → IB.E2 | Audit ngoài transaction | S |
| WB-IB-23 | Excel Import | importBooks | Hai rows cùng ISBN; row đầu lỗi DB, row sau dữ liệu đã sửa | Theo code row sau vẫn skip duplicate file vì seen add trước try; chốt retry rule | IB.E1 → IB.7 T | Ảnh hưởng thứ tự seenIsbns | R |
| WB-EV-01 | Excel Import | ImportExcelModal.validateAndSetFile | File sample.txt, size nhỏ | Toast lỗi; không chọn file/POST | EV.1 T | EXCEL-04 | B |
| WB-EV-02 | Excel Import | ImportExcelModal.validateAndSetFile | File sample.xlsx, size=10485761 | Toast size; không chọn file | EV.1 F; EV.2 T | 10 MiB+1 byte | S |
| WB-EV-03 | Excel Import | ImportExcelModal.validateAndSetFile | File sample.XLS, size=10485760 | File được chọn; result cũ xóa; không upload tự động | EV.1 F; EV.2 F tại bằng | 10 MiB đúng giới hạn | S |

## 7. Ca cần xác nhận trước khi viết assertion

| Test ID | Câu hỏi cần chốt | Bằng chứng cần có |
| --- | --- | --- |
| WB-FP-08 | lookup email empty, 404 theo code; cần chốt có phải 400 validation không | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-RP-11 | Theo code cho đổi: 200, update password và OTP/expiry=null; biên cần xác nhận | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-RP-14 | Theo code catch 500 do trim; cần chốt validation 400 | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-RG-06 | Không cho tài khoản không sử dụng được; cách từ chối/HTTP/message cần chốt trước assertion | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-RG-07 | Luồng có quyền phải lưu role chọn theo MEM-05; anonymous không được nâng quyền. Chốt endpoint/auth contract trước viết | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-TB-07 | Code đảo thành true; chưa chốt reject sai kiểu hoặc fallback toggle | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-MA-04 | Cần chốt không gửi/hiện lỗi theo chính sách email; không lấy việc POST được làm oracle đạt | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-CB-16 | Code fallback 1; quy tắc reject/coerce cần chốt, chưa có oracle nghiệp vụ | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-CB-17 | Code chạy 2 vòng; cần chốt số lượng phải integer và cách báo lỗi | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-CB-18 | Code NaN lọt CB.5/6; cần chốt validation số hữu hạn | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-CB-19 | Code tạo 2 AVAILABLE; chốt ý nghĩa available trước oracle về status | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-UB-08 | Code không giảm item; cần chốt giảm copies trước assertion nghiệp vụ | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-UB-09 | Code lookup id 12; cần chốt ID strict numeric | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-XF-01 | cb(null,true) theo code OR; chốt nếu muốn cả MIME và đuôi đúng | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-IB-17 | Theo code mỗi row 1 copy, total=4; cần chốt chính sách mặc định/coerce trước assertion nghiệp vụ | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-IB-18 | Theo code parseInt=2; cần chốt integer/reject hay truncation | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-IB-19 | Theo code barcode BC-7-001; fallback id, không BOOK | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |
| WB-IB-23 | Theo code row sau vẫn skip duplicate file vì seen add trước try; chốt retry rule | Đặc tả/QA acceptance được đồng ý; nếu đổi yêu cầu, lưu phiên bản riêng và giữ Expected manual v2. |

Việc source register bỏ tier là dấu hiệu phù hợp DEF-002, không phải kết quả Unit Test. MEM-02 chưa có chuỗi email lỗi/message/login evidence đủ để mô phỏng đúng sự cố end-to-end; cần Tester bổ sung. POT-001 yêu cầu OTP login và POT-002 phạm vi search Header nằm trong backlog requirement của Plan, chưa bịa test API/handler không tồn tại.

## 8. Những nhánh chưa cam kết phủ đủ bằng ma trận này

Ma trận ưu tiên guard, đường đi quan trọng và defect regression, chưa là tuyên bố exhaustive coverage. Còn backlog: exception của login/getMe/getAllUsers; error fallback của các mutations UI; tất cả tổ hợp truthy/falsy của metadata; ISBN không digit/whitespace và query merge title+author; parser XLSX thực và multipart limit thực; invalid payload JWT; notification service resolve null; lỗi DB xảy ra ở từng bước upsert/find/reload; các nhánh recommendations/template/e-book và JSX phụ.

Không xóa code/branch khỏi coverage để làm đẹp kết quả. Khi chạy thật, uncovered lines/branches được ánh xạ lại nhãn Plan, bổ sung test có mục đích, giữ nguyên baseline. Predicate loop cần có cạnh lặp và thoát; while mock collision phải có kết quả null cuối để tránh vòng vô hạn. Số lần collision là thiết kế input, không phải số testcase thực đã PASS.
