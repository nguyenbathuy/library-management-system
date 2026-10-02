import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

/**
 * GET /api/inventory/expected
 * Lấy danh sách tất cả các bản sao (BookItem) đang có trạng thái AVAILABLE
 * (nghĩa là đang có mặt thực tế trên kệ sách theo hệ thống).
 */
export const getExpectedInventory = async (req: AuthRequest, res: Response) => {
  try {
    const expectedItems = await prisma.bookItem.findMany({
      where: {
        status: { in: ['AVAILABLE', 'Available'] }
      },
      include: {
        book: {
          include: {
            category: true,
            author: true
          }
        }
      },
      orderBy: { barcode: 'asc' }
    });

    const formatted = expectedItems.map((item) => ({
      id: item.id,
      barcode: item.barcode,
      location: item.location || 'Khu A - Kệ 1',
      status: item.status,
      bookId: item.bookId,
      bookTitle: item.book?.title || 'Chưa có tiêu đề',
      isbn: item.book?.isbn || '',
      author: item.book?.author?.name || '',
      category: item.book?.category?.name || '',
      coverImage: item.book?.coverImage
    }));

    res.json({
      total: formatted.length,
      items: formatted
    });
  } catch (error: any) {
    console.error('Error fetching expected inventory:', error);
    res.status(500).json({ error: error.message || 'Không thể lấy danh sách kho dự kiến' });
  }
};

/**
 * POST /api/inventory/verify
 * Đối chiếu danh sách mã vạch quét được trên kệ (scannedBarcodes) với CSDL.
 * Trả về 3 nhóm:
 * 1. Sách hợp lệ (matched): Có trong CSDL báo AVAILABLE và được quét trên kệ.
 * 2. Sách bị thiếu (missing): CSDL báo AVAILABLE nhưng không quét được trên kệ.
 * 3. Sách bất thường (anomalous): Quét được trên kệ nhưng CSDL báo BORROWED, LOST, DAMAGED hoặc không tồn tại.
 */
export const verifyInventory = async (req: AuthRequest, res: Response) => {
  try {
    const { scannedBarcodes = [] } = req.body;

    if (!Array.isArray(scannedBarcodes)) {
      return res.status(400).json({ error: 'scannedBarcodes phải là một mảng chuỗi mã vạch' });
    }

    // Chuẩn hóa và lọc trùng mã vạch quét được
    const uniqueScanned = Array.from(
      new Set(
        scannedBarcodes
          .map((b: any) => String(b || '').trim().toUpperCase())
          .filter((b: string) => b.length > 0)
      )
    );

    // Lấy toàn bộ BookItem trong hệ thống kèm thông tin sách
    const allItems = await prisma.bookItem.findMany({
      include: {
        book: {
          include: {
            category: true,
            author: true
          }
        }
      }
    });

    // Tạo Map tra cứu theo barcode in hoa
    const itemMap = new Map<string, typeof allItems[0]>();
    allItems.forEach((item) => {
      itemMap.set(item.barcode.toUpperCase(), item);
    });

    const scannedSet = new Set(uniqueScanned);

    const matched: any[] = [];
    const anomalous: any[] = [];
    const missing: any[] = [];

    // 1. Phân loại các mã vạch quét được
    for (const barcode of uniqueScanned) {
      const item = itemMap.get(barcode);

      if (!item) {
        // Mã vạch hoàn toàn không có trong cơ sở dữ liệu
        anomalous.push({
          barcode,
          issueType: 'NOT_FOUND',
          reason: 'Mã vạch lạ, không tồn tại trong hệ thống thư viện',
          bookTitle: 'Không xác định',
          author: 'N/A',
          location: 'Chưa xếp kệ',
          dbStatus: 'KHÔNG TỒN TẠI'
        });
      } else if (item.status === 'AVAILABLE' || item.status === 'Available') {
        // Hợp lệ: Sách có trong DB và đang Available
        matched.push({
          id: item.id,
          barcode: item.barcode,
          bookTitle: item.book?.title || 'Chưa có tiêu đề',
          author: item.book?.author?.name || '',
          category: item.book?.category?.name || '',
          location: item.location || 'Khu A - Kệ 1',
          status: item.status,
          coverImage: item.book?.coverImage
        });
      } else {
        // Bất thường: Sách có trong DB nhưng trạng thái khác AVAILABLE (BORROWED, LOST, DAMAGED...)
        let reason = 'Trạng thái bất thường';
        if (item.status === 'BORROWED') {
          reason = 'Sách đang ghi nhận BORROWED (đang cho độc giả mượn) nhưng lại xuất hiện trên kệ';
        } else if (item.status === 'LOST') {
          reason = 'Sách đã báo LOST (mất) nhưng lại được tìm thấy trên giá sách';
        } else if (item.status === 'DAMAGED') {
          reason = 'Sách ghi nhận DAMAGED (hỏng hóc/cách ly) nhưng vẫn nằm trên kệ lưu thông';
        }

        anomalous.push({
          id: item.id,
          barcode: item.barcode,
          issueType: item.status,
          reason,
          bookTitle: item.book?.title || 'Chưa có tiêu đề',
          author: item.book?.author?.name || '',
          category: item.book?.category?.name || '',
          location: item.location || 'Khu A - Kệ 1',
          dbStatus: item.status,
          coverImage: item.book?.coverImage
        });
      }
    }

    // 2. Tìm sách bị thiếu (Có trong DB trạng thái AVAILABLE nhưng thủ thư không quét được)
    allItems.forEach((item) => {
      const isAvailable = item.status === 'AVAILABLE' || item.status === 'Available';
      if (isAvailable && !scannedSet.has(item.barcode.toUpperCase())) {
        missing.push({
          id: item.id,
          barcode: item.barcode,
          bookTitle: item.book?.title || 'Chưa có tiêu đề',
          author: item.book?.author?.name || '',
          category: item.book?.category?.name || '',
          location: item.location || 'Khu A - Kệ 1',
          status: item.status,
          coverImage: item.book?.coverImage
        });
      }
    });

    const totalExpected = matched.length + missing.length;
    const accuracyRate = totalExpected > 0 ? ((matched.length / totalExpected) * 100).toFixed(1) : '100.0';

    // 3. Ghi Audit Log cho đợt kiểm kê
    try {
      await prisma.auditLog.create({
        data: {
          action: 'INVENTORY_CHECK',
          adminId: req.user?.userId || 1,
          details: JSON.stringify({
            totalExpected,
            totalScanned: uniqueScanned.length,
            matchedCount: matched.length,
            missingCount: missing.length,
            anomalousCount: anomalous.length,
            accuracyRate: `${accuracyRate}%`,
            checkedAt: new Date().toISOString()
          })
        }
      });
    } catch (e) {
      console.error('AuditLog error:', e);
    }

    res.json({
      summary: {
        totalExpected,
        totalScanned: uniqueScanned.length,
        matchedCount: matched.length,
        missingCount: missing.length,
        anomalousCount: anomalous.length,
        accuracyRate,
        checkedAt: new Date().toISOString()
      },
      matched,
      missing,
      anomalous
    });
  } catch (error: any) {
    console.error('Error verifying inventory:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi đối chiếu kiểm kê kho sách' });
  }
};
