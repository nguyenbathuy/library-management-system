import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import * as XLSX from 'xlsx';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

// Multer config for E-books (.pdf, .epub)
const ebookUploadDir = path.join(__dirname, '../../public/uploads/ebooks');
if (!fs.existsSync(ebookUploadDir)) {
  fs.mkdirSync(ebookUploadDir, { recursive: true });
}

const ebookStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ebookUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `ebook-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  }
});

export const uploadEbook = multer({
  storage: ebookStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.epub'].includes(ext) || file.mimetype === 'application/pdf' || file.mimetype === 'application/epub+zip') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận định dạng file .pdf hoặc .epub'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
}).single('file');

export const uploadEbookHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ thủ thư/admin mới có quyền tải lên sách điện tử' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file PDF hoặc EPUB' });
    }

    const ebookUrl = `/uploads/ebooks/${req.file.filename}`;
    res.json({
      message: 'Tải lên sách điện tử thành công',
      ebookUrl,
      fileName: req.file.originalname,
      size: req.file.size
    });
  } catch (error: any) {
    console.error('Error uploading ebook:', error);
    res.status(500).json({ error: error.message || 'Không thể tải lên file e-book' });
  }
};

// Helper to format book for API & frontend compatibility
const formatBookResponse = (book: any) => {
  const items = book.items || [];
  const copies = items.length;
  const available = items.filter((item: any) => String(item.status).toUpperCase() === 'AVAILABLE').length;

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
    ebookUrl: book.ebookUrl || null,
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
      ebookUrl,
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

    const trimmedTitle = String(title).trim();
    const trimmedAuthor = String(author).trim();
    const trimmedIsbn = isbn ? String(isbn).trim() : '';
    const trimmedCategory = String(category).trim();
    const trimmedPublisher = publisher && String(publisher).trim() ? String(publisher).trim() : null;

    // Upsert Category
    const catRecord = await prisma.category.upsert({
      where: { name: trimmedCategory },
      update: {},
      create: { name: trimmedCategory }
    });

    // Upsert Author
    const authorRecord = await prisma.author.upsert({
      where: { name: trimmedAuthor },
      update: {},
      create: { name: trimmedAuthor }
    });

    // Upsert Publisher if provided
    let publisherRecord = null;
    if (trimmedPublisher) {
      publisherRecord = await prisma.publisher.upsert({
        where: { name: trimmedPublisher },
        update: {},
        create: { name: trimmedPublisher }
      });
    }

    // --- TỰ ĐỘNG GỘP KHO (Smart Inventory Merge) ---
    // Kiểm tra xem sách đã tồn tại chưa: Ưu tiên trùng ISBN (nếu có) HOẶC trùng cả title và authorId
    const existingBook = await prisma.book.findFirst({
      where: {
        OR: [
          ...(trimmedIsbn ? [{ isbn: trimmedIsbn }] : []),
          {
            title: trimmedTitle,
            authorId: authorRecord.id
          }
        ]
      },
      include: {
        category: true,
        author: true,
        publisher: true,
        items: true,
      }
    });

    // =========================================================================
    // KỊCH BẢN 2: Sách đã tồn tại trong hệ thống -> TỰ ĐỘNG CỘNG GỘP KHO (MERGE)
    // =========================================================================
    if (existingBook) {
      const cleanIsbn = String(existingBook.isbn).replace(/[^0-9]/g, '').slice(-6) || 'BOOK';

      const updatedBookWithRelations = await prisma.$transaction(async (tx) => {
        let indexCounter = existingBook.items.length + 1;
        for (let i = 0; i < copiesNum; i++) {
          let candidateBarcode = `BC-${cleanIsbn}-${String(indexCounter).padStart(3, '0')}`;
          // Kiểm tra để barcode tuyệt đối không bao giờ bị trùng lặp
          while (await tx.bookItem.findUnique({ where: { barcode: candidateBarcode } })) {
            indexCounter++;
            candidateBarcode = `BC-${cleanIsbn}-${String(indexCounter).padStart(3, '0')}`;
          }

          await tx.bookItem.create({
            data: {
              bookId: existingBook.id,
              barcode: candidateBarcode,
              location: 'Khu A - Kệ 1',
              status: 'AVAILABLE' // Luôn sẵn sàng trên kệ
            }
          });
          indexCounter++;
        }

        return await tx.book.findUnique({
          where: { id: existingBook.id },
          include: {
            category: true,
            author: true,
            publisher: true,
            items: true,
          }
        });
      });

      return res.status(200).json({
        message: `Sách đã tồn tại. Tự động cộng gộp thêm ${copiesNum} bản sao vào kho`,
        isMerged: true,
        ...formatBookResponse(updatedBookWithRelations)
      });
    }

    // =========================================================================
    // KỊCH BẢN 1: Chưa tồn tại -> TẠO MỚI HOÀN TOÀN BẢN GHI BOOK VÀ BẢN SAO
    // =========================================================================
    const cleanIsbn = String(trimmedIsbn).replace(/[^0-9]/g, '').slice(-6) || 'BOOK';

    const createdBookWithRelations = await prisma.$transaction(async (tx) => {
      const newBook = await tx.book.create({
        data: {
          title: trimmedTitle,
          isbn: trimmedIsbn,
          categoryId: catRecord.id,
          authorId: authorRecord.id,
          publisherId: publisherRecord ? publisherRecord.id : null,
          publishedYear: publishedYear ? String(publishedYear) : null,
          pageCount: pageCount ? Number(pageCount) : null,
          language: language ? String(language) : 'Tiếng Việt',
          description: description || null,
          coverImage: coverImage || null,
          ebookUrl: ebookUrl ? String(ebookUrl).trim() : null,
        }
      });

      let indexCounter = 1;
      for (let i = 0; i < copiesNum; i++) {
        let candidateBarcode = `BC-${cleanIsbn}-${String(indexCounter).padStart(3, '0')}`;
        while (await tx.bookItem.findUnique({ where: { barcode: candidateBarcode } })) {
          indexCounter++;
          candidateBarcode = `BC-${cleanIsbn}-${String(indexCounter).padStart(3, '0')}`;
        }

        await tx.bookItem.create({
          data: {
            bookId: newBook.id,
            barcode: candidateBarcode,
            location: 'Khu A - Kệ 1',
            status: 'AVAILABLE' // Luôn sẵn sàng trên kệ
          }
        });
        indexCounter++;
      }

      return await tx.book.findUnique({
        where: { id: newBook.id },
        include: {
          category: true,
          author: true,
          publisher: true,
          items: true,
        }
      });
    });

    return res.status(201).json({
      message: `Đã thêm sách mới và ${copiesNum} bản sao vào kho`,
      isMerged: false,
      ...formatBookResponse(createdBookWithRelations)
    });
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
      ebookUrl,
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
    if (ebookUrl !== undefined) updateData.ebookUrl = ebookUrl ? String(ebookUrl).trim() : null;

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
      'isbn': 'isbn', 'mã isbn': 'isbn', 'ma isbn': 'isbn',
      'thể loại': 'category', 'the loai': 'category', 'category': 'category',
      'số lượng': 'copies', 'so luong': 'copies', 'copies': 'copies', 'số lượng bản sao': 'copies', 'so luong ban sao': 'copies',
      'nhà xuất bản': 'publisher', 'nha xuat ban': 'publisher', 'publisher': 'publisher', 'nxb': 'publisher',
      'năm xuất bản': 'publishedYear', 'nam xuat ban': 'publishedYear', 'publishedyear': 'publishedYear', 'year': 'publishedYear', 'năm xb': 'publishedYear',
      'số trang': 'pageCount', 'so trang': 'pageCount', 'pagecount': 'pageCount', 'pages': 'pageCount',
      'ngôn ngữ': 'language', 'ngon ngu': 'language', 'language': 'language',
      'mô tả': 'description', 'mo ta': 'description', 'description': 'description',
      'ảnh bìa': 'coverImage', 'anh bia': 'coverImage', 'coverimage': 'coverImage', 'cover': 'coverImage',
    };

    const normalizeKey = (key: string): string => {
      const normalized = key.trim().toLowerCase();
      return colMap[normalized] || normalized;
    };

    const imported: { title: string; isbn: string; copies: number }[] = [];
    const skipped: { row: number; title: string; isbn: string; reason: string }[] = [];
    const seenIsbnsInFile = new Set<string>();
    let totalCopiesCreated = 0;

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
        skipped.push({
          row: rowNum,
          title: title || '(Chưa có tiêu đề)',
          isbn: isbn || '(Thiếu ISBN)',
          reason: 'Thiếu trường bắt buộc (Tiêu đề, Tác giả, ISBN, hoặc Thể loại)'
        });
        continue;
      }

      // Check duplicate within the uploaded file
      const normalizedIsbn = isbn.replace(/\s+/g, '');
      if (seenIsbnsInFile.has(normalizedIsbn)) {
        skipped.push({
          row: rowNum,
          title,
          isbn,
          reason: `Trùng lặp mã ISBN "${isbn}" với một dòng trước đó trong file Excel`
        });
        continue;
      }
      seenIsbnsInFile.add(normalizedIsbn);

      try {
        // Check for duplicate ISBN in Database
        const existingBook = await prisma.book.findUnique({ where: { isbn } });
        if (existingBook) {
          skipped.push({
            row: rowNum,
            title,
            isbn,
            reason: `Trùng mã ISBN "${isbn}" với sách đã có trong thư viện: "${existingBook.title}"`
          });
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

        // Prisma Transaction: Atomically create Book and all BookItems with status: "AVAILABLE"
        await prisma.$transaction(async (tx) => {
          const createdBook = await tx.book.create({
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

          // Generate physical copies (BookItems) - 100% AVAILABLE (No ghost copies)
          const cleanIsbn = isbn.replace(/[^0-9]/g, '').slice(-6) || String(createdBook.id);
          for (let j = 0; j < copies; j++) {
            await tx.bookItem.create({
              data: {
                bookId: createdBook.id,
                barcode: `BC-${cleanIsbn}-${String(j + 1).padStart(3, '0')}`,
                location: 'Khu A - Kệ 1',
                status: 'AVAILABLE'
              }
            });
          }
        });

        totalCopiesCreated += copies;
        imported.push({ title, isbn, copies });
      } catch (err: any) {
        skipped.push({
          row: rowNum,
          title,
          isbn,
          reason: `Lỗi xử lý cơ sở dữ liệu: ${err.message || 'Lỗi không xác định'}`
        });
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
            importedCount: imported.length,
            totalCopies: totalCopiesCreated,
            skippedCount: skipped.length,
          })
        }
      });
    }

    const summaryMessage = skipped.length > 0
      ? `Đã thêm thành công ${imported.length} đầu sách (${totalCopiesCreated} cuốn), bỏ qua ${skipped.length} cuốn do trùng mã hoặc lỗi dữ liệu`
      : `Đã thêm thành công toàn bộ ${imported.length} đầu sách (${totalCopiesCreated} cuốn bản sao)!`;

    res.json({
      success: true,
      message: summaryMessage,
      importedCount: imported.length,
      totalCopiesCreated,
      skippedCount: skipped.length,
      imported,
      skipped,
      totalRows: rows.length,
    });
  } catch (error: any) {
    console.error('Error importing books:', error);
    res.status(500).json({ error: error.message || 'Không thể import sách từ file Excel' });
  }
};

// =============================================
// Download Template Excel for Bulk Import
// =============================================
export const downloadImportTemplate = async (_req: Request, res: Response) => {
  try {
    const templateData = [
      {
        'Tiêu đề': 'Đắc Nhân Tâm',
        'Tác giả': 'Dale Carnegie',
        'Thể loại': 'Kỹ năng sống',
        'ISBN': '978-604-58-1234-5',
        'Số lượng bản sao': 5,
        'Nhà xuất bản': 'NXB Tổng Hợp TP.HCM',
        'Năm xuất bản': 2021,
        'Số trang': 320,
        'Ngôn ngữ': 'Tiếng Việt',
        'Mô tả': 'Nghệ thuật thu phục lòng người và giao tiếp ứng xử kinh điển.',
        'Ảnh bìa': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'
      },
      {
        'Tiêu đề': 'Nhà Giả Kim',
        'Tác giả': 'Paulo Coelho',
        'Thể loại': 'Văn học nước ngoài',
        'ISBN': '978-604-58-6789-0',
        'Số lượng bản sao': 3,
        'Nhà xuất bản': 'NXB Hội Nhà Văn',
        'Năm xuất bản': 2020,
        'Số trang': 228,
        'Ngôn ngữ': 'Tiếng Việt',
        'Mô tả': 'Hành trình đi tìm kho báu và lắng nghe tiếng gọi của vũ trụ.',
        'Ảnh bìa': 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400'
      },
      {
        'Tiêu đề': 'Clean Code: A Handbook of Agile Software Craftsmanship',
        'Tác giả': 'Robert C. Martin',
        'Thể loại': 'Công nghệ thông tin',
        'ISBN': '978-013-23-5088-4',
        'Số lượng bản sao': 4,
        'Nhà xuất bản': 'Prentice Hall',
        'Năm xuất bản': 2008,
        'Số trang': 464,
        'Ngôn ngữ': 'Tiếng Anh',
        'Mô tả': 'Cẩm nang viết mã sạch và tư duy kỹ thuật phần mềm chuẩn mực.',
        'Ảnh bìa': 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&q=80&w=400'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 35 }, // Tiêu đề
      { wch: 22 }, // Tác giả
      { wch: 22 }, // Thể loại
      { wch: 22 }, // ISBN
      { wch: 18 }, // Số lượng bản sao
      { wch: 26 }, // Nhà xuất bản
      { wch: 15 }, // Năm xuất bản
      { wch: 12 }, // Số trang
      { wch: 15 }, // Ngôn ngữ
      { wch: 45 }, // Mô tả
      { wch: 35 }, // Ảnh bìa
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MauNhapSach');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="mau_nhap_sach_thu_vien.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Không thể tạo file mẫu' });
  }
};

export const getBookRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    let userLoans: any[] = [];
    if (userId) {
      userLoans = await prisma.loan.findMany({
        where: { userId },
        include: {
          bookItem: {
            include: {
              book: {
                include: {
                  category: true,
                  author: true,
                }
              }
            }
          }
        }
      });
    }

    const borrowedBookIds = new Set<number>();
    const categoryFrequency: Record<number, { count: number; name: string }> = {};
    const authorFrequency: Record<number, { count: number; name: string }> = {};

    for (const loan of userLoans) {
      const book = loan.bookItem?.book;
      if (!book) continue;
      borrowedBookIds.add(book.id);

      if (book.categoryId) {
        if (!categoryFrequency[book.categoryId]) {
          categoryFrequency[book.categoryId] = { count: 0, name: book.category?.name || '' };
        }
        categoryFrequency[book.categoryId].count++;
      }

      if (book.authorId) {
        if (!authorFrequency[book.authorId]) {
          authorFrequency[book.authorId] = { count: 0, name: book.author?.name || '' };
        }
        authorFrequency[book.authorId].count++;
      }
    }

    const sortedCategories = Object.entries(categoryFrequency).sort((a, b) => b[1].count - a[1].count);
    const topCategory = sortedCategories.length > 0 ? { id: Number(sortedCategories[0][0]), ...sortedCategories[0][1] } : null;

    const sortedAuthors = Object.entries(authorFrequency).sort((a, b) => b[1].count - a[1].count);
    const topAuthor = sortedAuthors.length > 0 ? { id: Number(sortedAuthors[0][0]), ...sortedAuthors[0][1] } : null;

    let candidateBooks: any[] = [];
    let recommendationType: 'PERSONALIZED' | 'TRENDING' = 'PERSONALIZED';
    let recommendationReason = '';

    if (topCategory || topAuthor) {
      const orConditions: any[] = [];
      if (topCategory) {
        orConditions.push({ categoryId: topCategory.id });
      }
      if (topAuthor) {
        orConditions.push({ authorId: topAuthor.id });
      }

      candidateBooks = await prisma.book.findMany({
        where: {
          AND: [
            { id: { notIn: Array.from(borrowedBookIds) } },
            { OR: orConditions }
          ]
        },
        include: {
          category: true,
          author: true,
          publisher: true,
          items: true
        },
        take: 10
      });

      if (candidateBooks.length > 0) {
        if (topCategory && topAuthor) {
          recommendationReason = `Dựa trên sở thích đọc sách: Thể loại "${topCategory.name}" & Tác giả "${topAuthor.name}"`;
        } else if (topCategory) {
          recommendationReason = `Dựa trên thể loại bạn thường mượn: "${topCategory.name}"`;
        } else if (topAuthor) {
          recommendationReason = `Dựa trên tác giả bạn yêu thích: "${topAuthor.name}"`;
        }
      }
    }

    // Step 3: Fallback or supplement with Trending Books if user is new or candidate count is small (< 6)
    if (candidateBooks.length < 6) {
      // Calculate borrow count per book
      const allLoans = await prisma.loan.findMany({
        select: {
          bookItem: {
            select: { bookId: true }
          }
        }
      });

      const bookBorrowCounts = new Map<number, number>();
      for (const l of allLoans) {
        const bId = l.bookItem?.bookId;
        if (bId) {
          bookBorrowCounts.set(bId, (bookBorrowCounts.get(bId) || 0) + 1);
        }
      }

      const excludeIds = new Set<number>([
        ...Array.from(borrowedBookIds),
        ...candidateBooks.map((b: any) => b.id)
      ]);

      const trendingPool = await prisma.book.findMany({
        where: {
          id: { notIn: Array.from(excludeIds) }
        },
        include: {
          category: true,
          author: true,
          publisher: true,
          items: true
        }
      });

      // Sort trending pool: most borrowed first, then most available copies
      trendingPool.sort((a, b) => {
        const countA = bookBorrowCounts.get(a.id) || 0;
        const countB = bookBorrowCounts.get(b.id) || 0;
        if (countB !== countA) return countB - countA;
        const availA = a.items?.filter((i: any) => i.status === 'AVAILABLE').length || 0;
        const availB = b.items?.filter((i: any) => i.status === 'AVAILABLE').length || 0;
        return availB - availA;
      });

      const needed = 10 - candidateBooks.length;
      const additionalTrending = trendingPool.slice(0, needed);

      if (candidateBooks.length === 0) {
        recommendationType = 'TRENDING';
        recommendationReason = 'Top những cuốn sách thịnh hành được mượn nhiều nhất tại thư viện';
        candidateBooks = additionalTrending;
      } else {
        candidateBooks = [...candidateBooks, ...additionalTrending];
      }
    }

    const formattedBooks = candidateBooks.map((book: any) => {
      const isPersonalized =
        recommendationType === 'PERSONALIZED' &&
        ((topCategory && book.categoryId === topCategory.id) || (topAuthor && book.authorId === topAuthor.id));

      const badge = isPersonalized ? 'Phù hợp với bạn' : 'Thịnh hành';
      const reason = isPersonalized
        ? (book.categoryId === topCategory?.id ? `Cùng thể loại ${topCategory?.name}` : `Tác giả ${topAuthor?.name}`)
        : 'Được nhiều bạn đọc yêu thích';

      return {
        ...formatBookResponse(book),
        recommendationBadge: badge,
        recommendationReason: reason
      };
    });

    res.json({
      success: true,
      type: recommendationType,
      reason: recommendationReason,
      books: formattedBooks
    });
  } catch (error: any) {
    console.error('Error fetching book recommendations:', error);
    res.status(500).json({ error: error.message || 'Không thể lấy danh sách gợi ý sách' });
  }
};

