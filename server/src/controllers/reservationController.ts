import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

// Helper to format reservation response
const formatReservationResponse = (reservation: any) => {
    return {
        id: reservation.id,
        userId: reservation.userId,
        bookId: reservation.bookId,
        status: reservation.status, // WAITING, NOTIFIED, FULFILLED, CANCELLED
        createdAt: reservation.createdAt,
        user: reservation.user ? {
            id: reservation.user.id,
            name: reservation.user.name,
            email: reservation.user.email,
            membershipTier: reservation.user.membershipTier
        } : null,
        book: reservation.book ? {
            id: reservation.book.id,
            title: reservation.book.title,
            isbn: reservation.book.isbn,
            author: reservation.book.author?.name || '',
            category: reservation.book.category?.name || '',
            coverImage: reservation.book.coverImage,
            available: reservation.book.items
                ? reservation.book.items.filter((i: any) => i.status === 'AVAILABLE').length
                : 0,
            totalCopies: reservation.book.items ? reservation.book.items.length : 0
        } : null
    };
};

/**
 * Độc giả tạo bản ghi đặt trước (Reservation) khi đầu sách không còn bản sao nào trống
 */
export const createReservation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Vui lòng đăng nhập để đặt trước sách' });
        }

        const { bookId } = req.body;
        if (!bookId) {
            return res.status(400).json({ error: 'Thiếu thông tin mã sách (bookId)' });
        }

        // 1. Kiểm tra sách có tồn tại không
        const book = await prisma.book.findUnique({
            where: { id: Number(bookId) },
            include: {
                items: true,
                author: true,
                category: true
            }
        });

        if (!book) {
            return res.status(404).json({ error: 'Không tìm thấy đầu sách này' });
        }

        // 2. Kiểm tra số lượng bản sao khả dụng (AVAILABLE)
        const availableItemsCount = await prisma.bookItem.count({
            where: {
                bookId: Number(bookId),
                status: 'AVAILABLE'
            }
        });

        if (availableItemsCount > 0) {
            return res.status(400).json({
                error: 'Đầu sách này hiện vẫn còn bản sao có sẵn trong kho. Bạn có thể mượn trực tiếp mà không cần đặt trước.'
            });
        }

        // 3. Kiểm tra xem độc giả đã đặt trước sách này và đang đợi chưa
        const existingReservation = await prisma.reservation.findFirst({
            where: {
                userId,
                bookId: Number(bookId),
                status: {
                    in: ['WAITING', 'NOTIFIED']
                }
            }
        });

        if (existingReservation) {
            return res.status(400).json({
                error: 'Bạn đã đăng ký đặt trước đầu sách này rồi (Trạng thái: ' +
                    (existingReservation.status === 'NOTIFIED' ? 'Đã có sách, đang chờ bạn đến nhận' : 'Đang chờ sách') +
                    ').'
            });
        }

        // 4. Kiểm tra xem độc giả hiện có đang giữ mượn cuốn sách này không
        const activeLoan = await prisma.loan.findFirst({
            where: {
                userId,
                returnDate: null,
                bookItem: {
                    bookId: Number(bookId)
                }
            }
        });

        if (activeLoan) {
            return res.status(400).json({
                error: 'Bạn đang mượn một bản sao của cuốn sách này rồi.'
            });
        }

        // 5. Tạo bản ghi đặt trước
        const newReservation = await prisma.reservation.create({
            data: {
                userId,
                bookId: Number(bookId),
                status: 'WAITING'
            },
            include: {
                user: true,
                book: {
                    include: {
                        author: true,
                        category: true,
                        items: true
                    }
                }
            }
        });

        // Đếm số thứ tự đang chờ trước mình
        const queuePosition = await prisma.reservation.count({
            where: {
                bookId: Number(bookId),
                status: 'WAITING'
            }
        });

        res.status(201).json({
            message: `Đặt trước thành công! Bạn đang ở vị trí thứ ${queuePosition} trong danh sách chờ nhận sách "${book.title}".`,
            reservation: formatReservationResponse(newReservation),
            queuePosition
        });
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: 'Không thể tạo yêu cầu đặt trước sách' });
    }
};

/**
 * Lấy tất cả yêu cầu đặt trước (Dành cho Thủ thư / Admin)
 */
export const getAllReservations = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền xem danh sách đặt trước toàn hệ thống' });
        }

        const { status } = req.query;

        const whereCondition: any = {};
        if (status && typeof status === 'string' && status !== 'ALL') {
            whereCondition.status = status;
        }

        const reservations = await prisma.reservation.findMany({
            where: whereCondition,
            include: {
                user: true,
                book: {
                    include: {
                        author: true,
                        category: true,
                        items: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(reservations.map(formatReservationResponse));
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ error: 'Không thể tải danh sách đặt trước' });
    }
};

/**
 * Lấy danh sách đặt trước của độc giả hiện tại
 */
export const getMyReservations = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const reservations = await prisma.reservation.findMany({
            where: { userId },
            include: {
                book: {
                    include: {
                        author: true,
                        category: true,
                        items: true
                    }
                },
                user: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(reservations.map(formatReservationResponse));
    } catch (error) {
        console.error('Error fetching user reservations:', error);
        res.status(500).json({ error: 'Không thể tải danh sách đặt trước của bạn' });
    }
};

/**
 * Cập nhật trạng thái đặt trước (Thủ thư thông báo, hoàn tất nhận sách, hoặc hủy)
 */
export const updateReservationStatus = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Chỉ thủ thư mới có quyền cập nhật trạng thái đặt trước' });
        }

        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['WAITING', 'NOTIFIED', 'FULFILLED', 'CANCELLED'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                error: `Trạng thái không hợp lệ. Phải là một trong các giá trị: ${validStatuses.join(', ')}`
            });
        }

        const existing = await prisma.reservation.findUnique({
            where: { id: Number(id) }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Không tìm thấy bản ghi đặt trước này' });
        }

        const updated = await prisma.reservation.update({
            where: { id: Number(id) },
            data: { status },
            include: {
                user: true,
                book: {
                    include: {
                        author: true,
                        category: true,
                        items: true
                    }
                }
            }
        });

        res.json({
            message: 'Cập nhật trạng thái đặt trước thành công',
            reservation: formatReservationResponse(updated)
        });
    } catch (error) {
        console.error('Error updating reservation status:', error);
        res.status(500).json({ error: 'Không thể cập nhật trạng thái đặt trước' });
    }
};

/**
 * Hủy đặt trước sách (Độc giả tự hủy hoặc Thủ thư hủy)
 */
export const cancelReservation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const reservation = await prisma.reservation.findUnique({
            where: { id: Number(id) }
        });

        if (!reservation) {
            return res.status(404).json({ error: 'Không tìm thấy bản ghi đặt trước' });
        }

        // Độc giả chỉ được hủy của chính mình, thủ thư được hủy tất cả
        if (role !== 'ADMIN' && reservation.userId !== userId) {
            return res.status(403).json({ error: 'Bạn không có quyền hủy bản ghi này' });
        }

        const updated = await prisma.reservation.update({
            where: { id: Number(id) },
            data: { status: 'CANCELLED' }
        });

        res.json({
            message: 'Đã hủy đặt trước sách thành công',
            reservation: updated
        });
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        res.status(500).json({ error: 'Không thể hủy yêu cầu đặt trước' });
    }
};
