import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tạo một bản ghi thông báo (Notification) mới cho người dùng
 */
export const createNotification = async (params: {
  userId: number;
  title: string;
  message: string;
}) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        isRead: false,
      },
    });
    return notification;
  } catch (error) {
    console.error('[NotificationService] Lỗi tạo thông báo:', error);
    return null;
  }
};
