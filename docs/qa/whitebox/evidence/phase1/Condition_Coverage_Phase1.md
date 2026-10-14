# Condition Coverage — Authentication Phase 1

Nguồn thực thi: [Vitest JSON](coverage/vitest-results.json), [actual input/dependency traces](coverage/case-traces.json), [source hash](coverage/run-metadata.json). **Đây là suy luận QA từ dữ liệu thực chạy, thứ tự guard và assertions, không phải metric tự động do coverage-v8 xuất.** Toàn module Authentication: **chưa xác định Condition Coverage**.

Phạm vi phụ: 19 điều kiện nguyên tử trong các if guard của login/changePassword/resetPassword; register không có if Boolean. Có **28/38 outcome T/F = 73.68%** được xác minh trong phạm vi này. Không loại outcome chưa test khỏi mẫu số; không tính NE thành F. Optional chaining và predicates các hàm khác chưa nằm trong denominator phụ. Không khẳng định MC/DC.

## Từng điều kiện Boolean

| Condition | Function:line | Biểu thức | T trong test | F trong test | Outcome còn thiếu |
| --- | --- | --- | --- | --- | --- |
| LG.A | login:34 | !user | WB-LG-01 | WB-LG-02, WB-LG-03 | Đủ T/F |
| LG.B | login:34 | !(await bcrypt.compare(password, user.password)) | WB-LG-02 | WB-LG-03 | Đủ T/F |
| CP.1 | changePassword:142 | !userId | WB-CP-01 | WB-CP-02, WB-CP-03, WB-CP-04, WB-CP-08, WB-CP-09 | Đủ T/F |
| CP.2A | changePassword:148 | !currentPassword | WB-CP-02 | WB-CP-03, WB-CP-04, WB-CP-08, WB-CP-09 | Đủ T/F |
| CP.2B | changePassword:148 | !newPassword | WB-CP-03 | WB-CP-04, WB-CP-08, WB-CP-09 | Đủ T/F |
| CP.3 | changePassword:152 | newPassword.length < 6 | WB-CP-04 | WB-CP-08, WB-CP-09 | Đủ T/F |
| CP.4 | changePassword:160 | !user | Chưa chạy | WB-CP-08, WB-CP-09 | T |
| CP.5 | changePassword:166 | !isMatch | Chưa chạy | WB-CP-08, WB-CP-09 | T |
| CP.6 | changePassword:171 | currentPassword === newPassword | Chưa chạy | WB-CP-08, WB-CP-09 | T |
| RP.1A | resetPassword:249 | !email | Chưa chạy | WB-RP-04, WB-RP-08, WB-RP-10, WB-RP-12 | T |
| RP.1B | resetPassword:249 | !otp | Chưa chạy | WB-RP-04, WB-RP-08, WB-RP-10, WB-RP-12 | T |
| RP.1C | resetPassword:249 | !newPassword | Chưa chạy | WB-RP-04, WB-RP-08, WB-RP-10, WB-RP-12 | T |
| RP.2A | resetPassword:253 | typeof newPassword !== 'string' | WB-RP-04 | WB-RP-08, WB-RP-10, WB-RP-12 | Đủ T/F |
| RP.2B | resetPassword:253 | newPassword.length < 6 | Chưa chạy | WB-RP-08, WB-RP-10, WB-RP-12 | T |
| RP.3 | resetPassword:264 | !user | Chưa chạy | WB-RP-08, WB-RP-10, WB-RP-12 | T |
| RP.4A | resetPassword:268 | !user.resetOtp | Chưa chạy | WB-RP-08, WB-RP-10, WB-RP-12 | T |
| RP.4B | resetPassword:268 | user.resetOtp !== cleanOtp | WB-RP-08 | WB-RP-10, WB-RP-12 | Đủ T/F |
| RP.5A | resetPassword:272 | !user.resetOtpExpiry | Chưa chạy | WB-RP-10, WB-RP-12 | T |
| RP.5B | resetPassword:272 | new Date(user.resetOtpExpiry) < new Date() | WB-RP-10 | WB-RP-12 | Đủ T/F |

## Giá trị từng testcase

T=True, F=False, NE=không được đánh giá vì guard return/short-circuit. Mỗi dòng liên kết input và mock outcomes thực ghi ở case-traces.json; output thực được assert trong source test.

| Test ID | Output HTTP thực | Condition outcomes suy ra |
| --- | --- | --- |
| WB-RG-01 | 201 | register: không có if Boolean; kiểm tra success/catch riêng |
| WB-RG-02 | 400 | register: không có if Boolean; kiểm tra success/catch riêng |
| WB-LG-01 | 401 | LG.A=T, LG.B=NE |
| WB-LG-02 | 401 | LG.A=F, LG.B=T |
| WB-LG-03 | 200 | LG.A=F, LG.B=F |
| WB-CP-01 | 401 | CP.1=T, CP.2A=NE, CP.2B=NE, CP.3=NE, CP.4=NE, CP.5=NE, CP.6=NE |
| WB-CP-02 | 400 | CP.1=F, CP.2A=T, CP.2B=NE, CP.3=NE, CP.4=NE, CP.5=NE, CP.6=NE |
| WB-CP-03 | 400 | CP.1=F, CP.2A=F, CP.2B=T, CP.3=NE, CP.4=NE, CP.5=NE, CP.6=NE |
| WB-CP-04 | 400 | CP.1=F, CP.2A=F, CP.2B=F, CP.3=T, CP.4=NE, CP.5=NE, CP.6=NE |
| WB-CP-08 | 200 | CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=F, CP.5=F, CP.6=F |
| WB-CP-09 | 500 | CP.1=F, CP.2A=F, CP.2B=F, CP.3=F, CP.4=F, CP.5=F, CP.6=F |
| WB-RP-04 | 400 | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=T, RP.2B=NE, RP.3=NE, RP.4A=NE, RP.4B=NE, RP.5A=NE, RP.5B=NE |
| WB-RP-08 | 400 | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=T, RP.5A=NE, RP.5B=NE |
| WB-RP-10 | 400 | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=F, RP.5A=F, RP.5B=T |
| WB-RP-12 | 200 | RP.1A=F, RP.1B=F, RP.1C=F, RP.2A=F, RP.2B=F, RP.3=F, RP.4A=F, RP.4B=F, RP.5A=F, RP.5B=F |

LG-01 không gọi compare → LG.B=NE; LG-02 compare trả false → LG.B=T; LG-03 compare trả true → LG.B=F. CP thiếu current short-circuit không đọc toán hạng missing-new; hai ca thiếu riêng đảm bảo CP.2A/B có T/F. RP số password truthy đi qua missing guard, type guard T rồi length=NE. RP sai OTP dừng trước expiry; expiry T−1/T+1 chỉ đánh giá với fake clock được ghi và output tương ứng.

Bảng không suy từ test design chưa chạy: chỉ 15 ID xuất hiện trong runner JSON được dùng. Source/hash thay đổi hoặc thêm kiểu input ngoài miền fixture cần phân tích lại semantics. Branch report có các slot binary-expr nhưng slot hit không đồng nghĩa mỗi predicate đã có cả T/F. Ví dụ RP.1 có cả ba toán hạng được đánh giá F nhưng chưa có toán hạng nào T trong Phase 1.
