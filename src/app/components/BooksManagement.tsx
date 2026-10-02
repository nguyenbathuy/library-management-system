import { Search, Plus, Edit, Trash2, BookOpen, Filter, X, FileSpreadsheet, Upload, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BookDetailModal } from './BookDetailModal';
import { BookRecommendations } from './BookRecommendations';
import { toast } from 'sonner';

export interface BookItem {
  id: number;
  barcode: string;
  location?: string | null;
  status: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  category: string;
  status: string;
  copies: number;
  available: number;
  publishedYear?: string;
  publisher?: string;
  coverImage?: string;
  description?: string;
  pageCount?: number;
  language?: string;
  ebookUrl?: string | null;
  recommendationBadge?: string;
  recommendationReason?: string;
  items?: BookItem[];
}

interface BooksManagementProps {
  userRole?: 'ADMIN' | 'USER' | null;
  books?: any;
  setBooks?: any;
  onBorrow?: any;
}

export function BooksManagement({ userRole: propUserRole }: BooksManagementProps = {}) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportResult, setShowImportResult] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; imported: string[]; errors: string[]; totalRows: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ebookFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingEbook, setUploadingEbook] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    category: '',
    copies: 1,
    available: 1,
    publishedYear: '',
    publisher: '',
    pageCount: 0,
    language: 'Tiếng Việt',
    description: '',
    coverImage: '',
    ebookUrl: ''
  });

  const { user } = useAuth();
  const userRole = propUserRole || user?.role;
  const queryClient = useQueryClient();

  // Fetch Books
  const { data: books = [], isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const { data } = await client.get('/books');
      return data as Book[];
    }
  });

  // Keep selectedBook synced with latest books data from query refetch
  useEffect(() => {
    if (selectedBook) {
      const updated = books.find(b => b.id === selectedBook.id);
      if (updated) {
        setSelectedBook(updated);
      }
    }
  }, [books]);

  // Create Book Mutation
  const createMutation = useMutation({
    mutationFn: async (bookData: any) => {
      await client.post('/books', bookData);
    },
    onSuccess: () => {
      toast.success('Thêm sách mới thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      setShowModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi thêm sách');
    }
  });

  // Update Book Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await client.put(`/books/${id}`, data);
    },
    onSuccess: () => {
      toast.success('Cập nhật thông tin sách thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      setShowModal(false);
      setEditingBook(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi cập nhật sách');
    }
  });

  // Delete Book Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await client.delete(`/books/${id}`);
    },
    onSuccess: () => {
      toast.success('Xóa sách thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi xóa sách');
    }
  });

  // Import Excel Mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await client.post('/books/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Import thành công ${data.imported?.length || 0} sách!`);
      setImportResult(data);
      setShowImportResult(true);
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi import file Excel');
    }
  });

  const handleImportExcel = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMutation.mutate(file);
      e.target.value = ''; // reset to allow re-uploading the same file
    }
  };

  // Borrow Mutation
  const borrowMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const { data } = await client.post('/loans/borrow', { bookId });
      return data;
    },
    onSuccess: (data: any, bookId: number) => {
      toast.success('Mượn sách thành công!');

      // Bắt buộc gọi invalidateQueries để React tự động fetch lại danh sách sách và cập nhật con số chính xác
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['my-loans'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
      queryClient.invalidateQueries({ queryKey: ['top-books'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
      queryClient.invalidateQueries({ queryKey: ['borrow-trends'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // Cập nhật ngay trong cache của ['books'] để giao diện phản hồi lập tức không độ trễ
      queryClient.setQueryData<Book[]>(['books'], (oldBooks) => {
        if (!oldBooks) return oldBooks;
        return oldBooks.map((b) => {
          if (b.id === bookId) {
            const newAvailable = typeof data?.availableCopies === 'number'
              ? data.availableCopies
              : (typeof data?.available === 'number' ? data.available : Math.max(0, (b.available ?? 1) - 1));
            return {
              ...b,
              available: newAvailable,
              status: newAvailable > 0 ? 'Available' : 'Borrowed'
            };
          }
          return b;
        });
      });

      // Cập nhật ngay trong cache của ['book-recommendations']
      queryClient.setQueryData<any>(['book-recommendations'], (oldData) => {
        if (!oldData || !oldData.books) return oldData;
        return {
          ...oldData,
          books: oldData.books.map((b: Book) => {
            if (b.id === bookId) {
              const newAvailable = typeof data?.availableCopies === 'number'
                ? data.availableCopies
                : (typeof data?.available === 'number' ? data.available : Math.max(0, (b.available ?? 1) - 1));
              return {
                ...b,
                available: newAvailable,
                status: newAvailable > 0 ? 'Available' : 'Borrowed'
              };
            }
            return b;
          })
        };
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi xảy ra khi mượn sách');
    }
  });

  // Reserve Mutation
  const reserveMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const { data } = await client.post('/reservations', { bookId });
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(data.message || 'Đặt trước sách thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['all-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi đặt trước sách');
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      author: '',
      isbn: '',
      category: '',
      copies: 1,
      available: 1,
      publishedYear: '',
      publisher: '',
      pageCount: 0,
      language: 'Tiếng Việt',
      description: '',
      coverImage: '',
      ebookUrl: ''
    });
    if (ebookFileInputRef.current) {
      ebookFileInputRef.current.value = '';
    }
  };

  const handleAddBook = () => {
    setEditingBook(null);
    resetForm();
    setShowModal(true);
  };

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category,
      copies: book.copies,
      available: book.available,
      publishedYear: book.publishedYear || '',
      publisher: book.publisher || '',
      pageCount: book.pageCount || 0,
      language: book.language || 'Tiếng Việt',
      description: book.description || '',
      coverImage: book.coverImage || '',
      ebookUrl: book.ebookUrl || ''
    });
    setShowModal(true);
  };

  const handleEbookFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Dung lượng file vượt quá giới hạn cho phép (tối đa 50MB)');
      return;
    }

    setUploadingEbook(true);
    const data = new FormData();
    data.append('file', file);

    try {
      const res = await client.post('/books/upload-ebook', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, ebookUrl: res.data.ebookUrl }));
      toast.success('Tải lên file E-book thành công!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra khi tải file E-book');
    } finally {
      setUploadingEbook(false);
    }
  };

  const handleDeleteBook = (id: number, title: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa sách "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
    setShowDetailModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.author || !formData.isbn || !formData.category) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc (tiêu đề, tác giả, ISBN, thể loại)');
      return;
    }

    const bookData = {
      ...formData,
      status: 'Available',
      pageCount: formData.pageCount || null,
      publishedYear: formData.publishedYear || null,
      publisher: formData.publisher || null,
      description: formData.description || null,
      coverImage: formData.coverImage || null,
      ebookUrl: formData.ebookUrl || null
    };

    if (editingBook) {
      updateMutation.mutate({ id: editingBook.id, data: bookData });
    } else {
      createMutation.mutate(bookData);
    }
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(books.map(b => b.category)))];

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">{t('books.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            {t('books.title')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('books.subtitle')}</p>
        </div>

        {userRole === 'ADMIN' && (
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <button
              onClick={handleImportExcel}
              disabled={importMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg transition-colors shadow-sm"
            >
              {importMutation.isPending ? (
                <><Loader2 size={18} className="animate-spin" /> {t('books.importing')}</>
              ) : (
                <><FileSpreadsheet size={18} /> {t('books.importExcel')}</>
              )}
            </button>
            <button
              onClick={handleAddBook}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus size={18} />
              {t('books.addNew')}
            </button>
          </div>
        )}
      </div>

      {/* Smart Book Recommendations Carousel */}
      <BookRecommendations
        onSelectBook={handleBookClick}
        onBorrow={(bookId) => borrowMutation.mutate(bookId)}
        onReserve={(bookId) => reserveMutation.mutate(bookId)}
        userRole={userRole}
      />

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={t('books.search')}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-500" />
          <select
            className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Books Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredBooks.map((book) => (
          <div
            key={book.id}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer"
            onClick={() => handleBookClick(book)}
          >
            <div className="h-48 overflow-hidden relative group">
              <img
                src={book.coverImage || 'https://via.placeholder.com/300x400?text=No+Cover'}
                alt={book.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {/* Quick Actions overlay? */}
              </div>
              <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs text-white">
                {book.category}
              </div>
              {book.ebookUrl && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-600/90 backdrop-blur-md rounded text-xs text-white font-medium flex items-center gap-1 shadow">
                  <FileText size={12} /> E-book
                </div>
              )}
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2 min-h-[3rem] mb-1" title={book.title}>
                {book.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 truncate">{book.author}</p>

              <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${book.available > 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {book.available > 0 ? t('books.available') : t('books.outOfStock')}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{t('books.remaining')} {book.available}/{book.copies}</p>
                </div>

                {userRole === 'ADMIN' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditBook(book);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-blue-600"
                      title={t('common.edit')}
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBook(book.id, book.title);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-red-600"
                      title={t('common.delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  book.available > 0 ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        borrowMutation.mutate(book.id);
                      }}
                      disabled={borrowMutation.isPending}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                    >
                      {t('books.borrow')}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reserveMutation.mutate(book.id);
                      }}
                      disabled={reserveMutation.isPending}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                      title={t('books.reserve')}
                    >
                      {t('books.reserve')}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredBooks.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            {t('books.notFound')}
          </div>
        )}
      </div>

      {/* Add/Edit Book Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingBook ? 'Chỉnh sửa sách' : 'Thêm sách mới'}
              </h3>
              <button
                onClick={() => { setShowModal(false); setEditingBook(null); resetForm(); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Tác giả <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    ISBN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.isbn}
                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Thể loại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Số lượng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.copies}
                    onChange={(e) => setFormData({ ...formData, copies: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Còn lại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.available}
                    onChange={(e) => setFormData({ ...formData, available: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Năm xuất bản</label>
                  <input
                    type="text"
                    value={formData.publishedYear}
                    onChange={(e) => setFormData({ ...formData, publishedYear: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nhà xuất bản</label>
                  <input
                    type="text"
                    value={formData.publisher}
                    onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Số trang</label>
                  <input
                    type="number"
                    value={formData.pageCount}
                    onChange={(e) => setFormData({ ...formData, pageCount: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Ngôn ngữ</label>
                  <input
                    type="text"
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">URL ảnh bìa</label>
                  <input
                    type="text"
                    value={formData.coverImage}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    File E-book (PDF - Tùy chọn)
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      type="file"
                      ref={ebookFileInputRef}
                      accept=".pdf,.epub,application/pdf,application/epub+zip"
                      onChange={handleEbookFileUpload}
                      className="hidden"
                      id="ebook-upload-input"
                    />
                    <label
                      htmlFor="ebook-upload-input"
                      className={`flex items-center justify-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer transition-colors text-sm font-medium ${
                        uploadingEbook
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 cursor-not-allowed'
                          : 'border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                      }`}
                    >
                      {uploadingEbook ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Đang tải lên server...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          {formData.ebookUrl ? 'Thay đổi file E-book' : 'Tải lên file E-book (.pdf, .epub)'}
                        </>
                      )}
                    </label>

                    {formData.ebookUrl && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex-1 min-w-0">
                        <FileText size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate flex-1 font-mono" title={formData.ebookUrl}>
                          {formData.ebookUrl}
                        </span>
                        <a
                          href={formData.ebookUrl.startsWith('http') ? formData.ebookUrl : `http://localhost:5000${formData.ebookUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-200 rounded font-medium shrink-0 ml-1 transition-colors"
                        >
                          Xem thử
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, ebookUrl: '' }));
                            if (ebookFileInputRef.current) ebookFileInputRef.current.value = '';
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded text-red-500 shrink-0 transition-colors"
                          title="Gỡ bỏ file E-book"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Hỗ trợ file PDF hoặc EPUB (tối đa 50MB). Khi tải lên, đường dẫn sẽ tự động được lưu và độc giả có thể đọc trực tuyến.
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Mô tả</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                >
                  {editingBook ? 'Cập nhật' : 'Thêm sách'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingBook(null); resetForm(); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                >
                  Hủy
                </button>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {showImportResult && importResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" size={24} />
                Kết quả Import
              </h3>
              <button
                onClick={() => setShowImportResult(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Upload className="text-blue-600" size={20} />
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {importResult.message}
                </p>
              </div>

              {/* Imported list */}
              {importResult.imported.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                    <CheckCircle size={16} /> Thành công ({importResult.imported.length})
                  </h4>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {importResult.imported.map((item: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 pl-5 relative before:content-['•'] before:absolute before:left-1 before:text-green-500">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error list */}
              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                    <AlertCircle size={16} /> Lỗi ({importResult.errors.length})
                  </h4>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-600 dark:text-red-400 pl-5 relative before:content-['•'] before:absolute before:left-1">
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => setShowImportResult(false)}
                className="w-full mt-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Detail Modal */}
      <BookDetailModal
        book={selectedBook}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onBorrow={(bookId) => borrowMutation.mutate(bookId)}
        onReserve={(bookId) => reserveMutation.mutate(bookId)}
        onEdit={userRole === 'ADMIN' ? handleEditBook : undefined}
        onDelete={userRole === 'ADMIN' ? handleDeleteBook : undefined}
        userRole={userRole}
      />
    </div>
  );
}
