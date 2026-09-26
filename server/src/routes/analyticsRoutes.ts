import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
    getStats,
    getBorrowTrends,
    getTopBooks,
    getRecentActivity
} from '../controllers/analyticsController';

const router = Router();

router.get('/stats', authenticateToken, getStats);
router.get('/borrow-trends', authenticateToken, getBorrowTrends);
router.get('/top-books', authenticateToken, getTopBooks);
router.get('/recent-activity', authenticateToken, getRecentActivity);

export default router;
