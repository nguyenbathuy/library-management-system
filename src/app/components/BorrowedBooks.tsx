import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, RotateCcw, AlertCircle, CheckCircle, Clock, ScanBarcode,
  BookOpen, User, Loader2, X, ArrowRightLeft, BookmarkPlus,
  BookMarked, Bell, CheckCircle2, XCircle, Calendar, Send, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

export interface BorrowedBook {
  id: number;
  bookId: number;
  book: { title: string; author: string }; // Nested from Prisma include
  user: { name: string; email: string };   // Nested from Prisma include
  borrowDate: string;
  dueDate: string;
  status: 'On Time' | 'Overdue' | 'Due Soon' | 'Returned';
  renewalStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | string;
}

interface BorrowedBooksProps {
  userRole?: 'ADMIN' | 'USER' | null;
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

export interface ReservationItem {
  id: number;
  userId: number;
  bookId: number;
  status: 'WAITING' | 'NOTIFIED' | 'FULFILLED' | 'CANCELLED';
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    membershipTier?: string;
  } | null;
  book: {
    id: number;
    title: string;
    isbn: string;
    author: string;
    category: string;
    coverImage: string | null;
    available: number;
    totalCopies: number;
  } | null;
}

export function BorrowedBooks({ userRole: propUserRole }: BorrowedBooksProps = {}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const userRole = propUserRole || user?.role;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'loans' | 'reservations'>(
    tabParam === 'reservations' ? 'reservations' : 'loans'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanResult, setScanResult] = useState<BarcodeLookupResult | null>(null);
  const [scanError, setScanError] = useState('');
  const [scanMode, setScanMode] = useState<'borrow' | 'return'>('borrow');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Reservation filter states
  const [reservationSearch, setReservationSearch] = useState('');
  const [reservationFilter, setReservationFilter] = useState<'ALL' | 'WAITING' | 'NOTIFIED' | 'FULFILLED' | 'CANCELLED'>('ALL');

  // Lost / Compensation Modal states
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [selectedLoanForLost, setSelectedLoanForLost] = useState<any>(null);
  const [compensationAmount, setCompensationAmount] = useState<string>('50000');

  const queryClient = useQueryClient();

  useEffect(() => {
    if (tabParam === 'reservations') {
      setActiveTab('reservations');
    } else if (tabParam === 'loans') {
      setActiveTab('loans');
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'loans' | 'reservations') => {
    setActiveTab(tab);
    setSearchParams(tab === 'reservations' ? { tab: 'reservations' } : {});
  };

  // Fetch Loans
  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['all-loans'],
    queryFn: async () => {
      const { data } = await client.get('/loans/all');
      return data;
    }
  });

  // Fetch Reservations
  const { data: reservations = [], isLoading: isReservationsLoading } = useQuery({
    queryKey: ['all-reservations'],
    queryFn: async () => {
      const { data } = await client.get('/reservations/all');
      return data as ReservationItem[];
    },
    enabled: userRole === 'ADMIN'
  });

  // Fetch users list for borrower selection
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await client.get('/auth/users');
      return data;
    }
  });

  // Return Book Mutation
  const returnMutation = useMutation({
    mutationFn: async (loanId: number) => {
      const { data } = await client.post('/loans/return', { loanId });
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['all-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
      if (data?.reservationNotice) {
        toast.success(`Thu hồi sách thành công! Độc giả ${data.reservationNotice.userName} đang đặt trước sách này. Trạng thái đã chuyển sang "Đã thông báo"!`, { duration: 5000 });
      } else {
        toast.success("Thu hồi sách thành công!");
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Có lỗi xảy ra khi thu hồi sách");
    }
  });

  // Renew Loan Mutation
  const renewMutation = useMutation({
    mutationFn: async (loanId: number) => {
      const { data } = await client.post(`/loans/${loanId}/renew`);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success(data?.message || (language === 'vi' ? 'Gia hạn sách thành công thêm 7 ngày!' : 'Loan renewed successfully for 7 days!'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || (language === 'vi' ? 'Không thể gia hạn sách' : 'Failed to renew loan'));
    }
  });

  // Approve Renew Loan Mutation (Admin)
  const approveRenewMutation = useMutation({
    mutationFn: async (loanId: number) => {
      const { data } = await client.post(`/loans/${loanId}/approve-renew`);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success(data?.message || (language === 'vi' ? 'Đã phê duyệt gia hạn sách thêm 7 ngày!' : 'Loan renewal approved for 7 days!'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || (language === 'vi' ? 'Không thể phê duyệt gia hạn sách' : 'Failed to approve renewal'));
    }
  });

  // Reject Renew Loan Mutation (Admin)
  const rejectRenewMutation = useMutation({
    mutationFn: async (loanId: number) => {
      const { data } = await client.post(`/loans/${loanId}/reject-renew`);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      toast.success(data?.message || (language === 'vi' ? 'Đã từ chối yêu cầu gia hạn sách!' : 'Loan renewal rejected!'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || (language === 'vi' ? 'Không thể từ chối gia hạn sách' : 'Failed to reject renewal'));
    }
  });

  // Report Lost Mutation
  const reportLostMutation = useMutation({
    mutationFn: async ({ loanId, compensationAmount }: { loanId: number; compensationAmount: number }) => {
      const { data } = await client.post(`/loans/${loanId}/report-lost`, { compensationAmount });
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
      toast.success(data?.message || (language === 'vi' ? 'Báo mất sách và ghi nhận bồi thường thành công!' : 'Reported lost book and recorded compensation!'));
      setLostModalOpen(false);
      setSelectedLoanForLost(null);
      setCompensationAmount('50000');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || (language === 'vi' ? 'Không thể xử lý báo mất sách' : 'Failed to report lost book'));
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
      setSelectedUserId('');
      setSuccessMessage('');
    },
    onError: (error: any) => {
      setScanError(error.response?.data?.error || 'Không tìm thấy cuốn sách với mã vạch này');
      setScanResult(null);
    }
  });

  // Borrow by Barcode Mutation
  const borrowByBarcodeMutation = useMutation({
    mutationFn: async ({ barcode, userId }: { barcode: string; userId: number }) => {
      const { data } = await client.post('/loans/borrow-by-barcode', { barcode, userId });
      return data;
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || 'Cho mượn sách thành công!');
      setScanError('');
      setScanResult(null);
      setBarcodeInput('');
      setSelectedUserId('');
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['all-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
      barcodeInputRef.current?.focus();
    },
    onError: (error: any) => {
      setScanError(error.response?.data?.error || 'Có lỗi khi cho mượn');
    }
  });

  // Return by Barcode Mutation
  const returnByBarcodeMutation = useMutation({
    mutationFn: async (barcode: string) => {
      const { data } = await client.post('/loans/return-by-barcode', { barcode });
      return data;
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message || 'Thu hồi sách thành công!');
      setScanError('');
      setScanResult(null);
      setBarcodeInput('');
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['all-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
      barcodeInputRef.current?.focus();
    },
    onError: (error: any) => {
      setScanError(error.response?.data?.error || 'Có lỗi khi thu hồi');
    }
  });

  // Update Reservation Status Mutation
  const updateReservationStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { data } = await client.patch(`/reservations/${id}/status`, { status });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Cập nhật trạng thái đặt trước thành công!');
      queryClient.invalidateQueries({ queryKey: ['all-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi cập nhật trạng thái đặt trước');
    }
  });

  // Cancel Reservation Mutation
  const cancelReservationMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await client.delete(`/reservations/${id}`);
      return data;
    },
    onSuccess: () => {
      toast.success('Đã hủy yêu cầu đặt trước thành công!');
      queryClient.invalidateQueries({ queryKey: ['all-reservations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi hủy yêu cầu đặt trước');
    }
  });

  // Trigger Email Reminders Mutation
  const remindersMutation = useMutation({
    mutationFn: async () => {
      const { data } = await client.post('/loans/reminders/trigger');
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Đã hoàn tất quét và gửi email nhắc nhở!');
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi gửi email nhắc nhở');
    }
  });

  // Handle enter key on barcode input
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      setScanError('');
      setSuccessMessage('');
      lookupMutation.mutate(barcodeInput.trim());
    }
  };

  const handleClearScan = () => {
    setBarcodeInput('');
    setScanResult(null);
    setScanError('');
    setSuccessMessage('');
    setSelectedUserId('');
    barcodeInputRef.current?.focus();
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

  const filteredLoans = loans.filter((loan: any) =>
    loan.book?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.user?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.bookItem?.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReservations = reservations.filter((r) => {
    const matchesSearch =
      (r.book?.title || '').toLowerCase().includes(reservationSearch.toLowerCase()) ||
      (r.book?.author || '').toLowerCase().includes(reservationSearch.toLowerCase()) ||
      (r.user?.name || '').toLowerCase().includes(reservationSearch.toLowerCase()) ||
      (r.user?.email || '').toLowerCase().includes(reservationSearch.toLowerCase()) ||
      (r.book?.isbn || '').toLowerCase().includes(reservationSearch.toLowerCase());

    const matchesStatus = reservationFilter === 'ALL' || r.status === reservationFilter;
    return matchesSearch && matchesStatus;
  });

  const waitingCount = reservations.filter(r => r.status === 'WAITING').length;
  const notifiedCount = reservations.filter(r => r.status === 'NOTIFIED').length;
  const fulfilledCount = reservations.filter(r => r.status === 'FULFILLED').length;

  if (isLoading) return <div className="p-8 text-center text-gray-500">Đang tải dữ liệu mượn trả...</div>;

  return (
    <div className="space-y-6">
      {/* Title & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('borrowed.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400">{t('borrowed.subtitle')}</p>
        </div>

        {userRole === 'ADMIN' && (
          <Button
            onClick={() => remindersMutation.mutate()}
            disabled={remindersMutation.isPending}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm self-start sm:self-auto"
            title="Quét tìm sách sắp đến hạn (1-2 ngày) và quá hạn để gửi email nhắc nhở độc giả ngay lập tức"
          >
            {remindersMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Đang quét & gửi email...</>
            ) : (
              <><Send size={16} /> Quét & Gửi email nhắc nhở</>
            )}
          </Button>
        )}
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-2">
        <button
          onClick={() => handleTabChange('loans')}
          className={`flex items-center gap-2 pb-3 px-4 font-medium text-sm border-b-2 transition-all ${activeTab === 'loans'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          <BookMarked size={18} />
          <span>{t('borrowed.loansTab')}</span>
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {loans.filter((l: any) => l.status !== 'Returned').length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('reservations')}
          className={`flex items-center gap-2 pb-3 px-4 font-medium text-sm border-b-2 transition-all ${activeTab === 'reservations'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          <BookmarkPlus size={18} />
          <span>{t('borrowed.reservationsTab')}</span>
          {waitingCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white font-bold animate-pulse">
              {waitingCount}
            </span>
          )}
        </button>
      </div>

      {/* ================= TAB 1: LOANS MANAGEMENT & BARCODE ================= */}
      {activeTab === 'loans' && (
        <div className="space-y-6">
          {/* Barcode Scanner Panel */}
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
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${scanMode === 'borrow'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-indigo-600'
                      }`}
                  >
                    Cho mượn
                  </button>
                  <button
                    onClick={() => { setScanMode('return'); handleClearScan(); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${scanMode === 'return'
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

          {/* Loans Table */}
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
                    <TableRow 
                      key={loan.id}
                      className={loan.renewalStatus === 'PENDING' ? 'bg-amber-50/70 dark:bg-amber-950/25 border-l-4 border-l-amber-500 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors' : ''}
                    >
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
                        <div className="flex flex-col gap-1 items-start">
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
                          {loan.status === 'Lost' && (
                            <div>
                              <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200 gap-1 font-semibold">
                                <AlertTriangle size={12} /> Báo mất
                              </Badge>
                              {loan.compensationAmount > 0 && (
                                <p className="text-[11px] text-rose-600 font-medium mt-0.5">
                                  Đền bù: {loan.compensationAmount.toLocaleString('vi-VN')} đ
                                </p>
                              )}
                            </div>
                          )}

                          {loan.renewalStatus === 'PENDING' && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 gap-1 animate-pulse font-semibold">
                              <Clock size={11} /> Yêu cầu gia hạn
                            </Badge>
                          )}
                          {loan.renewalStatus === 'APPROVED' && (
                            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 gap-1 text-[11px]">
                              <CheckCircle size={10} /> Đã gia hạn
                            </Badge>
                          )}
                          {loan.renewalStatus === 'REJECTED' && (
                            <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 gap-1 text-[11px]">
                              <XCircle size={10} /> Từ chối gia hạn
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {loan.status !== 'Returned' && loan.status !== 'Lost' && (
                          <div className="flex items-center justify-end gap-2">
                            {loan.renewalStatus === 'PENDING' ? (
                              <>
                                <Button
                                  size="sm"
                                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                  onClick={() => approveRenewMutation.mutate(loan.id)}
                                  disabled={approveRenewMutation.isPending || rejectRenewMutation.isPending}
                                  title="Phê duyệt yêu cầu gia hạn thêm 7 ngày"
                                >
                                  <CheckCircle2 size={14} className={approveRenewMutation.isPending ? 'animate-spin' : ''} /> Duyệt gia hạn
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/60 dark:text-rose-400"
                                  onClick={() => rejectRenewMutation.mutate(loan.id)}
                                  disabled={approveRenewMutation.isPending || rejectRenewMutation.isPending}
                                  title="Từ chối yêu cầu gia hạn"
                                >
                                  <XCircle size={14} className={rejectRenewMutation.isPending ? 'animate-spin' : ''} /> Từ chối
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400"
                                onClick={() => renewMutation.mutate(loan.id)}
                                disabled={renewMutation.isPending || loan.status === 'Overdue'}
                                title={loan.status === 'Overdue' ? (language === 'vi' ? 'Sách đã quá hạn, không thể gia hạn' : 'Overdue books cannot be renewed') : (language === 'vi' ? 'Gia hạn thêm 7 ngày' : 'Renew loan for 7 days')}
                              >
                                <RefreshCw size={14} className={renewMutation.isPending ? 'animate-spin' : ''} /> {t('borrowed.renew')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => returnMutation.mutate(loan.id)}
                              disabled={returnMutation.isPending}
                            >
                              <RotateCcw size={15} /> Thu hồi
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900/60 dark:text-rose-400"
                              onClick={() => {
                                setSelectedLoanForLost(loan);
                                setCompensationAmount('50000');
                                setLostModalOpen(true);
                              }}
                              title="Báo mất hoặc hư hỏng sách và yêu cầu bồi thường"
                            >
                              <AlertTriangle size={14} /> Báo mất/hỏng
                            </Button>
                          </div>
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
      )}

      {/* ================= TAB 2: RESERVATIONS QUEUE ================= */}
      {activeTab === 'reservations' && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tổng lượt đặt trước</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{reservations.length}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                <BookmarkPlus size={22} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Đang chờ sách</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{waitingCount}</p>
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg">
                <Clock size={22} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Đã thông báo</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{notifiedCount}</p>
              </div>
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                <Bell size={22} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Đã nhận sách</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fulfilledCount}</p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo tên sách, tác giả, độc giả, email..."
                value={reservationSearch}
                onChange={(e) => setReservationSearch(e.target.value)}
                className="pl-9 border-none shadow-none focus-visible:ring-0"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setReservationFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${reservationFilter === 'ALL'
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
              >
                Tất cả ({reservations.length})
              </button>
              <button
                onClick={() => setReservationFilter('WAITING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${reservationFilter === 'WAITING'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                  }`}
              >
                Đang chờ ({waitingCount})
              </button>
              <button
                onClick={() => setReservationFilter('NOTIFIED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${reservationFilter === 'NOTIFIED'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                  }`}
              >
                Đã thông báo ({notifiedCount})
              </button>
              <button
                onClick={() => setReservationFilter('FULFILLED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${reservationFilter === 'FULFILLED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                  }`}
              >
                Hoàn tất ({fulfilledCount})
              </button>
              <button
                onClick={() => setReservationFilter('CANCELLED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${reservationFilter === 'CANCELLED'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'
                  }`}
              >
                Đã hủy
              </button>
            </div>
          </div>

          {/* Reservations Table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Đầu sách đặt trước</TableHead>
                  <TableHead>Tình trạng kho</TableHead>
                  <TableHead>Độc giả đang chờ</TableHead>
                  <TableHead>Ngày đăng ký</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động của Thủ thư</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReservations.length > 0 ? (
                  filteredReservations.map((resItem) => {
                    const isBookAvailableInWarehouse = (resItem.book?.available || 0) > 0;

                    return (
                      <TableRow key={resItem.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                        {/* Book Info */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-14 rounded overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800 border">
                              <img
                                src={resItem.book?.coverImage || 'https://via.placeholder.com/40x56?text=No+Cover'}
                                alt={resItem.book?.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white line-clamp-1" title={resItem.book?.title}>
                                {resItem.book?.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{resItem.book?.author}</p>
                              <span className="text-[11px] text-gray-400">ISBN: {resItem.book?.isbn}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Warehouse Status */}
                        <TableCell>
                          {isBookAvailableInWarehouse ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 gap-1">
                              <CheckCircle2 size={12} /> Có sẵn {resItem.book?.available}/{resItem.book?.totalCopies}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 border-gray-300 dark:border-gray-700 gap-1">
                              <Clock size={12} /> Hết bản sao (0/{resItem.book?.totalCopies})
                            </Badge>
                          )}
                        </TableCell>

                        {/* User Info */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold text-xs">
                              {resItem.user?.name ? resItem.user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {resItem.user?.name || 'Vô danh'}
                              </p>
                              <p className="text-xs text-gray-500">{resItem.user?.email}</p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Date Created */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                            <Calendar size={13} className="text-gray-400" />
                            <span>{new Date(resItem.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {new Date(resItem.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </TableCell>

                        {/* Reservation Status */}
                        <TableCell>
                          {resItem.status === 'WAITING' && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 gap-1">
                              <Clock size={12} /> Đang chờ sách
                            </Badge>
                          )}
                          {resItem.status === 'NOTIFIED' && (
                            <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 gap-1">
                              <Bell size={12} /> Đã thông báo có sách
                            </Badge>
                          )}
                          {resItem.status === 'FULFILLED' && (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 gap-1">
                              <CheckCircle2 size={12} /> Đã nhận sách
                            </Badge>
                          )}
                          {resItem.status === 'CANCELLED' && (
                            <Badge variant="secondary" className="gap-1 text-gray-500">
                              <XCircle size={12} /> Đã hủy
                            </Badge>
                          )}
                        </TableCell>

                        {/* Action Buttons for Librarian */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {resItem.status === 'WAITING' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-8 px-2.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                  onClick={() => updateReservationStatusMutation.mutate({ id: resItem.id, status: 'NOTIFIED' })}
                                  disabled={updateReservationStatusMutation.isPending}
                                  title="Gửi thông báo sách đã về thư viện cho độc giả"
                                >
                                  <Bell size={14} className="mr-1" /> Báo có sách
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => {
                                    if (confirm(`Bạn có chắc chắn muốn hủy đặt trước của "${resItem.user?.name}"?`)) {
                                      cancelReservationMutation.mutate(resItem.id);
                                    }
                                  }}
                                  disabled={cancelReservationMutation.isPending}
                                  title="Hủy yêu cầu đặt trước này"
                                >
                                  <XCircle size={14} />
                                </Button>
                              </>
                            )}

                            {resItem.status === 'NOTIFIED' && (
                              <>
                                <Button
                                  size="sm"
                                  className="text-xs h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => updateReservationStatusMutation.mutate({ id: resItem.id, status: 'FULFILLED' })}
                                  disabled={updateReservationStatusMutation.isPending}
                                  title="Xác nhận độc giả đã đến nhận sách thành công"
                                >
                                  <CheckCircle2 size={14} className="mr-1" /> Đã nhận sách
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => {
                                    if (confirm(`Độc giả không đến nhận? Bạn có chắc muốn hủy đặt trước này?`)) {
                                      cancelReservationMutation.mutate(resItem.id);
                                    }
                                  }}
                                  disabled={cancelReservationMutation.isPending}
                                  title="Hủy đặt trước"
                                >
                                  <XCircle size={14} />
                                </Button>
                              </>
                            )}

                            {(resItem.status === 'FULFILLED' || resItem.status === 'CANCELLED') && (
                              <span className="text-xs text-gray-400 italic">Đã kết thúc</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                      {isReservationsLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={18} className="animate-spin text-amber-600" />
                          <span>Đang tải danh sách đặt trước...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-gray-600 dark:text-gray-300 font-medium">Không tìm thấy yêu cầu đặt trước nào</p>
                          <p className="text-xs text-gray-400">Khi một đầu sách hết hàng và độc giả bấm "Đặt trước", yêu cầu sẽ xuất hiện tại đây.</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ================= MODAL BÁO MẤT SÁCH & BỒI THƯỜNG ================= */}
      {lostModalOpen && selectedLoanForLost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-900/40 text-rose-600 rounded-xl">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Báo mất / Hỏng sách</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Xác nhận mất sách và thiết lập mức tiền bồi thường</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setLostModalOpen(false);
                  setSelectedLoanForLost(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Thông tin phiếu mượn */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200/80 dark:border-gray-700/60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tên sách:</span>
                  <span className="font-semibold text-gray-900 dark:text-white text-right truncate max-w-[220px]">
                    {selectedLoanForLost.book?.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mã vạch (Barcode):</span>
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {selectedLoanForLost.bookItem?.barcode || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Độc giả mượn:</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {selectedLoanForLost.user?.name} ({selectedLoanForLost.user?.email})
                  </span>
                </div>
              </div>

              {/* Nhập số tiền bồi thường */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Số tiền đền bù / bồi thường (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="5000"
                    placeholder="Ví dụ: 50000"
                    value={compensationAmount}
                    onChange={(e) => setCompensationAmount(e.target.value)}
                    className="pr-12 text-base font-medium"
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                    VNĐ
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-gray-400">Gợi ý nhanh:</span>
                  {[50000, 100000, 200000, 500000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCompensationAmount(String(preset))}
                      className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      {(preset / 1000).toLocaleString()}k
                    </button>
                  ))}
                </div>
              </div>

              {/* Cảnh báo hậu quả */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5">
                <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Bản sao vật lý này sẽ được cập nhật trạng thái <strong>LOST</strong> và tự động loại khỏi danh mục sẵn có. Phiếu mượn sẽ được đóng lại và ghi nhận khoản bồi thường.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setLostModalOpen(false);
                  setSelectedLoanForLost(null);
                }}
                disabled={reportLostMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium gap-1.5 shadow-sm shadow-rose-600/30"
                disabled={reportLostMutation.isPending || !compensationAmount}
                onClick={() => {
                  const amount = Number(compensationAmount);
                  if (isNaN(amount) || amount < 0) {
                    toast.error('Vui lòng nhập số tiền bồi thường hợp lệ');
                    return;
                  }
                  reportLostMutation.mutate({
                    loanId: selectedLoanForLost.id,
                    compensationAmount: amount
                  });
                }}
              >
                {reportLostMutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
                ) : (
                  <><AlertTriangle size={16} /> Xác nhận báo mất</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}