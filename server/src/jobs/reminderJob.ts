import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendDueSoonReminderEmail, sendOverdueReminderEmail, EmailResult } from '../services/mailService';
import { createNotification } from '../services/notificationService';

const prisma = new PrismaClient();

export interface ReminderScanReport {
  timestamp: string;
  totalActiveLoans: number;
  dueSoonCount: number;
  overdueCount: number;
  updatedOverdueCount: number;
  emailsSent: number;
  notificationsCreated: number;
  failedCount: number;
  results: EmailResult[];
}

/**
 * Quét toàn bộ bảng Loan để tìm các phiếu mượn:
 * 1. Quá hạn: dueDate < hiện tại (diffDays < 0)
 *    -> Tự động CẬP NHẬT DB: status = 'OVERDUE', fineAmount = overdueDays * 5000
 *    -> Gửi Email cảnh báo + Tạo in-app Notification cho độc giả
 * 2. Sắp đến hạn: còn 1-2 ngày (diffDays trong khoảng 0 đến 2)
 *    -> Gửi Email nhắc nhở + Tạo in-app Notification cho độc giả
 */
export const scanAndSendReminders = async (): Promise<ReminderScanReport> => {
  console.log('[ReminderJob] 🔍 Bắt đầu quét kiểm tra hạn trả sách toàn hệ thống...');
  const now = new Date();

  // Quét các phiếu mượn chưa trả sách
  const activeLoans = await prisma.loan.findMany({
    where: {
      returnDate: null,
      status: { in: ['ACTIVE', 'BORROWING', 'OVERDUE'] }
    },
    include: {
      user: true,
      bookItem: {
        include: {
          book: true
        }
      }
    }
  });

  console.log(`[ReminderJob] Tìm thấy ${activeLoans.length} phiếu mượn đang lưu thông.`);

  let dueSoonCount = 0;
  let overdueCount = 0;
  let updatedOverdueCount = 0;
  let notificationsCreated = 0;
  const results: EmailResult[] = [];

  for (const loan of activeLoans) {
    const dueDate = new Date(loan.dueDate);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const bookTitle = loan.bookItem?.book?.title || 'Sách Thư Viện';
    const barcode = loan.bookItem?.barcode;

    if (diffDays < 0) {
      // 1. XỬ LÝ SÁCH QUÁ HẠN
      overdueCount++;
      const overdueDays = Math.max(1, Math.abs(diffDays));
      const calculatedFine = overdueDays * 5000;

      // Cập nhật trực tiếp Database: status = 'OVERDUE' và fineAmount
      try {
        await prisma.loan.update({
          where: { id: loan.id },
          data: {
            status: 'OVERDUE',
            fineAmount: calculatedFine
          }
        });
        updatedOverdueCount++;
      } catch (err) {
        console.error(`[ReminderJob] Lỗi cập nhật trạng thái OVERDUE cho loanId ${loan.id}:`, err);
      }

      console.log(`[ReminderJob] ⚠️ Phát hiện quá hạn: "${bookTitle}" - Độc giả: ${loan.user?.name} (${loan.user?.email}) - Trễ: ${overdueDays} ngày - Phạt: ${calculatedFine.toLocaleString('vi-VN')} VNĐ`);

      // Tạo in-app Notification cảnh báo quá hạn
      if (loan.userId) {
        const notif = await createNotification({
          userId: loan.userId,
          title: 'Cảnh báo sách quá hạn!',
          message: `Cuốn sách "${bookTitle}" đã quá hạn trả ${overdueDays} ngày. Tiền phạt hiện tại: ${calculatedFine.toLocaleString('vi-VN')} VNĐ (5.000đ/ngày). Vui lòng mang sách đến trả và thanh toán phạt!`
        });
        if (notif) notificationsCreated++;
      }

      // Gửi Email nhắc nhở quá hạn
      if (loan.user?.email) {
        const result = await sendOverdueReminderEmail({
          to: loan.user.email,
          userName: loan.user.name,
          bookTitle,
          barcode,
          borrowDate: loan.borrowDate,
          dueDate: loan.dueDate,
          overdueDays
        });
        results.push(result);
      }
    } else if (diffDays <= 2) {
      // 2. XỬ LÝ SÁCH SẮP ĐẾN HẠN (Còn 1-2 ngày)
      dueSoonCount++;
      const daysLeft = Math.max(1, diffDays);
      const formattedDue = dueDate.toLocaleDateString('vi-VN');
      console.log(`[ReminderJob] ⏳ Phát hiện sắp đến hạn: "${bookTitle}" - Độc giả: ${loan.user?.name} (${loan.user?.email}) - Còn: ${daysLeft} ngày`);

      // Tạo in-app Notification nhắc nhở sắp đến hạn
      if (loan.userId) {
        const notif = await createNotification({
          userId: loan.userId,
          title: 'Nhắc nhở sắp đến hạn trả sách',
          message: `Cuốn sách "${bookTitle}" sẽ đến hạn hoàn trả trong ${daysLeft} ngày tới (${formattedDue}). Vui lòng sắp xếp trả sách đúng hạn hoặc gửi yêu cầu gia hạn trực tuyến!`
        });
        if (notif) notificationsCreated++;
      }

      // Gửi Email nhắc nhở sắp đến hạn
      if (loan.user?.email) {
        const result = await sendDueSoonReminderEmail({
          to: loan.user.email,
          userName: loan.user.name,
          bookTitle,
          barcode,
          borrowDate: loan.borrowDate,
          dueDate: loan.dueDate,
          daysLeft
        });
        results.push(result);
      }
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  console.log(`[ReminderJob] ✅ Hoàn tất quét: Sắp đến hạn: ${dueSoonCount}, Quá hạn: ${overdueCount}, DB cập nhật: ${updatedOverdueCount}, Email thành công: ${successCount}, Thông báo in-app: ${notificationsCreated}`);

  return {
    timestamp: now.toISOString(),
    totalActiveLoans: activeLoans.length,
    dueSoonCount,
    overdueCount,
    updatedOverdueCount,
    emailsSent: successCount,
    notificationsCreated,
    failedCount,
    results
  };
};

/**
 * Khởi động Cron Job tự động chạy vào lúc 08:00 sáng mỗi ngày
 * Cron pattern: '0 8 * * *' (Phút 0, Giờ 8, Mỗi ngày, Mỗi tháng, Mỗi thứ)
 */
export const startReminderCron = () => {
  const CRON_SCHEDULE = '0 8 * * *';

  console.log(`[ReminderJob] ⏰ Thiết lập Cron Job gửi email & thông báo quá hạn: chạy vào lúc 08:00 sáng hàng ngày ("${CRON_SCHEDULE}")`);

  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`[ReminderJob] 🔔 [08:00 AM] Tác vụ tự động kích hoạt bởi Cron Job!`);
    try {
      await scanAndSendReminders();
    } catch (error) {
      console.error('[ReminderJob] ❌ Lỗi khi thực thi Cron Job quét nhắc nhở sách:', error);
    }
  });
};
