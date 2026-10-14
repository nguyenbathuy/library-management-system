# Thay đổi mã nguồn ứng dụng phục vụ kiểm thử

Brief Chương 5–6 chỉ cho phép hai loại thay đổi trong `server/src` và `src`: (a) tách hàm thuần để kiểm thử, giữ nguyên hành vi; (b) thêm `data-testid`. Danh sách đầy đủ:

| # | File | Loại | Thay đổi | Bằng chứng giữ nguyên hành vi |
|---|---|---|---|---|
| 1 | `server/src/utils/loanRules.ts` (mới) | (a) tách hàm thuần | `calculateFine(dueDate, returnDate, ratePerDay = 5000)`, `calculateDueDate(borrowDate, tier?)`, `calculateRenewedDueDate(currentDueDate)`, `daysUntilDue(dueDate, at)` cùng các hằng `FINE_PER_DAY`, `LOAN_PERIOD_DAYS = 14`, `RENEWAL_EXTENSION_DAYS = 7`. Tham số `tier` **chưa được dùng**: mọi hạng vẫn nhận +14 ngày (DEF-005), gia hạn vẫn +7 ngày (DEF-008), phạt vẫn làm tròn như cũ (FIND-01). | Thuộc tính `PBT-P0` so sánh với biểu thức inline cũ trên 500 bộ đầu vào ngẫu nhiên; unit/integration không đổi kết quả. |
| 2 | `server/src/controllers/loanController.ts` | (a) gọi hàm đã tách | Thay biểu thức inline bằng lời gọi `loanRules` tại: `formatLoanResponse` (dùng `daysUntilDue`, `FINE_PER_DAY`), `borrowBook` / `borrowByBarcode` (`calculateDueDate`), `returnBook` / `returnByBarcode` (`calculateFine`; điều kiện `lateFine > 0` tương đương `diffDays < 0` vì mức phạt dương), `approveRenewLoan` (`calculateRenewedDueDate`). Không đổi thông điệp, mã HTTP, truy vấn Prisma hay thứ tự thao tác. | `git diff 90f35a26 -- server/src/controllers/loanController.ts`; `PBT-P0`; 63 ca hộp trắng cũ và các ca mới đều chạy trên mã đã refactor. |
| 3 | `server/tsconfig.json` | cấu hình build (không phải mã ứng dụng) | Thêm `"include": ["src"]`. Trước đó `tsc -p server/tsconfig.json` báo lỗi TS6059 vì gom cả `server/tests/` (ngoài `rootDir`). Không ảnh hưởng `ts-node`/`nodemon`. | `tsc --project server/tsconfig.json --noEmit` exit 0. |

Không có thay đổi nào khác trong `server/src`.

## E2E (Phần 3) — không sửa `src/`

- **Không thêm `data-testid`.** Mọi selector dùng placeholder, role, nhãn và text hiển thị (xem `e2e/pages/`).
- Backend E2E chạy **nguyên** `server/src/index.ts`; việc đổi datasource Prisma sang DB tạm và chặn gửi email được làm bằng preload chỉ dùng cho test (`e2e/support/server-preload.cjs`, nạp qua `node -r`), không phải sửa mã ứng dụng.
- **FIND-05 không được sửa:** `src/app/components/Settings.tsx` gọi `useEffect` nhưng chỉ `import { useState } from 'react'` (thêm ở commit 90f35a26) → trang `/settings` trắng. Brief không cho phép sửa lỗi ứng dụng nên E2E-SET-01 và E2E-AUTH-05 được đánh dấu `test.fail` kèm mã FIND-05.
