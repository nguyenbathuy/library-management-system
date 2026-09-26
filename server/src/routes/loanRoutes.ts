import { Router } from 'express';
import { borrowBook, returnBook, getMyLoans, getAllLoans } from '../controllers/loanController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/borrow', authenticateToken, borrowBook);
router.post('/return', authenticateToken, returnBook);
router.get('/my', authenticateToken, getMyLoans);
router.get('/all', authenticateToken, getAllLoans);

export default router;
