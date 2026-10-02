import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

/**
 * Lấy danh sách tất cả thông báo của người dùng đang đăng nhập
 */
export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Lấy tối đa 50 thông báo gần nhất
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Không thể lấy danh sách thông báo' });
  }
};

/**
 * Đánh dấu một thông báo là đã đọc
 */
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id: Number(id) },
    });

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }

    const updated = await prisma.notification.update({
      where: { id: Number(id) },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Không thể cập nhật trạng thái thông báo' });
  }
};

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc
 */
export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Không thể đánh dấu tất cả thông báo' });
  }
};

/**
 * Xóa một thông báo theo ID
 */
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id: Number(id) },
    });

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }

    await prisma.notification.delete({
      where: { id: Number(id) },
    });

    res.json({ message: 'Đã xóa thông báo thành công' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Không thể xóa thông báo' });
  }
};

/**
 * Xóa toàn bộ thông báo của người dùng
 */
export const clearAllNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    await prisma.notification.deleteMany({
      where: { userId },
    });

    res.json({ message: 'Đã dọn dẹp sạch toàn bộ thông báo' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Không thể xóa danh sách thông báo' });
  }
};
