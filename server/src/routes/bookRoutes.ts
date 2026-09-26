import { Router } from 'express';
import { getBooks, createBook, updateBook, deleteBook } from '../controllers/bookController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', getBooks);
router.post('/', authenticateToken, createBook);
router.put('/:id', authenticateToken, updateBook);
router.delete('/:id', authenticateToken, deleteBook);

export default router;
