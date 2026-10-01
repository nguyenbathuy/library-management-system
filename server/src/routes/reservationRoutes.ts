import { Router } from 'express';
import {
    createReservation,
    getAllReservations,
    getMyReservations,
    updateReservationStatus,
    cancelReservation
} from '../controllers/reservationController';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Độc giả tạo yêu cầu đặt trước khi hết sách
router.post('/', authenticateToken, createReservation);

// Độc giả xem danh sách đặt trước của bản thân
router.get('/my', authenticateToken, getMyReservations);

// Thủ thư xem tất cả danh sách đặt trước
router.get('/all', authenticateToken, authorizeAdmin, getAllReservations);

// Thủ thư cập nhật trạng thái (WAITING -> NOTIFIED -> FULFILLED / CANCELLED)
router.patch('/:id/status', authenticateToken, authorizeAdmin, updateReservationStatus);

// Độc giả hoặc Thủ thư hủy đặt trước
router.delete('/:id', authenticateToken, cancelReservation);

export default router;
