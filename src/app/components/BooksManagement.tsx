import { Search, Plus, Edit, Trash2, BookOpen, Filter, X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { BookDetailModal } from './BookDetailModal';

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
}

interface BooksManagementProps {
  userRole: 'ADMIN' | 'USER' | null;
  books?: any;
  setBooks?: any;
  onBorrow?: any;
}

export function BooksManagement({ userRole: propUserRole }: BooksManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
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
    coverImage: ''
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

  // Create Book Mutation
  const createMutation = useMutation({
    mutationFn: async (bookData: any) => {
      await client.post('/books', bookData);
    },
    onSuccess: () => {
      alert('Thêm sách thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setShowModal(false);
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Có lỗi khi thêm sách');
    }
  });

  // Update Book Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await client.put(`/books/${id}`, data);
    },
    onSuccess: () => {
      alert('Cập nhật sách thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setShowModal(false);
      setEditingBook(null);
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Có lỗi khi cập nhật sách');
    }
  });

  // Delete Book Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await client.delete(`/books/${id}`);
    },
    onSuccess: () => {
      alert('Xóa sách thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Có lỗi khi xóa sách');
    }
  });

  // Borrow Mutation
  const borrowMutation = useMutation({
    mutationFn: async (bookId: number) => {
      await client.post('/loans/borrow', { bookId });
    },
    onSuccess: () => {
      alert('Mượn sách thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Có lỗi xảy ra');
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
      coverImage: ''
    });
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
      coverImage: book.coverImage || ''
    });
    setShowModal(true);
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
      alert('Vui lòng điền đầy đủ thông tin bắt buộc (tiêu đề, tác giả, ISBN, thể loại)');
      return;
    }

    const bookData = {
      ...formData,
      status: 'Available',
      pageCount: formData.pageCount || null,
      publishedYear: formData.publishedYear || null,
      publisher: formData.publisher || null,
      description: formData.description || null,
      coverImage: formData.coverImage || null
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

  if (isLoading) return <div className="p-8 text-center">Đang tải dữ liệu sách...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            Tủ sách
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Danh sách sách trong thư viện</p>
        </div>

        {userRole === 'ADMIN' && (
          <button
            onClick={handleAddBook}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          >
            <Plus size={18} />
            Thêm sách mới
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên sách, tác giả..."
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
                    {book.available > 0 ? 'Sẵn sàng' : 'Hết sách'}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">Còn {book.available}/{book.copies}</p>
                </div>

                {userRole === 'ADMIN' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditBook(book);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-blue-600"
                      title="Chỉnh sửa"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBook(book.id, book.title);
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-red-600"
                      title="Xóa"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      borrowMutation.mutate(book.id);
                    }}
                    disabled={book.available === 0 || borrowMutation.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Mượn
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredBooks.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            Không tìm thấy cuốn sách nào phù hợp.
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

      {/* Book Detail Modal */}
      <BookDetailModal
        book={selectedBook}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onBorrow={(bookId) => borrowMutation.mutate(bookId)}
        userRole={userRole}
      />
    </div>
  );
}
