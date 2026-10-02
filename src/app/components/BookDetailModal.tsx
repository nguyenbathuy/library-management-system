import { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, BookOpen, Calendar, FileText, Tag, BookmarkPlus, Clock, ExternalLink, Printer, QrCode } from 'lucide-react';
import { Book, BookItem } from './BooksManagement';
import { BarcodeLabelsPrint } from './BarcodeLabelsPrint';

interface BookDetailModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
  onBorrow?: (bookId: number) => void;
  onReserve?: (bookId: number) => void;
  userRole?: 'ADMIN' | 'USER' | null;
}

export function BookDetailModal({ book, isOpen, onClose, onBorrow, onReserve, userRole }: BookDetailModalProps) {
  if (!isOpen || !book) return null;

  const printRef = useRef<HTMLDivElement>(null);
  const [itemsToPrint, setItemsToPrint] = useState<BookItem[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  const effectiveItems: BookItem[] = (book.items && book.items.length > 0)
    ? book.items
    : Array.from({ length: book.copies || 1 }, (_, i) => ({
        id: i + 1,
        barcode: `BC-${(book.isbn || 'BOOK').replace(/[^a-zA-Z0-9]/g, '')}-${String(i + 1).padStart(3, '0')}`,
        location: 'Khu A - Kệ 1',
        status: i < (book.available || 0) ? 'AVAILABLE' : 'BORROWED'
      }));

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ma-Vach-${(book.title || 'Sach').replace(/[^a-zA-Z0-9]/g, '_')}`,
  });

  useEffect(() => {
    if (isPrinting && itemsToPrint.length > 0) {
      handlePrint();
      setIsPrinting(false);
    }
  }, [isPrinting, itemsToPrint]);

  const triggerPrintSingle = (item: BookItem) => {
    setItemsToPrint([item]);
    setIsPrinting(true);
  };

  const triggerPrintAll = () => {
    setItemsToPrint(effectiveItems);
    setIsPrinting(true);
  };

  const handleBorrow = () => {
    if (onBorrow && book.available > 0) {
      onBorrow(book.id);
      onClose();
    }
  };

  const handleReserve = () => {
    if (onReserve && book.available === 0) {
      onReserve(book.id);
      onClose();
    }
  };

  const getEbookUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleReadOnline = () => {
    if (book.ebookUrl) {
      const fullUrl = getEbookUrl(book.ebookUrl);
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Chi tiết sách</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Cover Image */}
            <div className="lg:col-span-1">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden sticky top-20 relative">
                <img
                  src={book.coverImage || 'https://via.placeholder.com/300x400?text=No+Cover'}
                  alt={book.title}
                  className="w-full h-auto object-cover"
                />
                {book.ebookUrl && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-600/90 backdrop-blur-md rounded-md text-xs font-semibold text-white flex items-center gap-1.5 shadow-md">
                    <FileText size={14} />
                    E-book có sẵn
                  </div>
                )}
                <div className="p-3 bg-gradient-to-t from-black/60 to-transparent absolute bottom-0 left-0 right-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${book.available > 0
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                      }`}>
                      {book.available > 0 ? 'Còn hàng' : 'Hết sách'}
                    </span>
                    <span className="text-white text-sm font-medium">
                      {book.available}/{book.copies}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Book Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title & Author */}
              <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
                  {book.title}
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400">{book.author}</p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <FileText className="text-blue-600 dark:text-blue-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ISBN</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {book.isbn}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <BookOpen className="text-purple-600 dark:text-purple-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nhà xuất bản</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {book.publisher || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Calendar className="text-green-600 dark:text-green-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Năm XB</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {book.publishedYear || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <FileText className="text-orange-600 dark:text-orange-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Số trang</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {book.pageCount || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              {book.description && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={18} className="text-gray-600 dark:text-gray-400" />
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                      Tóm tắt nội dung
                    </h3>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {book.description}
                  </p>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {book.ebookUrl && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-medium">
                    <FileText size={14} />
                    Bản điện tử (PDF/EPUB)
                  </span>
                )}
                {book.language && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                    <Tag size={14} />
                    {book.language}
                  </span>
                )}
                {book.category && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm">
                    <Tag size={14} />
                    {book.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Out of Stock Notice */}
          {book.available === 0 && (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-start gap-3">
              <Clock className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Tất cả bản sao hiện đang được mượn
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Độc giả có thể bấm <strong>"Đặt Trước Sách"</strong> bên dưới{book.ebookUrl ? ', hoặc bấm "Đọc Online (PDF)" để đọc bản điện tử ngay lúc này' : '. Hệ thống sẽ ghi nhận thứ tự ưu tiên và bạn sẽ nhận được sách ngay khi có người trả'}.
                </p>
              </div>
            </div>
          )}

          {/* Admin-only: Physical Copies & Barcode Printing */}
          {userRole === 'ADMIN' && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                      Bản sao vật lý & Tem mã vạch ({effectiveItems.length} cuốn)
                    </h3>
                    <p className="text-xs text-gray-500">Mã vạch và vị trí kệ sách để in tem dán gáy</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={triggerPrintAll}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow transition-all active:scale-95"
                  title="In toàn bộ tem nhãn mã vạch của các bản sao này"
                >
                  <Printer size={15} />
                  <span>In tất cả mã vạch ({effectiveItems.length})</span>
                </button>
              </div>

              {/* Items List */}
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">STT</th>
                      <th className="px-4 py-2.5">Mã vạch (Barcode)</th>
                      <th className="px-4 py-2.5">Vị trí kệ</th>
                      <th className="px-4 py-2.5">Trạng thái</th>
                      <th className="px-4 py-2.5 text-right">In nhãn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {effectiveItems.map((item, idx) => (
                      <tr key={item.id || item.barcode} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-gray-400 font-mono">#{idx + 1}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-gray-800 dark:text-gray-200">
                          {item.barcode}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                          {item.location || 'Khu A - Kệ 1'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.status === 'AVAILABLE'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : item.status === 'BORROWED'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => triggerPrintSingle(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-xs font-medium transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
                            title="In tem nhãn dán gáy sách cho bản sao này"
                          >
                            <Printer size={13} />
                            <span>In mã vạch</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hidden Print Container for react-to-print */}
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <BarcodeLabelsPrint
              ref={printRef}
              bookTitle={book.title}
              items={itemsToPrint}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors font-medium"
            >
              Đóng
            </button>

            {/* Read Online Button */}
            {book.ebookUrl && (
              <button
                onClick={handleReadOnline}
                className="flex-1 min-w-[160px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow-emerald-600/30 active:scale-[0.98]"
                title="Mở tài liệu số đọc trực tiếp trên trình duyệt"
              >
                <FileText size={18} />
                <span>Đọc Online (PDF)</span>
                <ExternalLink size={16} className="opacity-80" />
              </button>
            )}

            {userRole !== 'ADMIN' && (
              book.available > 0 ? (
                <button
                  onClick={handleBorrow}
                  className="flex-1 min-w-[160px] px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                >
                  <BookOpen size={18} />
                  Mượn Sách Này
                </button>
              ) : (
                <button
                  onClick={handleReserve}
                  className="flex-1 min-w-[160px] px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  <BookmarkPlus size={18} />
                  Đặt Trước Sách
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
