import { Router } from 'express';
import {
  getExpectedInventory,
  verifyInventory
} from '../controllers/inventoryController';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Tất cả endpoint kiểm kê yêu cầu quyền ADMIN
router.get('/expected', authenticateToken, authorizeAdmin, getExpectedInventory);
router.get('/expected-items', authenticateToken, authorizeAdmin, getExpectedInventory);
router.post('/verify', authenticateToken, authorizeAdmin, verifyInventory);

export default router;
