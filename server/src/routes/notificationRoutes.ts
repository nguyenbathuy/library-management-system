import { Router } from 'express';
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Tất cả các route thông báo đều yêu cầu đăng nhập
router.use(authenticateToken);

router.get('/', getMyNotifications);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markNotificationAsRead);
router.delete('/clear-all', clearAllNotifications);
router.delete('/:id', deleteNotification);

export default router;
