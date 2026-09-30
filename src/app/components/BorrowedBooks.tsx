import { useState, useRef, useEffect } from 'react';
import { Search, RotateCcw, AlertCircle, CheckCircle, Clock, ScanBarcode, BookOpen, User, Loader2, X, ArrowRightLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';

export interface BorrowedBook {
  id: number;
  bookId: number;
  book: { title: string; author: string }; // Nested from Prisma include
  user: { name: string; email: string };   // Nested from Prisma include
  borrowDate: string;
  dueDate: string;
  status: 'On Time' | 'Overdue' | 'Due Soon' | 'Returned';
}

interface BorrowedBooksProps {
  userRole: 'ADMIN' | 'USER' | null;
  // Ignore old props
  borrowedBooks?: any;
  onReturnBook?: any;
}

interface BarcodeLookupResult {
  bookItem: {
    id: number;
    barcode: string;
    location: string | null;
    status: string;
  };
  book: {
    id: number;
    title: string;
    isbn: string;
    author: string;
    category: string;
    publisher: string;
    coverImage: string | null;
  };
  activeLoan: {
    id: number;
    borrowDate: string;
    dueDate: string;
    status: string;
    user: { id: number; name: string; email: string };
  } | null;
}

export function BorrowedBooks({ userRole }: BorrowedBooksProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanResult, setScanResult] = useState<BarcodeLookupResult | null>(null);
  const [scanError, setScanError] = useState('');
  const [scanMode, setScanMode] = useState<'borrow' | 'return'>('borrow');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  // Fetch Loans
  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['all-loans'],
    queryFn: async () => {
      const { data } = await client.get('/loans/all');
      return data;
    }
  });

  // Fetch users list for borrower selection
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await client.get('/auth/users');
      return data;
    }
  });

  // Return Book Mutation (existing)
  const returnMutation = useMutation({
    mutationFn: async (loanId: number) => {
      await client.post('/loans/return', { loanId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      alert("Thu hồi sách thành công!");
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || "Có lỗi xảy ra");
    }
  });

  // Barcode Lookup Mutation
  const lookupMutation = useMutation({
    mutationFn: async (barcode: string) => {
      const { data } = await client.get(`/loans/barcode/${encodeURIComponent(barcode.trim())}`);
      return data as BarcodeLookupResult;
    },
    onSuccess: (data) => {
      setScanResult(data);
      setScanError('');
      setSuccessMessage('');
      // Auto-detect mode: if book is borrowed → suggest return mode
      if (data.bookItem.status === 'BORROWED' && data.activeLoan) {
        setScanMode('return');
      } else {
        setScanMode('borrow');
      }
    },
    onError: (error: any) => {
      setScanResult(null);
      setScanError(error.response?.data?.error || 'Không tìm thấy mã vạch');
    }
  });

  // Borrow by Barcode Mutation
  const borrowByBarcodeMutation = useMutation({
    mutationFn: async ({ barcode, userId }: { barcode: string; userId: number }) => {
      const { data } = await client.post('/loans/borrow-by-barcode', { barcode, userId });
      return data;
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setScanResult(null);
      setBarcodeInput('');
      setSelectedUserId('');
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      // Re-focus barcode input for next scan
      setTimeout(() => barcodeInputRef.current?.focus(), 200);
    },
    onError: (error: any) => {
      setScanError(error.response?.data?.error || 'Không thể tạo phiếu mượn');
    }
  });

  // Return by Barcode Mutation
  const returnByBarcodeMutation = useMutation({
    mutationFn: async (barcode: string) => {
      const { data } = await client.post('/loans/return-by-barcode', { barcode });
      return data;
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setScanResult(null);
      setBarcodeInput('');
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setTimeout(() => barcodeInputRef.current?.focus(), 200);
    },
    onError: (error: any) => {
      setScanError(error.response?.data?.error || 'Không thể thu hồi sách');
    }
  });

  // Handle barcode input (Enter key = submit scan)
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      setScanError('');
      setSuccessMessage('');
      lookupMutation.mutate(barcodeInput.trim());
    }
  };

  const handleBorrowConfirm = () => {
    if (!scanResult || !selectedUserId) return;
    borrowByBarcodeMutation.mutate({
      barcode: scanResult.bookItem.barcode,
      userId: Number(selectedUserId)
    });
  };

  const handleReturnConfirm = () => {
    if (!scanResult) return;
    returnByBarcodeMutation.mutate(scanResult.bookItem.barcode);
  };

  const handleClearScan = () => {
    setScanResult(null);
    setScanError('');
    setSuccessMessage('');
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  // Auto-clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Filter logic handled client side for now
  const filteredLoans = loans.filter((loan: any) =>
    loan.book?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.user?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.bookItem?.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <div>Đang tải danh sách mượn...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý mượn trả</h2>
        <p className="text-gray-500 dark:text-gray-400">Theo dõi danh sách sách đang cho mượn và xử lý trả sách.</p>
      </div>

      {/* ========== BARCODE SCANNER PANEL ========== */}
      {userRole === 'ADMIN' && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanBarcode className="text-indigo-600 dark:text-indigo-400" size={22} />
              <h3 className="font-bold text-indigo-900 dark:text-indigo-200">Quét mã vạch sách</h3>
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border border-indigo-200 dark:border-indigo-700">
              <button
                onClick={() => { setScanMode('borrow'); handleClearScan(); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  scanMode === 'borrow'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600'
                }`}
              >
                Cho mượn
              </button>
              <button
                onClick={() => { setScanMode('return'); handleClearScan(); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  scanMode === 'return'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600'
                }`}
              >
                Thu hồi
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Barcode Input */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Quét hoặc nhập mã vạch rồi nhấn Enter... (VD: BC-076691-001)"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  className="w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-900 border-2 border-indigo-300 dark:border-indigo-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-mono tracking-wider placeholder:text-sm placeholder:font-sans placeholder:tracking-normal"
                  autoFocus
                />
                {(barcodeInput || scanResult) && (
                  <button
                    onClick={handleClearScan}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <Button
                onClick={() => {
                  if (barcodeInput.trim()) {
                    setScanError('');
                    setSuccessMessage('');
                    lookupMutation.mutate(barcodeInput.trim());
                  }
                }}
                disabled={!barcodeInput.trim() || lookupMutation.isPending}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {lookupMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : 'Tra cứu'}
              </Button>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 animate-in fade-in duration-300">
                <CheckCircle className="text-green-600 shrink-0" size={20} />
                <p className="text-sm font-medium text-green-800 dark:text-green-300">{successMessage}</p>
              </div>
            )}

            {/* Error Message */}
            {scanError && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 animate-in fade-in duration-300">
                <AlertCircle className="text-red-600 shrink-0" size={20} />
                <p className="text-sm font-medium text-red-800 dark:text-red-300">{scanError}</p>
              </div>
            )}

            {/* Scan Result Card */}
            {scanResult && (
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                <div className="flex gap-4 p-4">
                  {/* Book Cover */}
                  <div className="w-20 h-28 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                    <img
                      src={scanResult.book.coverImage || 'https://via.placeholder.com/80x112?text=No+Cover'}
                      alt={scanResult.book.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Book Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight truncate">
                      {scanResult.book.title}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{scanResult.book.author}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} /> {scanResult.book.category}
                      </span>
                      <span>ISBN: {scanResult.book.isbn}</span>
                      <span>Vị trí: {scanResult.bookItem.location || 'N/A'}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
                        {scanResult.bookItem.barcode}
                      </span>
                      <Badge className={
                        scanResult.bookItem.status === 'AVAILABLE'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : scanResult.bookItem.status === 'BORROWED'
                          ? 'bg-orange-100 text-orange-700 border-orange-200'
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                      }>
                        {scanResult.bookItem.status === 'AVAILABLE' ? 'Sẵn sàng' :
                         scanResult.bookItem.status === 'BORROWED' ? 'Đang mượn' :
                         scanResult.bookItem.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Active Loan Info (if borrowed) */}
                {scanResult.activeLoan && (
                  <div className="mx-4 mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 text-sm">
                      <User size={14} className="text-orange-600" />
                      <span className="font-medium text-orange-800 dark:text-orange-300">
                        Đang được mượn bởi: {scanResult.activeLoan.user.name}
                      </span>
                      <span className="text-orange-600 dark:text-orange-400">
                        ({scanResult.activeLoan.user.email})
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-orange-600 dark:text-orange-400 mt-1 pl-5">
                      <span>Mượn: {new Date(scanResult.activeLoan.borrowDate).toLocaleDateString()}</span>
                      <span>Hạn trả: {new Date(scanResult.activeLoan.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}

                {/* Action Area */}
                <div className="border-t border-gray-100 dark:border-gray-800 p-4">
                  {scanMode === 'borrow' && scanResult.bookItem.status === 'AVAILABLE' ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Chọn độc giả mượn sách
                        </label>
                        <select
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        >
                          <option value="">-- Chọn độc giả --</option>
                          {users
                            .filter((u: any) => u.role === 'USER')
                            .map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.email})
                              </option>
                            ))}
                        </select>
                      </div>
                      <Button
                        onClick={handleBorrowConfirm}
                        disabled={!selectedUserId || borrowByBarcodeMutation.isPending}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white mt-5"
                      >
                        {borrowByBarcodeMutation.isPending ? (
                          <><Loader2 size={16} className="animate-spin mr-1" /> Đang xử lý...</>
                        ) : (
                          <><ArrowRightLeft size={16} className="mr-1" /> Cho mượn</>
                        )}
                      </Button>
                    </div>
                  ) : scanMode === 'return' && scanResult.activeLoan ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Thu hồi sách từ <strong>{scanResult.activeLoan.user.name}</strong>?
                      </p>
                      <Button
                        onClick={handleReturnConfirm}
                        disabled={returnByBarcodeMutation.isPending}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {returnByBarcodeMutation.isPending ? (
                          <><Loader2 size={16} className="animate-spin mr-1" /> Đang xử lý...</>
                        ) : (
                          <><RotateCcw size={16} className="mr-1" /> Xác nhận thu hồi</>
                        )}
                      </Button>
                    </div>
                  ) : scanResult.bookItem.status === 'BORROWED' && scanMode === 'borrow' ? (
                    <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                      ⚠️ Cuốn sách này đang được mượn. Chuyển sang chế độ "Thu hồi" để trả sách.
                    </p>
                  ) : scanResult.bookItem.status === 'AVAILABLE' && scanMode === 'return' ? (
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      ℹ️ Cuốn sách này đang sẵn sàng, không có phiếu mượn nào cần thu hồi.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Trạng thái: {scanResult.bookItem.status}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search bar for loan list */}
      <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <Search className="text-gray-400 w-5 h-5" />
        <Input
          placeholder="Tìm kiếm theo tên sách, tên độc giả, email hoặc mã vạch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thông tin Sách</TableHead>
              <TableHead>Mã vạch</TableHead>
              <TableHead>Người mượn</TableHead>
              <TableHead>Ngày mượn</TableHead>
              <TableHead>Hạn trả</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLoans.length > 0 ? (
              filteredLoans.map((loan: any) => (
                <TableRow key={loan.id}>
                  <TableCell>
                    <p className="font-medium text-gray-900 dark:text-white">{loan.book?.title}</p>
                    <p className="text-xs text-gray-500">{loan.book?.author}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                      {loan.bookItem?.barcode || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900 dark:text-white">{loan.user?.name}</p>
                    <p className="text-xs text-gray-500">{loan.user?.email}</p>
                  </TableCell>
                  <TableCell>{new Date(loan.borrowDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{new Date(loan.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {loan.status === 'On Time' && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 gap-1">
                        <CheckCircle size={12} /> Đúng hạn
                      </Badge>
                    )}
                    {loan.status === 'Due Soon' && (
                      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200 gap-1">
                        <Clock size={12} /> Sắp đến hạn
                      </Badge>
                    )}
                    {loan.status === 'Overdue' && (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 gap-1">
                        <AlertCircle size={12} /> Quá hạn
                      </Badge>
                    )}
                    {loan.status === 'Returned' && (
                      <Badge variant="secondary">Đã trả</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {loan.status !== 'Returned' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => returnMutation.mutate(loan.id)}
                        disabled={returnMutation.isPending}
                      >
                        <RotateCcw size={16} /> Thu hồi
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                  Không tìm thấy phiếu mượn nào phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}