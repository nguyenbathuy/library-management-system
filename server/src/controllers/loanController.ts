import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Helper to compute display status and shape response for frontend
const formatLoanResponse = (loan: any) => {
    let uiStatus = 'On Time';
    if (loan.status === 'LOST' || loan.status === 'Lost') {
        uiStatus = 'Lost';
    } else if (loan.returnDate || loan.status === 'RETURNED' || loan.status === 'Returned') {
        uiStatus = 'Returned';
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

    const book = loan.bookItem?.book;
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
        fineAmount: loan.fineAmount || 0,
        compensationAmount: loan.compensationAmount || 0,
        book: book ? {
            id: book.id,
            title: book.title,
            isbn: book.isbn,
            author: book.author?.name || '',
            category: book.category?.name || '',
            coverImage: book.coverImage
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
 * 2. Chặn mượn nếu User đang có phiếu mượn quá hạn chưa trả
 * 3. Giới hạn số lượng sách đang mượn theo hạng thành viên (STANDARD: 5, PREMIUM: 10, LECTURER: 15)
 */
export const validateBorrowRisk = async (userId: number): Promise<{ allowed: boolean; error?: string; status?: number }> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            loans: {
                where: { returnDate: null },
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

    // 2. Kiểm tra sách quá hạn chưa trả
    const now = new Date();
    const overdueLoans = user.loans.filter(loan => new Date(loan.dueDate) < now);
    if (overdueLoans.length > 0) {
        const overdueTitles = overdueLoans
            .map(l => `"${l.bookItem?.book?.title || 'Sách'}"`)
            .slice(0, 3)
            .join(', ');
        return {
            allowed: false,
            error: `Độc giả đang có ${overdueLoans.length} cuốn sách quá hạn chưa hoàn trả (${overdueTitles}${overdueLoans.length > 3 ? '...' : ''}). Lập tức chặn mượn sách mới cho đến khi hoàn trả sách quá hạn!`,
            status: 400
        };
    }

    // 3. Giới hạn số lượng sách đang mượn theo hạng thành viên
    const currentBorrowCount = user.loans.length;
    const tier = (user.membershipTier || 'STANDARD').toUpperCase();
    let maxAllowed = 5; // STANDARD mặc định 5 cuốn
    if (tier === 'PREMIUM') {
        maxAllowed = 10; // PREMIUM tối đa 10 cuốn
    } else if (tier === 'LECTURER') {
        maxAllowed = 15; // LECTURER tối đa 15 cuốn
    }

    if (currentBorrowCount >= maxAllowed) {
        return {
            allowed: false,
            error: `Độc giả đã đạt giới hạn mượn tối đa (${currentBorrowCount}/${maxAllowed} cuốn) theo hạng thành viên ${tier}. Vui lòng trả bớt sách trước khi mượn tiếp!`,
            status: 400
        };
    }

    return { allowed: true };
};

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

        // 1. Find an available physical copy (BookItem)
        let item = null;
        if (bookItemId) {
            item = await prisma.bookItem.findUnique({
                where: { id: Number(bookItemId) },
                include: { book: true }
            });
            if (!item || item.status !== 'AVAILABLE') {
                return res.status(400).json({ error: 'Cuốn sách này hiện không khả dụng' });
            }
        } else if (bookId) {
            item = await prisma.bookItem.findFirst({
                where: {
                    bookId: Number(bookId),
                    status: 'AVAILABLE'
                },
                include: { book: true }
            });
            if (!item) {
                return res.status(400).json({ error: 'Sách đã hết bản có sẵn' });
            }
        } else {
            return res.status(400).json({ error: 'Thiếu bookId hoặc bookItemId' });
        }

        // 2. Create Loan and update BookItem status
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 14 days loan period

        const [createdLoan] = await prisma.$transaction([
            prisma.loan.create({
                data: {
                    userId,
                    bookItemId: item.id,
                    borrowDate: new Date(),
                    dueDate,
                    status: 'BORROWING'
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
            }),
            prisma.bookItem.update({
                where: { id: item.id },
                data: { status: 'BORROWED' }
            })
        ]);

        res.json(formatLoanResponse(createdLoan));
    } catch (error) {
        console.error('Error borrowing book:', error);
        res.status(500).json({ error: 'Không thể mượn sách' });
    }
};

export const returnBook = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền thu hồi sách' });

        const { loanId } = req.body;
        if (!loanId) return res.status(400).json({ error: 'Thiếu mã phiếu mượn (loanId)' });

        const loan = await prisma.loan.findUnique({
            where: { id: Number(loanId) },
            include: { bookItem: true }
        });

        if (!loan || loan.returnDate !== null || loan.status === 'RETURNED' || loan.status === 'Returned') {
            return res.status(400).json({ error: 'Phiếu mượn không hợp lệ hoặc sách đã được trả' });
        }

        const [updatedLoan] = await prisma.$transaction([
            prisma.loan.update({
                where: { id: Number(loanId) },
                data: {
                    returnDate: new Date(),
                    status: 'RETURNED'
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
            }),
            prisma.bookItem.update({
                where: { id: loan.bookItemId },
                data: { status: 'AVAILABLE' }
            })
        ]);

        res.json(formatLoanResponse(updatedLoan));
    } catch (error) {
        console.error('Error returning book:', error);
        res.status(500).json({ error: 'Không thể thực hiện trả sách' });
    }
};

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

        res.json(loans.map(formatLoanResponse));
    } catch (error) {
        console.error('Error fetching user loans:', error);
        res.status(500).json({ error: 'Không thể tải danh sách mượn' });
    }
};

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

        res.json(loans.map(formatLoanResponse));
    } catch (error) {
        console.error('Error fetching all loans:', error);
        res.status(500).json({ error: 'Không thể tải danh sách mượn toàn hệ thống' });
    }
};

// =============================================
// Barcode Lookup – find BookItem by barcode
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
// Borrow by Barcode – scan barcode + specify borrower
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

        if (bookItem.status !== 'AVAILABLE') {
            return res.status(400).json({
                error: `Cuốn sách này đang ở trạng thái "${bookItem.status}", không thể cho mượn`
            });
        }

        // Check user exists and risk control
        const borrower = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!borrower) {
            return res.status(404).json({ error: 'Không tìm thấy độc giả' });
        }

        // --- KIỂM DUYỆT RỦI RO (Blacklist, Quá hạn, Hạn mức gói thành viên) ---
        const riskCheck = await validateBorrowRisk(Number(userId));
        if (!riskCheck.allowed) {
            return res.status(riskCheck.status || 400).json({ error: riskCheck.error });
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const [createdLoan] = await prisma.$transaction([
            prisma.loan.create({
                data: {
                    userId: Number(userId),
                    bookItemId: bookItem.id,
                    borrowDate: new Date(),
                    dueDate,
                    status: 'BORROWING'
                },
                include: {
                    bookItem: {
                        include: {
                            book: { include: { author: true, category: true } }
                        }
                    },
                    user: true
                }
            }),
            prisma.bookItem.update({
                where: { id: bookItem.id },
                data: { status: 'BORROWED' }
            })
        ]);

        res.json({
            message: `Cho mượn thành công: "${bookItem.book.title}" → ${borrower.name}`,
            loan: formatLoanResponse(createdLoan)
        });
    } catch (error) {
        console.error('Error borrowing by barcode:', error);
        res.status(500).json({ error: 'Không thể tạo phiếu mượn' });
    }
};

// =============================================
// Return by Barcode – scan barcode → auto return
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

        // Find the active loan for this physical copy
        const activeLoan = await prisma.loan.findFirst({
            where: {
                bookItemId: bookItem.id,
                returnDate: null
            },
            include: { user: true }
        });

        if (!activeLoan) {
            return res.status(400).json({ error: 'Cuốn sách này hiện không có phiếu mượn nào đang hoạt động' });
        }

        const [updatedLoan] = await prisma.$transaction([
            prisma.loan.update({
                where: { id: activeLoan.id },
                data: {
                    returnDate: new Date(),
                    status: 'RETURNED'
                },
                include: {
                    bookItem: {
                        include: {
                            book: { include: { author: true, category: true } }
                        }
                    },
                    user: true
                }
            }),
            prisma.bookItem.update({
                where: { id: bookItem.id },
                data: { status: 'AVAILABLE' }
            })
        ]);

        res.json({
            message: `Thu hồi thành công: "${bookItem.book.title}" từ ${activeLoan.user.name}`,
            loan: formatLoanResponse(updatedLoan)
        });
    } catch (error) {
        console.error('Error returning by barcode:', error);
        res.status(500).json({ error: 'Không thể thu hồi sách' });
    }
};

/**
 * Thủ thư chủ động kích hoạt quét & gửi email nhắc nhở trả sách ngay lập tức
 */
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

/**
 * Độc giả gia hạn sách (Renew Loan)
 * Điều kiện:
 * 1. Phiếu mượn phải còn đang mượn (chưa trả).
 * 2. Phiếu mượn không được quá hạn (Overdue).
 * 3. Không có độc giả khác đặt trước (Reservation WAITING / NOTIFIED) đối với cuốn sách này.
 * Cập nhật: Cộng thêm 7 ngày vào dueDate.
 */
export const renewLoan = async (req: AuthRequest, res: Response) => {
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

        // Kiểm tra quyền: Chỉ người mượn hoặc ADMIN mới được gia hạn
        if (loan.userId !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Bạn không có quyền gia hạn phiếu mượn này' });
        }

        // 1. Kiểm tra trạng thái đã trả chưa
        if (loan.returnDate || loan.status === 'RETURNED') {
            return res.status(400).json({ error: 'Phiếu mượn này đã được trả, không thể gia hạn' });
        }

        // 2. Kiểm tra sách đã quá hạn chưa
        const now = new Date();
        const dueDate = new Date(loan.dueDate);
        if (dueDate < now || loan.status === 'OVERDUE') {
            return res.status(400).json({ error: 'Không thể gia hạn sách đã quá hạn. Vui lòng mang sách đến thư viện để trả!' });
        }

        // 3. Kiểm tra xem sách có người khác đặt trước không
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

        // 4. Cộng thêm 7 ngày vào dueDate
        const newDueDate = new Date(loan.dueDate);
        newDueDate.setDate(newDueDate.getDate() + 7);

        const updatedLoan = await prisma.loan.update({
            where: { id: loanId },
            data: {
                dueDate: newDueDate,
                status: 'BORROWING'
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

        res.json({
            message: `Gia hạn thành công sách "${loan.bookItem.book.title}" thêm 7 ngày!`,
            loan: formatLoanResponse(updatedLoan)
        });
    } catch (error) {
        console.error('Error renewing loan:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi gia hạn sách' });
    }
};

/**
 * Thủ thư báo mất / hỏng sách và xử lý bồi thường (Report Lost Book)
 * 1. Nhận compensationAmount từ req.body.
 * 2. Cập nhật Loan: status = 'LOST', compensationAmount, returnDate = new Date().
 * 3. Cập nhật BookItem: status = 'LOST'.
 * 4. Trả về thông báo thành công cùng thông tin phiếu mượn cập nhật.
 */
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

        if (loan.status === 'LOST') {
            return res.status(400).json({ error: 'Phiếu mượn này đã được báo mất trước đó' });
        }

        const [updatedLoan] = await prisma.$transaction([
            prisma.loan.update({
                where: { id: loanId },
                data: {
                    status: 'LOST',
                    returnDate: new Date(),
                    compensationAmount: amount,
                    fineAmount: amount
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
            }),
            prisma.bookItem.update({
                where: { id: loan.bookItemId },
                data: {
                    status: 'LOST'
                }
            })
        ]);

        res.json({
            message: `Đã ghi nhận báo mất sách "${loan.bookItem.book.title}". Số tiền bồi thường: ${amount.toLocaleString('vi-VN')} VNĐ.`,
            loan: formatLoanResponse(updatedLoan)
        });
    } catch (error) {
        console.error('Error reporting lost book:', error);
        res.status(500).json({ error: 'Không thể xử lý báo mất sách' });
    }
};


