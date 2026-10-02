import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { toast } from 'sonner';
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Building2,
  Lock,
  Loader2,
  AlertTriangle,
  Receipt,
  Smartphone
} from 'lucide-react';

export function MockPaymentGateway() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loanId = Number(searchParams.get('loanId') || '0');
  const amountParam = Number(searchParams.get('amount') || '15000');
  const txnRef = searchParams.get('txnRef') || `TXN-${Date.now()}`;
  const bookTitle = searchParams.get('bookTitle') || 'Tài liệu Thư viện';
  const initialMethod = searchParams.get('method') || 'MOMO';

  const [activeTab, setActiveTab] = useState<'MOMO' | 'CARD'>(initialMethod === 'CARD' ? 'CARD' : 'MOMO');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes countdown

  // Fake Card inputs
  const [cardNumber, setCardNumber] = useState('9704 2292 8888 6868');
  const [cardHolder, setCardHolder] = useState('NGUYEN VAN A');
  const [expiryDate, setExpiryDate] = useState('12/28');
  const [cvv, setCvv] = useState('888');

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || isSuccess) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSuccess]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConfirmPayment = async () => {
    if (!loanId) {
      toast.error('Thiếu mã phiếu mượn cần thanh toán');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate 1.2s network delay for realistic gateway verification
      await new Promise(resolve => setTimeout(resolve, 1200));

      const res = await client.post('/payments/callback', {
        loanId,
        txnRef,
        method: activeTab,
        status: 'SUCCESS'
      });

      setIsSuccess(true);
      toast.success(res.data?.message || 'Thanh toán phí phạt thành công!');

      // Refresh loan queries
      queryClient.invalidateQueries({ queryKey: ['my-loans'] });
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });

      // Auto redirect to profile after 1.8 seconds
      setTimeout(() => {
        navigate('/profile');
      }, 1800);
    } catch (err: any) {
      setIsProcessing(false);
      toast.error(err.response?.data?.error || 'Có lỗi xảy ra khi xử lý thanh toán');
    }
  };

  const handleCancel = () => {
    if (confirm('Bạn có chắc chắn muốn hủy giao dịch thanh toán này?')) {
      toast.info('Đã hủy phiên thanh toán');
      navigate('/profile');
    }
  };

  if (!loanId) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Không tìm thấy thông tin giao dịch</h3>
        <p className="text-sm text-gray-500 mb-4">Vui lòng chọn phiếu mượn cần nộp phạt từ trang cá nhân.</p>
        <button
          onClick={() => navigate('/profile')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Quay lại Hồ sơ
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={handleCancel}
          disabled={isProcessing || isSuccess}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Hủy & Quay lại</span>
        </button>
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-full">
          <ShieldCheck size={16} />
          <span>Cổng thanh toán bảo mật 256-bit SSL</span>
        </div>
      </div>

      {/* Main Payment Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
        {isSuccess ? (
          /* SUCCESS STATE */
          <div className="p-12 text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Giao dịch thành công!
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
              Hệ thống đã ghi nhận thanh toán phí phạt cho phiếu mượn <strong>#{loanId}</strong>. Bạn sẽ được chuyển hướng về trang cá nhân ngay bây giờ...
            </p>
            <div className="pt-4">
              <button
                onClick={() => navigate('/profile')}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-md transition-all"
              >
                Về trang cá nhân ngay
              </button>
            </div>
          </div>
        ) : (
          /* PAYMENT FORM */
          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">
            {/* Left Column: Invoice summary */}
            <div className="md:col-span-5 p-6 bg-gray-50/70 dark:bg-gray-800/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
                  <Receipt size={22} />
                  <span className="font-bold uppercase tracking-wider text-xs">
                    Chi tiết khoản nộp phạt
                  </span>
                </div>

                <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tên tài liệu / Sách</p>
                  <h4 className="font-bold text-gray-900 dark:text-white text-base leading-snug line-clamp-2">
                    {bookTitle}
                  </h4>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs">
                    <span className="text-gray-500">Mã phiếu mượn:</span>
                    <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">#{loanId}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-gray-500">Mã đối soát:</span>
                    <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[140px]" title={txnRef}>
                      {txnRef}
                    </span>
                  </div>
                </div>

                {/* Amount display */}
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                    Tổng số tiền thanh toán:
                  </p>
                  <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                    {amountParam.toLocaleString('vi-VN')} <span className="text-lg font-bold">VNĐ</span>
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                    (Phí quá hạn & phí dịch vụ thư viện)
                  </p>
                </div>
              </div>

              {/* Countdown timer */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-500" />
                  Hết hạn sau:
                </span>
                <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>

            {/* Right Column: Payment method selector & action */}
            <div className="md:col-span-7 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                  <span>Phương thức thanh toán</span>
                  <span className="text-xs font-normal text-gray-400 flex items-center gap-1">
                    <Lock size={12} /> Giả lập môi trường Test
                  </span>
                </h3>

                {/* Method Tabs */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('MOMO')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-medium text-sm transition-all ${
                      activeTab === 'MOMO'
                        ? 'border-pink-500 bg-pink-50/70 text-pink-700 dark:bg-pink-950/30 dark:border-pink-500 dark:text-pink-300 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-pink-600 flex items-center justify-center text-white text-[10px] font-black">
                      M
                    </div>
                    <span>Ví MoMo / VietQR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('CARD')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-medium text-sm transition-all ${
                      activeTab === 'CARD'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-700 dark:bg-blue-950/30 dark:border-blue-500 dark:text-blue-300 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <CreditCard size={18} />
                    <span>Thẻ ATM / Visa</span>
                  </button>
                </div>

                {/* TAB 1: MOMO / VIETQR */}
                {activeTab === 'MOMO' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-pink-50/40 dark:bg-pink-950/10 border border-pink-100 dark:border-pink-900/30 rounded-xl flex flex-col sm:flex-row items-center gap-4">
                      {/* Fake QR Image */}
                      <div className="w-36 h-36 bg-white p-2 rounded-xl shadow-md border border-gray-200 shrink-0 flex flex-col items-center justify-center relative">
                        <QrCode size={116} className="text-gray-800" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-white font-black text-xs shadow-md">
                            M
                          </div>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div className="text-xs space-y-1.5 flex-1">
                        <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 mb-1 text-sm">
                          <Smartphone size={16} className="text-pink-600" />
                          Quét mã QR để thanh toán
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                          Mở Ứng dụng MoMo hoặc Ngân hàng (MB, Vietcombank...) để quét mã.
                        </p>
                        <div className="pt-2 border-t border-pink-100 dark:border-pink-900/30 text-[11px] text-gray-500 space-y-0.5">
                          <p>Chủ TK: <strong className="text-gray-700 dark:text-gray-300">THU VIEN PKA</strong></p>
                          <p>Nội dung: <strong className="text-pink-600 font-mono">PHAT {loanId}</strong></p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <ShieldCheck size={16} className="shrink-0 text-blue-600" />
                      <span>Hệ thống giả lập: Bấm <strong>"Xác nhận thanh toán"</strong> bên dưới để hoàn tất ngay mà không cần quét thật.</span>
                    </div>
                  </div>
                )}

                {/* TAB 2: BANK CARD */}
                {activeTab === 'CARD' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Số thẻ thanh toán
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full px-3 py-2 pl-9 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="9704 xxxx xxxx xxxx"
                        />
                        <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Tên chủ thẻ (In hoa không dấu)
                      </label>
                      <input
                        type="text"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="NGUYEN VAN A"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Ngày hết hạn
                        </label>
                        <input
                          type="text"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="MM/YY"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          CVV / CVC
                        </label>
                        <input
                          type="password"
                          maxLength={3}
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="888"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={isProcessing}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Đang xử lý giao dịch...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Xác nhận thanh toán ({amountParam.toLocaleString('vi-VN')} đ)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="px-5 py-3 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
