import { Router } from 'express';
import { borrowBook, returnBook, getMyLoans, getAllLoans, lookupBarcode, borrowByBarcode, returnByBarcode } from '../controllers/loanController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/borrow', authenticateToken, borrowBook);
router.post('/return', authenticateToken, returnBook);
router.get('/my', authenticateToken, getMyLoans);
router.get('/all', authenticateToken, getAllLoans);

// Barcode-based operations
router.get('/barcode/:barcode', authenticateToken, lookupBarcode);
router.post('/borrow-by-barcode', authenticateToken, borrowByBarcode);
router.post('/return-by-barcode', authenticateToken, returnByBarcode);

export default router;
