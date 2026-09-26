import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const borrowBook = async (req: AuthRequest, res: Response) => {
    const { bookId } = req.body;
    const userId = req.user?.userId;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // 1. Check book availability
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book || book.available <= 0) {
        return res.status(400).json({ error: 'Book not available' });
    }

    // 2. Create Loan and Update Book
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 2 weeks

    const [loan] = await prisma.$transaction([
        prisma.loan.create({
            data: {
                userId,
                bookId,
                dueDate,
            }
        }),
        prisma.book.update({
            where: { id: bookId },
            data: { available: { decrement: 1 } }
        })
    ]);

    res.json(loan);
};

export const returnBook = async (req: AuthRequest, res: Response) => {
    // Admin only or User returns their own? Usually Admin processes return.
    // For simplicity, let's say Admin does it.
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Access denied' });

    const { loanId } = req.body;

    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan || loan.status === 'Returned') return res.status(400).json({ error: 'Invalid loan' });

    const [updatedLoan] = await prisma.$transaction([
        prisma.loan.update({
            where: { id: loanId },
            data: {
                returnDate: new Date(),
                status: 'Returned'
            }
        }),
        prisma.book.update({
            where: { id: loan.bookId },
            data: { available: { increment: 1 } }
        })
    ]);

    res.json(updatedLoan);
};

export const getMyLoans = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const loans = await prisma.loan.findMany({
        where: { userId },
        include: { book: true }
    });
    res.json(loans);
};

export const getAllLoans = async (req: AuthRequest, res: Response) => {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Access denied' });

    const loans = await prisma.loan.findMany({
        include: { book: true, user: true }
    });
    res.json(loans);
};
