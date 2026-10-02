import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

/**
 * POST /api/payments/create-url
 * Khởi tạo giao dịch thanh toán tiền phạt giả lập (Mock Payment Gateway)
 */
export const createPaymentUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { loanId, method = 'MOMO' } = req.body;
    const userId = req.user?.userId;

    if (!loanId) {
      return res.status(400).json({ error: 'Thiếu mã phiếu mượn (loanId)' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: Number(loanId) },
      include: {
        bookItem: {
          include: { book: true }
        },
        user: true
      }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu mượn' });
    }

    // Kiểm tra quyền: chỉ chủ phiếu mượn hoặc Admin mới được thanh toán
    if (userId && loan.userId !== userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Bạn không có quyền thanh toán phiếu mượn này' });
    }

    // Nếu đã thanh toán rồi
    if (loan.isFinePaid) {
      return res.status(400).json({ error: 'Khoản tiền phạt của phiếu mượn này đã được thanh toán.' });
    }

    // Tính toán số tiền phạt
    let amount = (loan.fineAmount || 0) + (loan.compensationAmount || 0);

    // Nếu đang quá hạn nhưng chưa được set fine trong DB, tính phạt 5.000đ/ngày
    if (amount <= 0) {
      const now = new Date();
      const due = new Date(loan.dueDate);
      const diffDays = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        amount = diffDays * 5000;
      } else {
        amount = 10000; // Mức phí phạt tối thiểu giả lập
      }
    }

    const txnRef = `FINE-${loan.id}-${Date.now()}`;
    const bookTitle = loan.bookItem?.book?.title || 'Sách thư viện';

    // Đường dẫn chuyển tiếp đến trang Mock Payment Gateway
    const paymentUrl = `/payment-gateway?loanId=${loan.id}&amount=${amount}&txnRef=${txnRef}&method=${method}&bookTitle=${encodeURIComponent(bookTitle)}`;

    res.json({
      success: true,
      message: 'Khởi tạo link thanh toán thành công',
      paymentUrl,
      loanId: loan.id,
      amount,
      txnRef,
      bookTitle,
      borrowerName: loan.user?.name || ''
    });
  } catch (error: any) {
    console.error('Error creating payment url:', error);
    res.status(500).json({ error: error.message || 'Không thể tạo phiên thanh toán' });
  }
};

/**
 * GET /api/payments/details/:loanId
 * Lấy thông tin thanh toán chi tiết của phiếu mượn
 */
export const getPaymentDetails = async (req: AuthRequest, res: Response) => {
  try {
    const loanId = Number(req.params.loanId);
    if (!loanId) {
      return res.status(400).json({ error: 'Thiếu mã phiếu mượn' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        bookItem: {
          include: { book: true }
        },
        user: true
      }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu mượn' });
    }

    let amount = (loan.fineAmount || 0) + (loan.compensationAmount || 0);
    if (amount <= 0) {
      const now = new Date();
      const due = new Date(loan.dueDate);
      const diffDays = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        amount = diffDays * 5000;
      } else {
        amount = 10000;
      }
    }

    res.json({
      loanId: loan.id,
      amount,
      isFinePaid: Boolean(loan.isFinePaid),
      finePaidAt: loan.finePaidAt,
      bookTitle: loan.bookItem?.book?.title || 'Sách mượn',
      author: loan.bookItem?.book?.author || '',
      coverImage: loan.bookItem?.book?.coverImage,
      borrowerName: loan.user?.name,
      borrowerEmail: loan.user?.email,
      dueDate: loan.dueDate,
      returnDate: loan.returnDate,
      status: loan.status
    });
  } catch (error: any) {
    console.error('Error getting payment details:', error);
    res.status(500).json({ error: error.message || 'Không thể lấy thông tin thanh toán' });
  }
};

/**
 * POST & GET /api/payments/callback
 * Xử lý kết quả trả về sau khi người dùng xác nhận thanh toán giả lập
 */
export const paymentCallback = async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.method === 'POST' ? req.body : req.query;
    const loanId = Number(payload.loanId);
    const txnRef = String(payload.txnRef || `TXN-${Date.now()}`);
    const method = String(payload.method || 'MOMO');
    const status = String(payload.status || 'SUCCESS');

    if (!loanId) {
      return res.status(400).json({ error: 'Thiếu mã phiếu mượn (loanId)' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        bookItem: {
          include: { book: true }
        },
        user: true
      }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu mượn' });
    }

    if (status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Giao dịch thanh toán không thành công hoặc đã bị hủy' });
    }

    // Cập nhật CSDL: Đánh dấu đã thanh toán phạt
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        isFinePaid: true,
        finePaidAt: new Date(),
        paymentMethod: method,
        paymentTransactionId: txnRef
      },
      include: {
        bookItem: {
          include: { book: true }
        },
        user: true
      }
    });

    // Ghi nhật ký hệ thống (AuditLog)
    await prisma.auditLog.create({
      data: {
        action: 'FINE_PAYMENT',
        adminId: req.user?.userId || updatedLoan.userId,
        details: JSON.stringify({
          loanId: updatedLoan.id,
          userId: updatedLoan.userId,
          fineAmount: updatedLoan.fineAmount,
          compensationAmount: updatedLoan.compensationAmount,
          paymentMethod: method,
          paymentTransactionId: txnRef,
          paidAt: updatedLoan.finePaidAt
        })
      }
    });

    res.json({
      success: true,
      message: 'Thanh toán phí phạt thành công!',
      loanId: updatedLoan.id,
      paymentTransactionId: txnRef,
      paidAt: updatedLoan.finePaidAt
    });
  } catch (error: any) {
    console.error('Error handling payment callback:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi xử lý kết quả thanh toán' });
  }
};
