import { Router } from 'express';
import {
    borrowBook, returnBook, getMyLoans, getAllLoans,
    lookupBarcode, borrowByBarcode, returnByBarcode,
    triggerReminders, renewLoan, reportLost
} from '../controllers/loanController';
import { authenticateToken, authorizeAdmin } from '../middleware/auth';

const router = Router();

router.post('/borrow', authenticateToken, borrowBook);
router.post('/return', authenticateToken, returnBook);
router.post('/:id/renew', authenticateToken, renewLoan);
router.post('/:id/report-lost', authenticateToken, authorizeAdmin, reportLost);
router.get('/my', authenticateToken, getMyLoans);
router.get('/all', authenticateToken, getAllLoans);

// Barcode-based operations
router.get('/barcode/:barcode', authenticateToken, lookupBarcode);
router.post('/borrow-by-barcode', authenticateToken, borrowByBarcode);
router.post('/return-by-barcode', authenticateToken, returnByBarcode);

// Trigger email reminders on demand (Admin only)
router.post('/reminders/trigger', authenticateToken, authorizeAdmin, triggerReminders);

export default router;
