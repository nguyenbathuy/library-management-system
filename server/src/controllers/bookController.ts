import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export const getBooks = async (req: Request, res: Response) => {
    try {
        const books = await prisma.book.findMany();
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Không thể tải danh sách sách' });
    }
};

export const createBook = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền thêm sách' });
        }

        const { title, author, isbn, category, copies, available } = req.body;

        // Validate required fields
        if (!title || !author || !isbn || !category) {
            return res.status(400).json({
                error: 'Thiếu thông tin bắt buộc: title, author, isbn, category'
            });
        }

        // Validate numbers
        if (copies && copies < 1) {
            return res.status(400).json({ error: 'Số lượng sách phải >= 1' });
        }
        if (available !== undefined && available < 0) {
            return res.status(400).json({ error: 'Số sách available phải >= 0' });
        }
        if (available > copies) {
            return res.status(400).json({ error: 'Số sách available không thể lớn hơn copies' });
        }

        const bookData = req.body;
        const book = await prisma.book.create({ data: bookData });
        res.status(201).json(book);
    } catch (error: any) {
        console.error('Error creating book:', error);
        if (error.code === 'P2002') {
            res.status(400).json({ error: 'ISBN đã tồn tại' });
        } else {
            res.status(500).json({ error: 'Không thể tạo sách mới' });
        }
    }
};

export const updateBook = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền sửa sách' });
        }

        const { id } = req.params;
        const bookData = req.body;

        // Validate ID
        const bookId = id as string;
        if (!bookId || isNaN(parseInt(bookId))) {
            return res.status(400).json({ error: 'ID sách không hợp lệ' });
        }

        // Validate numbers if provided
        if (bookData.copies && bookData.copies < 1) {
            return res.status(400).json({ error: 'Số lượng sách phải >= 1' });
        }
        if (bookData.available !== undefined && bookData.available < 0) {
            return res.status(400).json({ error: 'Số sách available phải >= 0' });
        }
        if (bookData.available > bookData.copies) {
            return res.status(400).json({ error: 'Số sách available không thể lớn hơn copies' });
        }

        const book = await prisma.book.update({
            where: { id: parseInt(bookId) },
            data: bookData
        });
        res.json(book);
    } catch (error: any) {
        console.error('Error updating book:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Không tìm thấy sách' });
        } else {
            res.status(500).json({ error: 'Không thể cập nhật sách' });
        }
    }
};

export const deleteBook = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền xóa sách' });
        }

        const { id } = req.params;

        // Validate ID
        const bookId = id as string;
        if (!bookId || isNaN(parseInt(bookId))) {
            return res.status(400).json({ error: 'ID sách không hợp lệ' });
        }

        // Check if book has active loans
        const activeLoans = await prisma.loan.count({
            where: {
                bookId: parseInt(bookId),
                returnDate: null
            }
        });

        if (activeLoans > 0) {
            return res.status(400).json({
                error: `Không thể xóa sách này vì đang có ${activeLoans} bản đang được mượn`
            });
        }

        await prisma.book.delete({ where: { id: parseInt(bookId) } });
        res.json({ message: 'Xóa sách thành công' });
    } catch (error: any) {
        console.error('Error deleting book:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Không tìm thấy sách' });
        } else {
            res.status(500).json({ error: 'Không thể xóa sách' });
        }
    }
};
