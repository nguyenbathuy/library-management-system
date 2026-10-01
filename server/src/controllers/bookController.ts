import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import * as XLSX from 'xlsx';
import multer from 'multer';

const prisma = new PrismaClient();

// Multer config – store file in memory (no disk write needed)
const storage = multer.memoryStorage();
export const uploadExcel = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('file');


// Helper to format book for API & frontend compatibility
const formatBookResponse = (book: any) => {
  const items = book.items || [];
  const copies = items.length;
  const available = items.filter((item: any) => item.status === 'AVAILABLE').length;

  return {
    id: book.id,
    title: book.title,
    isbn: book.isbn,
    author: book.author?.name || '',
    category: book.category?.name || '',
    publisher: book.publisher?.name || '',
    publishedYear: book.publishedYear,
    pageCount: book.pageCount,
    language: book.language,
    description: book.description,
    coverImage: book.coverImage,
    copies,
    available,
    status: available > 0 ? 'Available' : 'Borrowed',
    items: items.map((item: any) => ({
      id: item.id,
      barcode: item.barcode,
      location: item.location,
      status: item.status
    })),
    authorId: book.authorId,
    categoryId: book.categoryId,
    publisherId: book.publisherId,
  };
};

export const getBooks = async (_req: Request, res: Response) => {
  try {
    const books = await prisma.book.findMany({
      include: {
        category: true,
        author: true,
        publisher: true,
        items: true,
      },
      orderBy: { id: 'asc' }
    });

    res.json(books.map(formatBookResponse));
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Không thể tải danh sách sách' });
  }
};

export const createBook = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền thêm sách' });
    }

    const {
      title,
      author,
      isbn,
      category,
      publisher,
      publishedYear,
      pageCount,
      language,
      description,
      coverImage,
      copies = 1,
      available
    } = req.body;

    // Validate required fields
    if (!title || !author || !isbn || !category) {
      return res.status(400).json({
        error: 'Thiếu thông tin bắt buộc: title, author, isbn, category'
      });
    }

    const copiesNum = Number(copies) || 1;
    const availableNum = available !== undefined ? Number(available) : copiesNum;

    // Validate numbers
    if (copiesNum < 1) {
      return res.status(400).json({ error: 'Số lượng sách phải >= 1' });
    }
    if (availableNum < 0) {
      return res.status(400).json({ error: 'Số sách available phải >= 0' });
    }
    if (availableNum > copiesNum) {
      return res.status(400).json({ error: 'Số sách available không thể lớn hơn copies' });
    }

    // Upsert Category
    const catRecord = await prisma.category.upsert({
      where: { name: String(category).trim() },
      update: {},
      create: { name: String(category).trim() }
    });

    // Upsert Author
    const authorRecord = await prisma.author.upsert({
      where: { name: String(author).trim() },
      update: {},
      create: { name: String(author).trim() }
    });

    // Upsert Publisher if provided
    let publisherRecord = null;
    if (publisher && String(publisher).trim()) {
      publisherRecord = await prisma.publisher.upsert({
        where: { name: String(publisher).trim() },
        update: {},
        create: { name: String(publisher).trim() }
      });
    }

    // Create Book
    const book = await prisma.book.create({
      data: {
        title: String(title).trim(),
        isbn: String(isbn).trim(),
        categoryId: catRecord.id,
        authorId: authorRecord.id,
        publisherId: publisherRecord ? publisherRecord.id : null,
        publishedYear: publishedYear ? String(publishedYear) : null,
        pageCount: pageCount ? Number(pageCount) : null,
        language: language ? String(language) : 'Tiếng Việt',
        description: description || null,
        coverImage: coverImage || null,
      }
    });

    // Create BookItems (physical copies)
    const cleanIsbn = String(isbn).replace(/[^0-9]/g, '').slice(-6) || String(book.id);
    for (let i = 0; i < copiesNum; i++) {
      const isAvail = i < availableNum;
      await prisma.bookItem.create({
        data: {
          bookId: book.id,
          barcode: `BC-${cleanIsbn}-${String(i + 1).padStart(3, '0')}`,
          location: 'Khu A - Kệ 1',
          status: isAvail ? 'AVAILABLE' : 'BORROWED'
        }
      });
    }

    const createdBookWithRelations = await prisma.book.findUnique({
      where: { id: book.id },
      include: {
        category: true,
        author: true,
        publisher: true,
        items: true,
      }
    });

    res.status(201).json(formatBookResponse(createdBookWithRelations));
  } catch (error: any) {
    console.error('Error creating book:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'ISBN đã tồn tại' });
    } else {
      res.status(500).json({ error: 'Không thể tạo sách mới' });
    }
  }
};

export const updateBook = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền sửa sách' });
    }

    const { id } = req.params;
    const bookId = parseInt(id as string);
    if (isNaN(bookId)) {
      return res.status(400).json({ error: 'ID sách không hợp lệ' });
    }

    const existingBook = await prisma.book.findUnique({
      where: { id: bookId },
      include: { items: true }
    });

    if (!existingBook) {
      return res.status(404).json({ error: 'Không tìm thấy sách' });
    }

    const {
      title,
      author,
      isbn,
      category,
      publisher,
      publishedYear,
      pageCount,
      language,
      description,
      coverImage,
      copies
    } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (isbn !== undefined) updateData.isbn = String(isbn).trim();
    if (publishedYear !== undefined) updateData.publishedYear = publishedYear ? String(publishedYear) : null;
    if (pageCount !== undefined) updateData.pageCount = pageCount ? Number(pageCount) : null;
    if (language !== undefined) updateData.language = language ? String(language) : null;
    if (description !== undefined) updateData.description = description;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    if (category) {
      const cat = await prisma.category.upsert({
        where: { name: String(category).trim() },
        update: {},
        create: { name: String(category).trim() }
      });
      updateData.categoryId = cat.id;
    }

    if (author) {
      const auth = await prisma.author.upsert({
        where: { name: String(author).trim() },
        update: {},
        create: { name: String(author).trim() }
      });
      updateData.authorId = auth.id;
    }

    if (publisher !== undefined) {
      if (publisher) {
        const pub = await prisma.publisher.upsert({
          where: { name: String(publisher).trim() },
          update: {},
          create: { name: String(publisher).trim() }
        });
        updateData.publisherId = pub.id;
      } else {
        updateData.publisherId = null;
      }
    }

    await prisma.book.update({
      where: { id: bookId },
      data: updateData
    });

    // If copies count changed, adjust BookItems
    if (copies !== undefined && Number(copies) > 0) {
      const currentCount = existingBook.items.length;
      const targetCount = Number(copies);
      if (targetCount > currentCount) {
        const cleanIsbn = (isbn || existingBook.isbn).replace(/[^0-9]/g, '').slice(-6);
        for (let i = currentCount; i < targetCount; i++) {
          await prisma.bookItem.create({
            data: {
              bookId,
              barcode: `BC-${cleanIsbn}-${String(i + 1).padStart(3, '0')}`,
              location: 'Khu A - Kệ 1',
              status: 'AVAILABLE'
            }
          });
        }
      }
    }

    const updatedBookWithRelations = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        category: true,
        author: true,
        publisher: true,
        items: true,
      }
    });

    res.json(formatBookResponse(updatedBookWithRelations));
  } catch (error: any) {
    console.error('Error updating book:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Không tìm thấy sách' });
    } else if (error.code === 'P2002') {
      res.status(400).json({ error: 'ISBN đã tồn tại' });
    } else {
      res.status(500).json({ error: 'Không thể cập nhật sách' });
    }
  }
};

export const deleteBook = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền xóa sách' });
    }

    const { id } = req.params;
    const bookId = parseInt(id as string);
    if (isNaN(bookId)) {
      return res.status(400).json({ error: 'ID sách không hợp lệ' });
    }

    // Check if any physical copy is currently borrowed
    const borrowedCount = await prisma.bookItem.count({
      where: {
        bookId,
        status: 'BORROWED'
      }
    });

    if (borrowedCount > 0) {
      return res.status(400).json({
        error: `Không thể xóa sách này vì đang có ${borrowedCount} cuốn đang được mượn`
      });
    }

    // Cascade delete related records
    const items = await prisma.bookItem.findMany({
      where: { bookId },
      select: { id: true }
    });
    const itemIds = items.map(i => i.id);

    if (itemIds.length > 0) {
      await prisma.loan.deleteMany({
        where: { bookItemId: { in: itemIds } }
      });
      await prisma.bookItem.deleteMany({
        where: { bookId }
      });
    }

    await prisma.reservation.deleteMany({
      where: { bookId }
    });

    await prisma.book.delete({ where: { id: bookId } });
    res.json({ message: 'Xóa sách thành công' });
  } catch (error: any) {
    console.error('Error deleting book:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Không tìm thấy sách' });
    } else {
      res.status(500).json({ error: 'Không thể xóa sách' });
    }
  }
};

// =============================================
// Import Books from Excel
// =============================================
export const importBooks = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền import sách' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file Excel để tải lên' });
    }

    // Read the uploaded Excel file from memory buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'File Excel không có sheet nào' });
    }

    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'File Excel trống, không có dữ liệu để import' });
    }

    // Column name mapping – supports both Vietnamese and English headers
    const colMap: Record<string, string> = {
      'tiêu đề': 'title', 'tieu de': 'title', 'title': 'title', 'tên sách': 'title', 'ten sach': 'title',
      'tác giả': 'author', 'tac gia': 'author', 'author': 'author',
      'isbn': 'isbn',
      'thể loại': 'category', 'the loai': 'category', 'category': 'category',
      'số lượng': 'copies', 'so luong': 'copies', 'copies': 'copies',
      'nhà xuất bản': 'publisher', 'nha xuat ban': 'publisher', 'publisher': 'publisher',
      'năm xuất bản': 'publishedYear', 'nam xuat ban': 'publishedYear', 'publishedyear': 'publishedYear', 'year': 'publishedYear',
      'số trang': 'pageCount', 'so trang': 'pageCount', 'pagecount': 'pageCount', 'pages': 'pageCount',
      'ngôn ngữ': 'language', 'ngon ngu': 'language', 'language': 'language',
      'mô tả': 'description', 'mo ta': 'description', 'description': 'description',
      'ảnh bìa': 'coverImage', 'anh bia': 'coverImage', 'coverimage': 'coverImage', 'cover': 'coverImage',
    };

    const normalizeKey = (key: string): string => {
      const normalized = key.trim().toLowerCase();
      return colMap[normalized] || normalized;
    };

    const imported: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const rowNum = i + 2; // Excel row (1-indexed header + 1)

      // Map raw keys to normalized keys
      const row: Record<string, any> = {};
      for (const key of Object.keys(raw)) {
        row[normalizeKey(key)] = raw[key];
      }

      const title = row.title ? String(row.title).trim() : '';
      const author = row.author ? String(row.author).trim() : '';
      const isbn = row.isbn ? String(row.isbn).trim() : '';
      const category = row.category ? String(row.category).trim() : '';
      const copies = Math.max(1, parseInt(row.copies) || 1);

      if (!title || !author || !isbn || !category) {
        errors.push(`Dòng ${rowNum}: Thiếu trường bắt buộc (Tiêu đề, Tác giả, ISBN, Thể loại)`);
        continue;
      }

      try {
        // Check for duplicate ISBN
        const existingBook = await prisma.book.findUnique({ where: { isbn } });
        if (existingBook) {
          errors.push(`Dòng ${rowNum}: ISBN "${isbn}" đã tồn tại (${existingBook.title})`);
          continue;
        }

        // Upsert Category
        const catRecord = await prisma.category.upsert({
          where: { name: category },
          update: {},
          create: { name: category }
        });

        // Upsert Author
        const authorRecord = await prisma.author.upsert({
          where: { name: author },
          update: {},
          create: { name: author }
        });

        // Upsert Publisher
        let publisherRecord = null;
        const publisherName = row.publisher ? String(row.publisher).trim() : '';
        if (publisherName) {
          publisherRecord = await prisma.publisher.upsert({
            where: { name: publisherName },
            update: {},
            create: { name: publisherName }
          });
        }

        // Create Book
        const book = await prisma.book.create({
          data: {
            title,
            isbn,
            categoryId: catRecord.id,
            authorId: authorRecord.id,
            publisherId: publisherRecord ? publisherRecord.id : null,
            publishedYear: row.publishedYear ? String(row.publishedYear) : null,
            pageCount: row.pageCount ? Number(row.pageCount) : null,
            language: row.language ? String(row.language).trim() : 'Tiếng Việt',
            description: row.description ? String(row.description).trim() : null,
            coverImage: row.coverImage ? String(row.coverImage).trim() : null,
          }
        });

        // Create BookItems (physical copies)
        const cleanIsbn = isbn.replace(/[^0-9]/g, '').slice(-6) || String(book.id);
        for (let j = 0; j < copies; j++) {
          await prisma.bookItem.create({
            data: {
              bookId: book.id,
              barcode: `BC-${cleanIsbn}-${String(j + 1).padStart(3, '0')}`,
              location: 'Khu A - Kệ 1',
              status: 'AVAILABLE'
            }
          });
        }

        imported.push(`"${title}" (${copies} cuốn)`);
      } catch (err: any) {
        errors.push(`Dòng ${rowNum}: Lỗi tạo "${title}" – ${err.message || 'Unknown error'}`);
      }
    }

    // Audit log
    if (imported.length > 0) {
      await prisma.auditLog.create({
        data: {
          action: 'IMPORT_EXCEL',
          adminId: req.user!.userId,
          details: JSON.stringify({
            fileName: req.file.originalname,
            totalRows: rows.length,
            imported: imported.length,
            errors: errors.length,
          })
        }
      });
    }

    res.json({
      message: `Import thành công ${imported.length}/${rows.length} sách`,
      imported,
      errors,
      totalRows: rows.length,
    });
  } catch (error: any) {
    console.error('Error importing books:', error);
    res.status(500).json({ error: error.message || 'Không thể import sách từ file Excel' });
  }
};
