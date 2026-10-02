import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from '../services/notificationService';

const prisma = new PrismaClient();

// =============================================
// State Machine Constants
// =============================================
export const BOOK_ITEM_STATUS = {
    AVAILABLE: 'AVAILABLE',
    BORROWED: 'BORROWED',
    LOST: 'LOST',
    DAMAGED: 'DAMAGED'
} as const;

export const LOAN_STATUS = {
    ACTIVE: 'ACTIVE',
    OVERDUE: 'OVERDUE',
    LOST_PENDING_PAYMENT: 'LOST_PENDING_PAYMENT',
    COMPLETED: 'COMPLETED'
} as const;

export const RENEWAL_STATUS = {
    NONE: 'NONE',
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
} as const;

// Helper to compute display status and shape response for frontend compatibility
export const formatLoanResponse = (loan: any, availableCopies?: number) => {
    let uiStatus = 'On Time';

    if (loan.status === LOAN_STATUS.LOST_PENDING_PAYMENT || loan.status === 'LOST' || loan.status === 'Lost') {
        uiStatus = 'Lost';
    } else if (loan.status === LOAN_STATUS.COMPLETED || loan.status === 'RETURNED' || loan.status === 'Returned') {
        uiStatus = 'Returned';
    } else if (loan.status === LOAN_STATUS.OVERDUE || loan.status === 'Overdue') {
        uiStatus = 'Overdue';
    } else {
        const now = new Date();
        const due = new Date(loan.dueDate);
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            uiStatus = 'Overdue';
        } else if (diffDays <= 2) {
            uiStatus = 'Due Soon';
        } else {
            uiStatus = 'On Time';
        }
    }

    const now = new Date();
    const due = new Date(loan.dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let calculatedFine = loan.fineAmount || 0;
    if (loan.compensationAmount && loan.compensationAmount > 0 && !loan.isFinePaid) {
        calculatedFine = loan.compensationAmount;
    } else if (!loan.isFinePaid && (loan.status === LOAN_STATUS.OVERDUE || diffDays < 0)) {
        if (!loan.fineAmount || loan.fineAmount === 0) {
            calculatedFine = Math.max(0, Math.abs(diffDays) * 5000);
        }
    }

    const book = loan.bookItem?.book;
    const computedAvailable = availableCopies !== undefined
        ? availableCopies
        : (book?.items ? book.items.filter((i: any) => String(i.status).toUpperCase() === BOOK_ITEM_STATUS.AVAILABLE).length : undefined);

    return {
        id: loan.id,
        userId: loan.userId,
        bookItemId: loan.bookItemId,
        bookId: book ? book.id : null,
        borrowDate: loan.borrowDate,
        dueDate: loan.dueDate,
        returnDate: loan.returnDate,
        status: uiStatus,
        rawStatus: loan.status,
        fineAmount: calculatedFine,
        compensationAmount: loan.compensationAmount || 0,
        isFinePaid: Boolean(loan.isFinePaid),
        finePaidAt: loan.finePaidAt,
        paymentMethod: loan.paymentMethod,
        paymentTransactionId: loan.paymentTransactionId,
        renewalStatus: loan.renewalStatus || RENEWAL_STATUS.NONE,
        available: computedAvailable,
        availableCopies: computedAvailable,
        book: book ? {
            id: book.id,
            title: book.title,
            isbn: book.isbn,
            author: book.author?.name || '',
            category: book.category?.name || '',
            coverImage: book.coverImage,
            available: computedAvailable,
            copies: book.items?.length
        } : null,
        bookItem: loan.bookItem ? {
            id: loan.bookItem.id,
            barcode: loan.bookItem.barcode,
            location: loan.bookItem.location,
            status: loan.bookItem.status
        } : null,
        user: loan.user ? {
            id: loan.user.id,
            name: loan.user.name,
            email: loan.user.email
        } : undefined
    };
};

/**
 * Kiểm duyệt rủi ro mượn sách:
 * 1. Chặn mượn nếu User có isBlacklisted == true
 * 2. Chặn mượn nếu User đang có phiếu mượn quá hạn hoặc chưa thanh toán nợ phạt
 * 3. Giới hạn số lượng sách đang mượn theo hạng thành viên (STANDARD: 5, PREMIUM: 10, LECTURER: 15)
 */
export const validateBorrowRisk = async (userId: number): Promise<{ allowed: boolean; error?: string; status?: number }> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            loans: {
                where: {
                    OR: [
                        { returnDate: null },
                        { status: LOAN_STATUS.OVERDUE },
                        { status: LOAN_STATUS.LOST_PENDING_PAYMENT },
                        { isFinePaid: false, fineAmount: { gt: 0 } },
                        { isFinePaid: false, compensationAmount: { gt: 0 } }
                    ]
                },
                include: {
                    bookItem: {
                        include: { book: true }
                    }
                }
            }
        }
    });

    if (!user) {
        return { allowed: false, error: 'Không tìm thấy thông tin người dùng', status: 404 };
    }

    // 1. Kiểm tra Blacklist
    if (user.isBlacklisted) {
        return {
            allowed: false,
            error: 'Tài khoản của bạn đã bị đưa vào danh sách hạn chế (Blacklist). Bạn không thể mượn sách mới, vui lòng liên hệ thủ thư để được mở khóa!',
            status: 403
        };
    }

    // 2. Kiểm tra sách quá hạn hoặc nợ phạt chưa thanh toán
    const now = new Date();
    const blockingLoans = user.loans.filter(loan => {
        if (loan.status === LOAN_STATUS.OVERDUE || loan.status === LOAN_STATUS.LOST_PENDING_PAYMENT) return true;
        if (!loan.returnDate && new Date(loan.dueDate) < now) return true;
        if (!loan.isFinePaid && ((loan.fineAmount && loan.fineAmount > 0) || (loan.compensationAmount && loan.compensationAmount > 0))) return true;
        return false;
    });

    if (blockingLoans.length > 0) {
        const blockingTitles = blockingLoans
            .map(l => `"${l.bookItem?.book?.title || 'Sách'}"`)
            .slice(0, 3)
            .join(', ');
        return {
            allowed: false,
            error: `Độc giả đang có ${blockingLoans.length} phiếu mượn quá hạn hoặc chưa hoàn tất nộp phạt (${blockingTitles}${blockingLoans.length > 3 ? '...' : ''}). Vui lòng thanh toán phạt hoặc trả sách trước khi mượn tiếp!`,
            status: 400
        };
    }

    // 3. Giới hạn số lượng sách đang mượn đồng thời theo hạng thành viên
    const activeBorrowCount = user.loans.filter(l => l.returnDate === null).length;
    const tier = (user.membershipTier || 'STANDARD').toUpperCase();
    let maxAllowed = 5; // STANDARD mặc định 5 cuốn
    if (tier === 'PREMIUM') {
        maxAllowed = 10; // PREMIUM tối đa 10 cuốn
    } else if (tier === 'LECTURER') {
        maxAllowed = 15; // LECTURER tối đa 15 cuốn
    }

    if (activeBorrowCount >= maxAllowed) {
        return {
            allowed: false,
            error: `Độc giả đã đạt giới hạn mượn tối đa (${activeBorrowCount}/${maxAllowed} cuốn) theo hạng thành viên ${tier}. Vui lòng trả bớt sách trước khi mượn tiếp!`,
            status: 400
        };
    }

    return { allowed: true };
};

// =============================================
// 1. Mượn sách (Borrow Book)
// =============================================
export const borrowBook = async (req: AuthRequest, res: Response) => {
    try {
        const { bookId, bookItemId } = req.body;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // --- KIỂM DUYỆT RỦI RO (Blacklist, Quá hạn, Hạn mức gói thành viên) ---
        const riskCheck = await validateBorrowRisk(userId);
        if (!riskCheck.allowed) {
            return res.status(riskCheck.status || 400).json({ error: riskCheck.error });
        }

        // 1. Tìm bản sao vật lý (BookItem) đang AVAILABLE
        let item = null;
        if (bookItemId) {
            item = await prisma.bookItem.findFirst({
                where: {
                    id: Number(bookItemId),
                    status: BOOK_ITEM_STATUS.AVAILABLE
                },
                include: { book: true }
            });
            if (!item) {
                return res.status(400).json({ error: 'Cuốn sách này hiện không khả dụng' });
            }
        } else if (bookId) {
            item = await prisma.bookItem.findFirst({
                where: {
                    bookId: Number(bookId),
                    status: BOOK_ITEM_STATUS.AVAILABLE
                },
                include: { book: true }
            });
            if (!item) {
                return res.status(400).json({ error: 'Sách đã hết bản có sẵn' });
            }
        } else {
            return res.status(400).json({ error: 'Thiếu bookId hoặc bookItemId' });
        }

        // 2. Chạy $transaction: Cập nhật BookItem -> BORROWED & Tạo Loan -> ACTIVE
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 14 ngày mượn sách

        const [updatedBookItem, createdLoan] = await prisma.$transaction([
            prisma.bookItem.update({
                where: { id: item.id },
                data: { status: BOOK_ITEM_STATUS.BORROWED }
            }),
            prisma.loan.create({
                data: {
                    userId,
                    bookItemId: item.id,
                    borrowDate: new Date(),
                    dueDate,
                    status: LOAN_STATUS.ACTIVE,
                    fineAmount: 0,
                    compensationAmount: 0,
                    isFinePaid: false,
                    renewalStatus: RENEWAL_STATUS.NONE
                },
                include: {
                    bookItem: {
                        include: {
                            book: {
                                include: { author: true, category: true, items: true }
                            }
                        }
                    },
                    user: true
                }
            })
        ]);

        // 3. Đếm số lượng sách khả dụng (AVAILABLE) còn lại
        const availableCopies = await prisma.bookItem.count({
            where: {
                bookId: item.bookId,
                status: BOOK_ITEM_STATUS.AVAILABLE
            }
        });

        // 4. Trigger Event-Driven Notification: Mượn sách thành công
        const bookTitle = createdLoan.bookItem?.book?.title || 'Sách';
        const formattedDueDate = new Date(dueDate).toLocaleDateString('vi-VN');
        await createNotification({
            userId,
            title: 'Mượn sách thành công',
            message: `Bạn đã mượn thành công cuốn sách "${bookTitle}". Hạn hoàn trả sách: ${formattedDueDate}.`
        });

        res.json({
            ...formatLoanResponse(createdLoan, availableCopies),
            available: availableCopies,
            availableCopies
        });
    } catch (error) {
        console.error('Error borrowing book:', error);
        res.status(500).json({ error: 'Không thể mượn sách. Giao dịch đã được hủy an toàn.' });
    }
};

// =============================================
// 2. Mượn sách qua Quét mã vạch (Admin Barcode Borrow)
// =============================================
export const borrowByBarcode = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền tạo phiếu mượn' });
        }

        const { barcode, userId } = req.body;
        if (!barcode || !userId) {
            return res.status(400).json({ error: 'Thiếu mã vạch hoặc mã độc giả' });
        }

        const bookItem = await prisma.bookItem.findUnique({
            where: { barcode: String(barcode).trim() },
            include: { book: true }
        });

        if (!bookItem) {
            return res.status(404).json({ error: `Không tìm thấy cuốn sách với mã vạch "${barcode}"` });
        }

        if (bookItem.status !== BOOK_ITEM_STATUS.AVAILABLE) {
            return res.status(400).json({
                error: `Cuốn sách này đang ở trạng thái "${bookItem.status}", không thể cho mượn`
            });
        }

        const borrower = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!borrower) {
            return res.status(404).json({ error: 'Không tìm thấy độc giả' });
        }

        const riskCheck = await validateBorrowRisk(Number(userId));
        if (!riskCheck.allowed) {
            return res.status(riskCheck.status || 400).json({ error: riskCheck.error });
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        // $transaction: BookItem -> BORROWED & Loan -> ACTIVE
        const [updatedItem, createdLoan] = await prisma.$transaction([
            prisma.bookItem.update({
                where: { id: bookItem.id },
                data: { status: BOOK_ITEM_STATUS.BORROWED }
            }),
            prisma.loan.create({
                data: {
                    userId: Number(userId),
                    bookItemId: bookItem.id,
                    borrowDate: new Date(),
                    dueDate,
                    status: LOAN_STATUS.ACTIVE,
                    fineAmount: 0,
                    compensationAmount: 0,
                    isFinePaid: false,
                    renewalStatus: RENEWAL_STATUS.NONE
                },
                include: {
                    bookItem: {
                        include: {
                            book: { include: { author: true, category: true, items: true } }
                        }
                    },
                    user: true
                }
            })
        ]);

        const availableCopies = await prisma.bookItem.count({
            where: {
                bookId: bookItem.bookId,
                status: BOOK_ITEM_STATUS.AVAILABLE
            }
        });

        // Trigger Event-Driven Notification: Phiếu mượn mới
        const formattedBarcodeDue = new Date(dueDate).toLocaleDateString('vi-VN');
        await createNotification({
            userId: Number(userId),
            title: 'Phiếu mượn sách mới',
            message: `Thư viện đã tạo phiếu mượn cuốn sách "${bookItem.book.title}" cho bạn. Hạn hoàn trả: ${formattedBarcodeDue}.`
        });

        res.json({
            message: `Cho mượn thành công: "${bookItem.book.title}" → ${borrower.name}`,
            loan: formatLoanResponse(createdLoan, availableCopies),
            available: availableCopies,
            availableCopies
        });
    } catch (error) {
        console.error('Error borrowing by barcode:', error);
        res.status(500).json({ error: 'Không thể tạo phiếu mượn' });
    }
};

// =============================================
// 3. Trả sách & Đóng phiếu mượn (Return Book)
// =============================================
export const returnBook = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền thu hồi sách' });

        const { loanId } = req.body;
        if (!loanId) return res.status(400).json({ error: 'Thiếu mã phiếu mượn (loanId)' });

        const loan = await prisma.loan.findUnique({
            where: { id: Number(loanId) },
            include: {
                bookItem: {
                    include: {
                        book: true
                    }
                },
                user: true
            }
        });

        if (!loan) {
            return res.status(404).json({ error: 'Không tìm thấy phiếu mượn' });
        }

        if (loan.status === LOAN_STATUS.COMPLETED) {
            return res.status(400).json({ error: 'Phiếu mượn này đã hoàn tất trước đó' });
        }

        const now = new Date();
        const due = new Date(loan.dueDate);
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Tính tiền phạt trễ hạn nếu có
        let calculatedFine = loan.fineAmount || 0;
        if (diffDays < 0 && !loan.isFinePaid) {
            calculatedFine = Math.max(calculatedFine, Math.abs(diffDays) * 5000);
        }

        // Quyết định trạng thái theo State Machine:
        // Nếu còn nợ phạt chưa thanh toán -> Giữ OVERDUE; nếu không có nợ phạt (hoặc đã trả) -> COMPLETED
        const hasUnpaidFine = !loan.isFinePaid && (calculatedFine > 0 || (loan.compensationAmount && loan.compensationAmount > 0));
        const targetLoanStatus = hasUnpaidFine ? LOAN_STATUS.OVERDUE : LOAN_STATUS.COMPLETED;

        // $transaction: Trả sách vật lý BookItem -> AVAILABLE, cập nhật Loan
        const [updatedLoan] = await prisma.$transaction([
            prisma.loan.update({
                where: { id: Number(loanId) },
                data: {
                    returnDate: now,
                    status: targetLoanStatus,
                    fineAmount: calculatedFine
                },
                include: {
                    bookItem: {
                        include: {
                            book: {
                                include: { author: true, category: true, items: true }
                            }
                        }
                    },
                    user: true
                }
            }),
            prisma.bookItem.update({
                where: { id: loan.bookItemId },
                data: { status: BOOK_ITEM_STATUS.AVAILABLE }
            })
        ]);

        const availableCopies = await prisma.bookItem.count({
            where: {
                bookId: loan.bookItem.bookId,
                status: BOOK_ITEM_STATUS.AVAILABLE
            }
        });

        const bookTitle = updatedLoan.bookItem?.book?.title || 'Sách';

        // Kiểm tra độc giả đang đặt trước (WAITING) để chuyển sang NOTIFIED
        const pendingReservation = await prisma.reservation.findFirst({
            where: {
                bookId: loan.bookItem.bookId,
                status: 'WAITING'
            },
            orderBy: { createdAt: 'asc' },
            include: { user: true }
        });

        if (pendingReservation) {
            await prisma.reservation.update({
                where: { id: pendingReservation.id },
                data: { status: 'NOTIFIED' }
            });

            await createNotification({
                userId: pendingReservation.userId,
                title: 'Sách bạn đặt trước đã có sẵn!',
                message: `Cuốn sách "${bookTitle}" bạn đặt trước hiện đã được trả về thư viện. Vui lòng đến quầy làm thủ tục mượn!`
            });
        }

        // Trigger Event-Driven Notification cho người trả sách
        if (targetLoanStatus === LOAN_STATUS.COMPLETED) {
            await createNotification({
                userId: loan.userId,
                title: 'Trả sách thành công',
                message: `Bạn đã hoàn tất trả cuốn sách "${bookTitle}". Phiếu mượn đã được đóng thành công!`
            });
        } else {
            await createNotification({
                userId: loan.userId,
                title: 'Đã nhận lại sách (Chờ nộp phạt)',
                message: `Thư viện đã nhận lại cuốn sách "${bookTitle}". Do quá hạn, bạn có khoản tiền phạt ${calculatedFine.toLocaleString('vi-VN')} VNĐ cần thanh toán để hoàn tất phiếu mượn!`
            });
        }

        res.json({
            ...formatLoanResponse(updatedLoan, availableCopies),
            available: availableCopies,
            availableCopies,
            reservationNotice: pendingReservation ? {
                userName: pendingReservation.user.name,
                userEmail: pendingReservation.user.email
            } : null
        });
    } catch (error) {
        console.error('Error returning book:', error);
        res.status(500).json({ error: 'Không thể thực hiện trả sách' });
    }
};

// =============================================
// 4. Trả sách qua Quét mã vạch (Admin Barcode Return)
// =============================================
export const returnByBarcode = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền thu hồi sách' });
        }

        const { barcode } = req.body;
        if (!barcode) {
            return res.status(400).json({ error: 'Thiếu mã vạch' });
        }

        const bookItem = await prisma.bookItem.findUnique({
            where: { barcode: String(barcode).trim() },
            include: { book: true }
        });

        if (!bookItem) {
            return res.status(404).json({ error: `Không tìm thấy cuốn sách với mã vạch "${barcode}"` });
        }

        // Tìm phiếu mượn đang hoạt động hoặc đang quá hạn của bản sao này
        const activeLoan = await prisma.loan.findFirst({
            where: {
                bookItemId: bookItem.id,
                returnDate: null,
                status: { in: [LOAN_STATUS.ACTIVE, LOAN_STATUS.OVERDUE, 'BORROWING'] }
            },
            include: { user: true }
        });

        if (!activeLoan) {
            return res.status(400).json({ error: 'Cuốn sách này hiện không có phiếu mượn nào đang hoạt động' });
        }

        const now = new Date();
        const due = new Date(activeLoan.dueDate);
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let calculatedFine = activeLoan.fineAmount || 0;
        if (diffDays < 0 && !activeLoan.isFinePaid) {
            calculatedFine = Math.max(calculatedFine, Math.abs(diffDays) * 5000);
        }

        const hasUnpaidFine = !activeLoan.isFinePaid && (calculatedFine > 0 || (activeLoan.compensationAmount && activeLoan.compensationAmount > 0));
        const targetLoanStatus = hasUnpaidFine ? LOAN_STATUS.OVERDUE : LOAN_STATUS.COMPLETED;

        // $transaction: Trả sách vật lý BookItem -> AVAILABLE, cập nhật Loan
        const [updatedLoan] = await prisma.$transaction([
            prisma.loan.update({
                where: { id: activeLoan.id },
                data: {
                    returnDate: now,
                    status: targetLoanStatus,
                    fineAmount: calculatedFine
                },
                include: {
                    bookItem: {
                        include: {
                            book: { include: { author: true, category: true, items: true } }
                        }
                    },
                    user: true
                }
            }),
            prisma.bookItem.update({
                where: { id: bookItem.id },
                data: { status: BOOK_ITEM_STATUS.AVAILABLE }
            })
        ]);

        const availableCopies = await prisma.bookItem.count({
            where: {
                bookId: bookItem.bookId,
                status: BOOK_ITEM_STATUS.AVAILABLE
            }
        });

        const bookTitle = bookItem.book.title;

        // Kiểm tra độc giả đặt trước
        const pendingReservation = await prisma.reservation.findFirst({
            where: {
                bookId: bookItem.bookId,
                status: 'WAITING'
            },
            orderBy: { createdAt: 'asc' },
            include: { user: true }
        });

        if (pendingReservation) {
            await prisma.reservation.update({
                where: { id: pendingReservation.id },
                data: { status: 'NOTIFIED' }
            });

            await createNotification({
                userId: pendingReservation.userId,
                title: 'Sách bạn đặt trước đã có sẵn!',
                message: `Cuốn sách "${bookTitle}" bạn đặt trước hiện đã được trả về thư viện. Vui lòng đến quầy làm thủ tục mượn!`
            });
        }

        // Trigger Event-Driven Notification cho người trả
        if (targetLoanStatus === LOAN_STATUS.COMPLETED) {
            await createNotification({
                userId: activeLoan.userId,
                title: 'Thu hồi sách thành công',
                message: `Thư viện đã tiếp nhận và thu hồi cuốn sách "${bookTitle}". Phiếu mượn đã hoàn tất.`
            });
        } else {
            await createNotification({
                userId: activeLoan.userId,
                title: 'Thu hồi sách (Chờ nộp phạt)',
                message: `Thư viện đã nhận lại cuốn sách "${bookTitle}". Bạn có khoản nợ phạt ${calculatedFine.toLocaleString('vi-VN')} VNĐ cần thanh toán để hoàn tất phiếu mượn!`
            });
        }

        res.json({
            message: `Thu hồi thành công: "${bookTitle}" từ ${activeLoan.user.name}${hasUnpaidFine ? ` (Phạt trễ hạn: ${calculatedFine.toLocaleString('vi-VN')} VNĐ)` : ''}`,
            loan: formatLoanResponse(updatedLoan, availableCopies),
            available: availableCopies,
            availableCopies,
            reservationNotice: pendingReservation ? {
                userName: pendingReservation.user.name,
                userEmail: pendingReservation.user.email
            } : null
        });
    } catch (error) {
        console.error('Error returning by barcode:', error);
        res.status(500).json({ error: 'Không thể thu hồi sách' });
    }
};

// =============================================
// 5. Báo mất sách & Xử lý bồi thường (Report Lost Book)
// =============================================
export const reportLost = async (req: AuthRequest, res: Response) => {
    try {
        const loanId = Number(req.params.id);
        const { compensationAmount } = req.body;

        if (!loanId || isNaN(loanId)) {
            return res.status(400).json({ error: 'Mã phiếu mượn không hợp lệ' });
        }

        const amount = Number(compensationAmount);
        if (isNaN(amount) || amount < 0) {
            return res.status(400).json({ error: 'Số tiền đền bù bồi thường không hợp lệ' });
        }

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true, items: true }
                        }
                    }
                },
                user: true
            }
        });

        if (!loan) {
            return res.status(404).json({ error: 'Không tìm thấy phiếu mượn' });
        }

        if (loan.status === LOAN_STATUS.COMPLETED) {
            return res.status(400).json({ error: 'Phiếu mượn này đã đóng hoàn tất trước đó' });
        }

        if (loan.status === LOAN_STATUS.LOST_PENDING_PAYMENT || loan.bookItem.status === BOOK_ITEM_STATUS.LOST) {
            return res.status(400).json({ error: 'Phiếu mượn này đã được báo mất trước đó' });
        }

        // $transaction: BookItem -> LOST, Loan -> LOST_PENDING_PAYMENT
        const [updatedLoan] = await prisma.$transaction([
            prisma.loan.update({
                where: { id: loanId },
                data: {
                    status: LOAN_STATUS.LOST_PENDING_PAYMENT,
                    returnDate: new Date(),
                    compensationAmount: amount,
                    fineAmount: amount,
                    isFinePaid: false
                },
                include: {
                    bookItem: {
                        include: {
                            book: {
                                include: { author: true, category: true, items: true }
                            }
                        }
                    },
                    user: true
                }
            }),
            prisma.bookItem.update({
                where: { id: loan.bookItemId },
                data: {
                    status: BOOK_ITEM_STATUS.LOST
                }
            })
        ]);

        const availableCopies = await prisma.bookItem.count({
            where: {
                bookId: loan.bookItem.bookId,
                status: BOOK_ITEM_STATUS.AVAILABLE
            }
        });

        const bookTitle = loan.bookItem.book.title;

        // Trigger Event-Driven Notification cho độc giả
        await createNotification({
            userId: loan.userId,
            title: 'Ghi nhận báo mất sách',
            message: `Cuốn sách "${bookTitle}" đã được ghi nhận báo mất. Số tiền bồi thường cần thanh toán là ${amount.toLocaleString('vi-VN')} VNĐ. Vui lòng thanh toán trực tuyến để hoàn tất phiếu mượn!`
        });

        res.json({
            message: `Đã ghi nhận báo mất sách "${bookTitle}". Số tiền bồi thường: ${amount.toLocaleString('vi-VN')} VNĐ.`,
            loan: formatLoanResponse(updatedLoan, availableCopies),
            available: availableCopies,
            availableCopies
        });
    } catch (error) {
        console.error('Error reporting lost book:', error);
        res.status(500).json({ error: 'Không thể xử lý báo mất sách' });
    }
};

// =============================================
// 6. Barcode Lookup – Tra cứu BookItem theo mã vạch
// =============================================
export const lookupBarcode = async (req: AuthRequest, res: Response) => {
    try {
        const barcode = String(req.params.barcode || '').trim();
        if (!barcode) return res.status(400).json({ error: 'Thiếu mã vạch' });

        const bookItem = await prisma.bookItem.findUnique({
            where: { barcode },
            include: {
                book: {
                    include: { author: true, category: true, publisher: true }
                },
                loans: {
                    where: { returnDate: null },
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    },
                    orderBy: { borrowDate: 'desc' },
                    take: 1
                }
            }
        });

        if (!bookItem) {
            return res.status(404).json({ error: `Không tìm thấy cuốn sách với mã vạch "${barcode}"` });
        }

        const activeLoan = bookItem.loans[0] || null;

        res.json({
            bookItem: {
                id: bookItem.id,
                barcode: bookItem.barcode,
                location: bookItem.location,
                status: bookItem.status,
            },
            book: {
                id: bookItem.book.id,
                title: bookItem.book.title,
                isbn: bookItem.book.isbn,
                author: bookItem.book.author?.name || '',
                category: bookItem.book.category?.name || '',
                publisher: bookItem.book.publisher?.name || '',
                coverImage: bookItem.book.coverImage,
            },
            activeLoan: activeLoan ? {
                id: activeLoan.id,
                borrowDate: activeLoan.borrowDate,
                dueDate: activeLoan.dueDate,
                status: activeLoan.status,
                user: activeLoan.user
            } : null
        });
    } catch (error) {
        console.error('Error looking up barcode:', error);
        res.status(500).json({ error: 'Lỗi tra cứu mã vạch' });
    }
};

// =============================================
// 7. Lấy danh sách phiếu mượn của tôi
// =============================================
export const getMyLoans = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const loans = await prisma.loan.findMany({
            where: { userId },
            include: {
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true }
                        }
                    }
                }
            },
            orderBy: { borrowDate: 'desc' }
        });

        res.json(loans.map(loan => formatLoanResponse(loan)));
    } catch (error) {
        console.error('Error fetching user loans:', error);
        res.status(500).json({ error: 'Không thể tải danh sách mượn' });
    }
};

// =============================================
// 8. Lấy toàn bộ phiếu mượn toàn hệ thống (Admin)
// =============================================
export const getAllLoans = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Access denied' });

        const loans = await prisma.loan.findMany({
            include: {
                user: true,
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true }
                        }
                    }
                }
            },
            orderBy: { borrowDate: 'desc' }
        });

        res.json(loans.map(loan => formatLoanResponse(loan)));
    } catch (error) {
        console.error('Error fetching all loans:', error);
        res.status(500).json({ error: 'Không thể tải danh sách mượn toàn hệ thống' });
    }
};

// =============================================
// 9. Quét & Gửi email nhắc nhở trả sách chủ động
// =============================================
export const triggerReminders = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền kích hoạt gửi email nhắc nhở' });
        }

        const { scanAndSendReminders } = await import('../jobs/reminderJob');
        const report = await scanAndSendReminders();

        res.json({
            message: `Đã hoàn tất quét và gửi email nhắc nhở: ${report.emailsSent} email thành công (${report.dueSoonCount} sắp đến hạn, ${report.overdueCount} quá hạn).`,
            report
        });
    } catch (error: any) {
        console.error('Error triggering reminders:', error);
        res.status(500).json({ error: 'Không thể thực hiện tác vụ gửi email nhắc nhở', details: error.message });
    }
};

// =============================================
// 10. Độc giả gửi yêu cầu gia hạn sách
// =============================================
export const requestRenewLoan = async (req: AuthRequest, res: Response) => {
    try {
        const loanId = Number(req.params.id);
        const userId = req.user?.userId;
        const userRole = req.user?.role;

        if (!loanId || isNaN(loanId)) {
            return res.status(400).json({ error: 'Mã phiếu mượn không hợp lệ' });
        }

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true }
                        }
                    }
                },
                user: true
            }
        });

        if (!loan) {
            return res.status(404).json({ error: 'Không tìm thấy phiếu mượn' });
        }

        if (loan.userId !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Bạn không có quyền yêu cầu gia hạn phiếu mượn này' });
        }

        if (loan.returnDate || loan.status === LOAN_STATUS.COMPLETED || loan.status === LOAN_STATUS.LOST_PENDING_PAYMENT || loan.status === 'LOST') {
            return res.status(400).json({ error: 'Phiếu mượn này đã kết thúc, không thể gia hạn' });
        }

        if (loan.renewalStatus === RENEWAL_STATUS.PENDING) {
            return res.status(400).json({ error: 'Yêu cầu gia hạn cho cuốn sách này đang chờ thủ thư phê duyệt!' });
        }

        const now = new Date();
        const dueDate = new Date(loan.dueDate);
        if (dueDate < now || loan.status === LOAN_STATUS.OVERDUE) {
            return res.status(400).json({ error: 'Không thể gia hạn sách đã quá hạn. Vui lòng mang sách đến thư viện để trả!' });
        }

        const bookId = loan.bookItem.bookId;
        const existingReservation = await prisma.reservation.findFirst({
            where: {
                bookId,
                status: { in: ['WAITING', 'NOTIFIED'] },
                userId: { not: loan.userId }
            }
        });

        if (existingReservation) {
            return res.status(400).json({
                error: 'Không thể gia hạn vì đầu sách này đang có độc giả khác đặt trước!'
            });
        }

        const updatedLoan = await prisma.loan.update({
            where: { id: loanId },
            data: {
                renewalStatus: RENEWAL_STATUS.PENDING
            },
            include: {
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true }
                        }
                    }
                },
                user: true
            }
        });

        await createNotification({
            userId: loan.userId,
            title: 'Đã gửi yêu cầu gia hạn',
            message: `Yêu cầu gia hạn cuốn sách "${loan.bookItem.book.title}" đã được gửi tới thủ thư và đang chờ phê duyệt.`
        });

        res.json({
            message: `Đã gửi yêu cầu gia hạn sách "${loan.bookItem.book.title}". Vui lòng chờ thủ thư phê duyệt!`,
            loan: formatLoanResponse(updatedLoan)
        });
    } catch (error) {
        console.error('Error requesting loan renewal:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi gửi yêu cầu gia hạn sách' });
    }
};

export const renewLoan = requestRenewLoan;

// =============================================
// 11. Thủ thư phê duyệt gia hạn sách
// =============================================
export const approveRenewLoan = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền phê duyệt gia hạn sách' });
        }

        const loanId = Number(req.params.id);
        if (!loanId || isNaN(loanId)) {
            return res.status(400).json({ error: 'Mã phiếu mượn không hợp lệ' });
        }

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true }
                        }
                    }
                },
                user: true
            }
        });

        if (!loan) {
            return res.status(404).json({ error: 'Không tìm thấy phiếu mượn' });
        }

        if (loan.returnDate || loan.status === LOAN_STATUS.COMPLETED || loan.status === LOAN_STATUS.LOST_PENDING_PAYMENT) {
            return res.status(400).json({ error: 'Phiếu mượn này đã kết thúc, không thể gia hạn' });
        }

        const newDueDate = new Date(loan.dueDate);
        newDueDate.setDate(newDueDate.getDate() + 7);

        const updatedLoan = await prisma.loan.update({
            where: { id: loanId },
            data: {
                dueDate: newDueDate,
                renewalStatus: RENEWAL_STATUS.APPROVED,
                status: LOAN_STATUS.ACTIVE
            },
            include: {
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true }
                        }
                    }
                },
                user: true
            }
        });

        const bookTitle = loan.bookItem.book.title;
        const formattedNewDue = new Date(newDueDate).toLocaleDateString('vi-VN');

        await createNotification({
            userId: loan.userId,
            title: 'Yêu cầu gia hạn được phê duyệt',
            message: `Yêu cầu gia hạn cuốn sách "${bookTitle}" đã được phê duyệt thành công! Hạn trả mới: ${formattedNewDue}.`
        });

        res.json({
            message: `Đã phê duyệt gia hạn sách "${bookTitle}" thêm 7 ngày (Hạn mới: ${formattedNewDue})`,
            loan: formatLoanResponse(updatedLoan)
        });
    } catch (error) {
        console.error('Error approving loan renewal:', error);
        res.status(500).json({ error: 'Không thể phê duyệt gia hạn sách' });
    }
};

// =============================================
// 12. Thủ thư từ chối gia hạn sách
// =============================================
export const rejectRenewLoan = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền từ chối gia hạn sách' });
        }

        const loanId = Number(req.params.id);
        if (!loanId || isNaN(loanId)) {
            return res.status(400).json({ error: 'Mã phiếu mượn không hợp lệ' });
        }

        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
            include: {
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true }
                        }
                    }
                },
                user: true
            }
        });

        if (!loan) {
            return res.status(404).json({ error: 'Không tìm thấy phiếu mượn' });
        }

        const updatedLoan = await prisma.loan.update({
            where: { id: loanId },
            data: {
                renewalStatus: RENEWAL_STATUS.REJECTED
            },
            include: {
                bookItem: {
                    include: {
                        book: {
                            include: { author: true, category: true }
                        }
                    }
                },
                user: true
            }
        });

        const bookTitle = loan.bookItem.book.title;

        await createNotification({
            userId: loan.userId,
            title: 'Yêu cầu gia hạn bị từ chối',
            message: `Yêu cầu gia hạn cuốn sách "${bookTitle}" của bạn đã bị thủ thư từ chối. Vui lòng sắp xếp hoàn trả sách đúng hạn.`
        });

        res.json({
            message: `Đã từ chối yêu cầu gia hạn sách "${bookTitle}"`,
            loan: formatLoanResponse(updatedLoan)
        });
    } catch (error) {
        console.error('Error rejecting loan renewal:', error);
        res.status(500).json({ error: 'Không thể từ chối gia hạn sách' });
    }
};
