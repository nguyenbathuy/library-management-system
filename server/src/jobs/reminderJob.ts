import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendDueSoonReminderEmail, sendOverdueReminderEmail, EmailResult } from '../services/mailService';

const prisma = new PrismaClient();

export interface ReminderScanReport {
  timestamp: string;
  totalActiveLoans: number;
  dueSoonCount: number;
  overdueCount: number;
  emailsSent: number;
  failedCount: number;
  results: EmailResult[];
}

/**
 * Quét toàn bộ bảng Loan để tìm các phiếu mượn:
 * - Sắp đến hạn: còn 1-2 ngày (diffDays trong khoảng 0 đến 2)
 * - Quá hạn: dueDate < hiện tại (diffDays < 0)
 * Và tự động gửi email thông báo nhắc nhở đến từng độc giả.
 */
export const scanAndSendReminders = async (): Promise<ReminderScanReport> => {
  console.log('[ReminderJob] 🔍 Bắt đầu quét kiểm tra hạn trả sách toàn hệ thống...');
  const now = new Date();

  const activeLoans = await prisma.loan.findMany({
    where: {
      returnDate: null,
      status: { not: 'RETURNED' }
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
  const results: EmailResult[] = [];

  for (const loan of activeLoans) {
    if (!loan.user?.email) continue;

    const dueDate = new Date(loan.dueDate);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const bookTitle = loan.bookItem?.book?.title || 'Sách Thư Viện';
    const barcode = loan.bookItem?.barcode;

    if (diffDays < 0) {
      // Sách đã quá hạn
      overdueCount++;
      const overdueDays = Math.max(1, Math.abs(diffDays));
      console.log(`[ReminderJob] ⚠️ Phát hiện quá hạn: "${bookTitle}" - Độc giả: ${loan.user.name} (${loan.user.email}) - Trễ: ${overdueDays} ngày`);

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
    } else if (diffDays <= 2) {
      // Sách sắp đến hạn (còn 1-2 ngày)
      dueSoonCount++;
      const daysLeft = Math.max(1, diffDays);
      console.log(`[ReminderJob] ⏳ Phát hiện sắp đến hạn: "${bookTitle}" - Độc giả: ${loan.user.name} (${loan.user.email}) - Còn: ${daysLeft} ngày`);

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

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  console.log(`[ReminderJob] ✅ Hoàn tất quét: Sắp đến hạn: ${dueSoonCount}, Quá hạn: ${overdueCount}, Gửi thành công: ${successCount}, Thất bại: ${failedCount}`);

  return {
    timestamp: now.toISOString(),
    totalActiveLoans: activeLoans.length,
    dueSoonCount,
    overdueCount,
    emailsSent: successCount,
    failedCount,
    results
  };
};

/**
 * Khởi động Cron Job tự động chạy vào lúc 08:00 sáng mỗi ngày
 * Cron pattern: '0 8 * * *' (Phút 0, Giờ 8, Mỗi ngày, Mỗi tháng, Mỗi thứ)
 */
export const startReminderCron = () => {
  // 08:00 AM mỗi ngày
  const CRON_SCHEDULE = '0 8 * * *';

  console.log(`[ReminderJob] ⏰ Thiết lập Cron Job gửi email nhắc nhở sách: chạy vào lúc 08:00 sáng hàng ngày ("${CRON_SCHEDULE}")`);

  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`[ReminderJob] 🔔 [08:00 AM] Tác vụ tự động kích hoạt bởi Cron Job!`);
    try {
      await scanAndSendReminders();
    } catch (error) {
      console.error('[ReminderJob] ❌ Lỗi khi thực thi Cron Job quét nhắc nhở sách:', error);
    }
  });
};
