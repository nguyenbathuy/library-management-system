import { Router } from 'express';
import {
  login,
  verifyOtp,
  resendLoginOtp,
  toggleTwoFactor,
  register,
  getMe,
  getAllUsers,
  toggleBlacklist,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendLoginOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, authorizeAdmin, getAllUsers);
router.patch('/users/:id/blacklist', authenticateToken, authorizeAdmin, toggleBlacklist);
router.patch('/toggle-2fa', authenticateToken, toggleTwoFactor);
router.put('/change-password', authenticateToken, changePassword);

export default router;

