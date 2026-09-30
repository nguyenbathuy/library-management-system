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
