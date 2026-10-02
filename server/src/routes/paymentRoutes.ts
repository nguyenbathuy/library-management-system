import { Router } from 'express';
import {
  createPaymentUrl,
  getPaymentDetails,
  paymentCallback
} from '../controllers/paymentController';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';

const router = Router();

router.post('/create-url', authenticateToken, createPaymentUrl);
router.get('/details/:loanId', optionalAuthenticateToken, getPaymentDetails);
router.post('/callback', optionalAuthenticateToken, paymentCallback);
router.get('/callback', optionalAuthenticateToken, paymentCallback);

export default router;
