// =============================================
// Loan business rules (pure functions)
// =============================================
// Tách từ loanController để kiểm thử đơn vị/thuộc tính được mà KHÔNG đổi hành vi hiện tại.
// Lưu ý: giữ nguyên hành vi đang chạy, kể cả các điểm lệch đặc tả đã ghi nhận:
// - Hạn mượn +14 ngày cho mọi hạng thành viên (đặc tả: STANDARD 14 / PREMIUM 30 / LECTURER 60).
// - Duyệt gia hạn cộng +7 ngày.

export const FINE_PER_DAY = 5000;
export const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const LOAN_PERIOD_DAYS = 14;
export const RENEWAL_EXTENSION_DAYS = 7;

export type MembershipTier = 'STANDARD' | 'PREMIUM' | 'LECTURER';

// Số ngày còn lại tới hạn tại thời điểm `at` (âm khi đã quá hạn), làm tròn lên theo ngày.
export const daysUntilDue = (dueDate: Date, at: Date): number =>
    Math.ceil((new Date(dueDate).getTime() - new Date(at).getTime()) / MS_PER_DAY);

// Tiền phạt trễ hạn khi trả sách tại `returnDate`; 0 nếu chưa quá hạn.
export const calculateFine = (dueDate: Date, returnDate: Date, ratePerDay: number = FINE_PER_DAY): number => {
    const diffDays = daysUntilDue(dueDate, returnDate);
    return diffDays < 0 ? Math.abs(diffDays) * ratePerDay : 0;
};

// Hạn trả của phiếu mượn mới. Tham số `tier` hiện chưa được dùng (xem ghi chú đầu file).
export const calculateDueDate = (borrowDate: Date, _tier?: MembershipTier | string | null): Date => {
    const dueDate = new Date(borrowDate);
    dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS);
    return dueDate;
};

// Hạn trả mới sau khi thủ thư duyệt gia hạn.
export const calculateRenewedDueDate = (currentDueDate: Date): Date => {
    const newDueDate = new Date(currentDueDate);
    newDueDate.setDate(newDueDate.getDate() + RENEWAL_EXTENSION_DAYS);
    return newDueDate;
};
