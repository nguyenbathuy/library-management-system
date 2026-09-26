import { Router } from 'express';
import { login, register, getMe, getAllUsers } from '../controllers/authController';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, authorizeAdmin, getAllUsers);

export default router;
