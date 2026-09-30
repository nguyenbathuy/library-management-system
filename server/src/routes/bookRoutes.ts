import { Router } from 'express';
import { getBooks, createBook, updateBook, deleteBook, importBooks, uploadExcel } from '../controllers/bookController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', getBooks);
router.post('/', authenticateToken, createBook);
router.put('/:id', authenticateToken, updateBook);
router.delete('/:id', authenticateToken, deleteBook);
router.post('/import', authenticateToken, uploadExcel, importBooks);

export default router;
