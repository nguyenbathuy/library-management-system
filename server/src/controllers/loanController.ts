import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Helper to compute display status and shape response for frontend
const formatLoanResponse = (loan: any) => {
    let uiStatus = 'On Time';
    if (loan.returnDate || loan.status === 'RETURNED' || loan.status === 'Returned') {
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

export const borrowBook = async (req: AuthRequest, res: Response) => {
    try {
        const { bookId, bookItemId } = req.body;
        const userId = req.user?.userId;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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

        // Check user exists
        const borrower = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!borrower) {
            return res.status(404).json({ error: 'Không tìm thấy độc giả' });
        }
        if (borrower.isBlacklisted) {
            return res.status(403).json({ error: 'Độc giả này đã bị chặn mượn sách' });
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
