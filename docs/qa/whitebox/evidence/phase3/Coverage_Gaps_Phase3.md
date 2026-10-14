# Coverage gaps — Phase 3

V8 đo nguyên `authController.ts`, `middleware/auth.ts`, `authRoutes.ts`; test selector không đổi include source. Raw uncovered locations nằm trong [uncovered-branches.json](uncovered-branches.json).

## Member-only run

Run 25 ca Member đạt 59/133 statements, 20/71 branches, 7/13 functions, 55/128 lines trên ba file. Phần trăm thấp phản ánh nhiều logic Authentication không được chạy trong selector Member. Trong bốn function bodies được chọn, chỉ statement/line catch duplicate ở `register:26` chưa hit vì WB-RG-02 thuộc Authentication regression. Selected-body metrics là 26/27 statements, 12/12 branches, 4/4 functions và 24/25 lines.

## Combined run

Run 65 ca đạt 131/133 statements, 70/71 branches, 13/13 functions, 126/128 lines. Còn:

- hai statements/hai lines tại `authController.ts:298-299`, catch của `resetPassword`;
- một branch slot tại `authController.ts:237`, fallback `result.previewUrl || undefined` khi preview URL rỗng.

Tất cả 13 function/callback instrumented trong ba file đã có hit. Điều này không có nghĩa mọi đường lỗi/condition của ba file đã được kiểm tra, và càng không đại diện frontend, Book/Excel Import, services, jobs hoặc toàn hệ thống.

`authRoutes.ts` có 9/9 statement/line hit trong Member/combined vì module được import để đọc registration stack; raw branch/function denominator là 0/0 nên trình bày N/A. Các hit này không chứng minh full Express dispatch, parsing hay network integration.

