import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Get overall statistics
export const getStats = async (req: AuthRequest, res: Response) => {
    try {
        const totalBooks = await prisma.book.count();

        const totalBorrowed = await prisma.loan.count({
            where: { returnDate: null }
        });

        const activeUsers = await prisma.user.count({
            where: {
                loans: {
                    some: {
                        returnDate: null
                    }
                }
            }
        });

        const overdueBooks = await prisma.loan.count({
            where: {
                returnDate: null,
                dueDate: {
                    lt: new Date()
                }
            }
        });

        res.json({
            totalBooks,
            activeUsers,
            totalBorrowed,
            overdueBooks
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Không thể tải thống kê' });
    }
};

// Get borrow trends by month
export const getBorrowTrends = async (req: AuthRequest, res: Response) => {
    try {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        const loans = await prisma.loan.findMany({
            where: {
                borrowDate: {
                    gte: new Date(`${year}-01-01`),
                    lte: new Date(`${year}-12-31`)
                }
            },
            select: {
                borrowDate: true
            }
        });

        // Group by month
        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            count: 0
        }));

        loans.forEach(loan => {
            const month = new Date(loan.borrowDate).getMonth();
            monthlyData[month].count++;
        });

        res.json(monthlyData);
    } catch (error) {
        console.error('Error fetching borrow trends:', error);
        res.status(500).json({ error: 'Không thể tải xu hướng mượn sách' });
    }
};

// Get top borrowed books
export const getTopBooks = async (req: AuthRequest, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 5;

        const topBooks = await prisma.loan.groupBy({
            by: ['bookId'],
            _count: {
                bookId: true
            },
            orderBy: {
                _count: {
                    bookId: 'desc'
                }
            },
            take: limit
        });

        // Fetch book details
        const booksWithDetails = await Promise.all(
            topBooks.map(async (item) => {
                const book = await prisma.book.findUnique({
                    where: { id: item.bookId }
                });
                return {
                    ...book,
                    borrowCount: item._count.bookId
                };
            })
        );

        res.json(booksWithDetails);
    } catch (error) {
        console.error('Error fetching top books:', error);
        res.status(500).json({ error: 'Không thể tải sách phổ biến' });
    }
};

// Get recent loan activities
export const getRecentActivity = async (req: AuthRequest, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;

        const recentLoans = await prisma.loan.findMany({
            take: limit,
            orderBy: {
                borrowDate: 'desc'
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                book: {
                    select: {
                        title: true
                    }
                }
            }
        });

        const activities = recentLoans.map(loan => ({
            id: loan.id,
            userName: loan.user.name,
            bookTitle: loan.book.title,
            action: loan.returnDate ? 'returned' : 'borrowed',
            date: loan.returnDate || loan.borrowDate,
            borrowDate: loan.borrowDate,
            returnDate: loan.returnDate
        }));

        res.json(activities);
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({ error: 'Không thể tải hoạt động gần đây' });
    }
};
