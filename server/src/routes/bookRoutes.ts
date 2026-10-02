import { Router } from 'express';
import {
  getBooks, createBook, updateBook, deleteBook, importBooks,
  uploadExcel, uploadEbook, uploadEbookHandler, getBookRecommendations,
  downloadImportTemplate
} from '../controllers/bookController';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth';

const router = Router();

router.get('/recommendations', optionalAuthenticateToken, getBookRecommendations);
router.get('/import-template', downloadImportTemplate);
router.get('/import/template', downloadImportTemplate);
router.get('/', getBooks);
router.post('/', authenticateToken, createBook);
router.put('/:id', authenticateToken, updateBook);
router.delete('/:id', authenticateToken, deleteBook);
router.post('/import', authenticateToken, uploadExcel, importBooks);
router.post('/upload-ebook', authenticateToken, uploadEbook, uploadEbookHandler);

export default router;
