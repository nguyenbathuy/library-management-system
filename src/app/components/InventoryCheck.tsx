import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { client } from '../api/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDFInstance, { jsPDF } from 'jspdf';
import {
  ClipboardCheck,
  QrCode,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileSpreadsheet,
  Download,
  RotateCcw,
  Search,
  Trash2,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  Eye,
  Barcode,
  MapPin,
  X
} from 'lucide-react';

interface ExpectedItem {
  id: number;
  barcode: string;
  location: string;
  status: string;
  bookTitle: string;
  isbn: string;
  author: string;
  category: string;
  coverImage?: string;
}

interface VerificationResult {
  summary: {
    totalExpected: number;
    totalScanned: number;
    matchedCount: number;
    missingCount: number;
    anomalousCount: number;
    accuracyRate: string;
    checkedAt: string;
  };
  matched: Array<{
    id: number;
    barcode: string;
    bookTitle: string;
    author: string;
    category: string;
    location: string;
    status: string;
  }>;
  missing: Array<{
    id: number;
    barcode: string;
    bookTitle: string;
    author: string;
    category: string;
    location: string;
    status: string;
  }>;
  anomalous: Array<{
    id?: number;
    barcode: string;
    issueType: string;
    reason: string;
    bookTitle: string;
    author: string;
    location: string;
    dbStatus: string;
  }>;
}

export function InventoryCheck() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedList, setScannedList] = useState<string[]>([]);
  const [activeResultTab, setActiveResultTab] = useState<'MATCHED' | 'MISSING' | 'ANOMALOUS'>('MATCHED');
  const [result, setResult] = useState<VerificationResult | null>(null);

  // States cho Modal Xem chi tiết kho dự kiến
  const [showExpectedModal, setShowExpectedModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Fetch expected AVAILABLE inventory from database
  const { data: expectedData, isLoading: isLoadingExpected, refetch: refetchExpected } = useQuery<{
    total: number;
    items: ExpectedItem[];
  }>({
    queryKey: ['inventory-expected'],
    queryFn: async () => {
      const { data } = await client.get('/inventory/expected');
      return data;
    }
  });

  const expectedTotal = expectedData?.total || 0;

  // Lọc nhanh danh sách sách dự kiến theo tên sách, mã vạch, tác giả hoặc vị trí
  const filteredExpectedItems = (expectedData?.items || []).filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.bookTitle.toLowerCase().includes(q) ||
      item.barcode.toLowerCase().includes(q) ||
      (item.author && item.author.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  // Đóng modal và tự động focus lại ô quét mã vạch
  const handleCloseExpectedModal = () => {
    setShowExpectedModal(false);
    setSearchQuery('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
  };

  // Auto focus input on mount and whenever user clicks outside
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Web Audio Beep sound on scan
  const playScanBeep = (isError = false) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = isError ? 300 : 900;
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext may be restricted by browser policy
    }
  };

  // Add barcode on Enter (Bar-code scanner trigger)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim().toUpperCase();
      if (!code) return;

      if (scannedList.includes(code)) {
        playScanBeep(true);
        toast.warning(`Mã vạch "${code}" đã được quét trước đó trong đợt này!`);
      } else {
        playScanBeep(false);
        setScannedList(prev => [code, ...prev]);
        toast.success(`Đã ghi nhận mã vạch: ${code}`);
      }

      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    }
  };

  const handleRemoveScanned = (codeToRemove: string) => {
    setScannedList(prev => prev.filter(c => c !== codeToRemove));
  };

  const handleResetSession = () => {
    if (scannedList.length === 0 && !result) return;
    if (confirm('Bạn có chắc chắn muốn làm mới đợt kiểm kê này và xóa toàn bộ danh sách đã quét?')) {
      setScannedList([]);
      setResult(null);
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
      toast.info('Đã làm mới phiên kiểm kê');
    }
  };

  // Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: async (barcodes: string[]) => {
      const { data } = await client.post('/inventory/verify', {
        scannedBarcodes: barcodes
      });
      return data as VerificationResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Đã hoàn tất đối chiếu kiểm kê kho sách!');
      if (data.missing.length > 0 || data.anomalous.length > 0) {
        setActiveResultTab('MISSING');
      } else {
        setActiveResultTab('MATCHED');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Có lỗi khi đối chiếu kiểm kê');
    }
  });

  const handleVerify = () => {
    if (scannedList.length === 0) {
      toast.error('Vui lòng quét ít nhất một mã vạch trước khi đối chiếu');
      barcodeInputRef.current?.focus();
      return;
    }
    verifyMutation.mutate(scannedList);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!result) {
      toast.error('Chưa có kết quả đối chiếu để xuất báo cáo');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Tổng hợp
      const summaryData = [
        ['BÁO CÁO KIỂM KÊ KHO SÁCH ĐỊNH KỲ'],
        ['Thời gian lập biểu:', new Date(result.summary.checkedAt).toLocaleString('vi-VN')],
        [''],
        ['Chỉ số', 'Số lượng', 'Tỷ lệ'],
        ['Tổng sách dự kiến trên kệ (AVAILABLE)', result.summary.totalExpected, '100%'],
        ['Tổng mã vạch quét được thực tế', result.summary.totalScanned, ''],
        ['Sách hợp lệ (Đúng vị trí trên kệ)', result.summary.matchedCount, `${result.summary.accuracyRate}%`],
        ['Sách bị thiếu (Thất lạc / chưa quét)', result.summary.missingCount, ''],
        ['Sách bất thường (Sai trạng thái / Mã lạ)', result.summary.anomalousCount, '']
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng Quan');

      // Sheet 2: Sách hợp lệ
      const matchedData = result.matched.map((item, idx) => ({
        'STT': idx + 1,
        'Mã vạch (Barcode)': item.barcode,
        'Tên sách': item.bookTitle,
        'Tác giả': item.author,
        'Thể loại': item.category,
        'Vị trí kệ': item.location,
        'Kết quả': 'HỢP LỆ'
      }));
      const wsMatched = XLSX.utils.json_to_sheet(matchedData);
      XLSX.utils.book_append_sheet(wb, wsMatched, 'Sách Hợp Lệ');

      // Sheet 3: Sách bị thiếu
      const missingData = result.missing.map((item, idx) => ({
        'STT': idx + 1,
        'Mã vạch (Barcode)': item.barcode,
        'Tên sách': item.bookTitle,
        'Tác giả': item.author,
        'Thể loại': item.category,
        'Vị trí kệ dự kiến': item.location,
        'Ghi chú': 'Không quét được trên kệ (Cần kiểm tra)'
      }));
      const wsMissing = XLSX.utils.json_to_sheet(missingData);
      XLSX.utils.book_append_sheet(wb, wsMissing, 'Sách Bị Thiếu');

      // Sheet 4: Sách bất thường
      const anomalousData = result.anomalous.map((item, idx) => ({
        'STT': idx + 1,
        'Mã vạch (Barcode)': item.barcode,
        'Tên sách': item.bookTitle,
        'Trạng thái CSDL': item.dbStatus,
        'Vị trí': item.location,
        'Chi tiết cảnh báo': item.reason
      }));
      const wsAnomalous = XLSX.utils.json_to_sheet(anomalousData);
      XLSX.utils.book_append_sheet(wb, wsAnomalous, 'Sách Bất Thường');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Bao-Cao-Kiem-Ke-Kho-${dateStr}.xlsx`);
      toast.success('Đã xuất báo cáo Excel thành công!');
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xuất file Excel');
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (!result) {
      toast.error('Chưa có kết quả đối chiếu để xuất báo cáo');
      return;
    }

    try {
      const Constructor = (jsPDF as any) || (jsPDFInstance as any)?.jsPDF || (jsPDFInstance as any)?.default || jsPDFInstance;
      const doc = new (Constructor as any)();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('THU VIEN PKA - BIEN BAN KIEM KE KHO SACH', 20, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Ngay kiem ke: ${new Date(result.summary.checkedAt).toLocaleString('vi-VN')}`, 20, 28);
      doc.text(`Tong so sach du kien (Available): ${result.summary.totalExpected}`, 20, 36);
      doc.text(`Tong so ma vach da quet: ${result.summary.totalScanned}`, 20, 42);
      doc.text(`Sach hop le: ${result.summary.matchedCount}`, 20, 48);
      doc.text(`Sach thieu tren ke: ${result.summary.missingCount}`, 20, 54);
      doc.text(`Sach bat thuong / sai trang thai: ${result.summary.anomalousCount}`, 20, 60);
      doc.text(`Ty le khop kho: ${result.summary.accuracyRate}%`, 20, 66);

      doc.setFont('Helvetica', 'bold');
      doc.text('DANH SACH CAN XU LY (SACH THIEU & BAT THUONG):', 20, 80);

      doc.setFont('Helvetica', 'normal');
      let y = 88;
      const combinedIssues = [
        ...result.missing.map(m => `[THIEU] ${m.barcode} - ${m.bookTitle.slice(0, 35)} (${m.location})`),
        ...result.anomalous.map(a => `[BAT THUONG: ${a.dbStatus}] ${a.barcode} - ${a.bookTitle.slice(0, 30)}`)
      ];

      if (combinedIssues.length === 0) {
        doc.text('Kho sach hoan hao, khong co sach thieu hoac bat thuong!', 20, y);
      } else {
        combinedIssues.slice(0, 25).forEach((line) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 20, y);
          y += 7;
        });
      }

      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`Bien-Ban-Kiem-Ke-${dateStr}.pdf`);
      toast.success('Đã xuất biên bản kiểm kê PDF thành công!');
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xuất file PDF');
    }
  };

  const progressPercent = expectedTotal > 0
    ? Math.min(100, Math.round((scannedList.length / expectedTotal) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="text-blue-600 dark:text-blue-400" />
            Kiểm kê kho sách định kỳ
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Quét mã vạch thực tế trên kệ để tự động đối chiếu dữ liệu tồn kho, phát hiện sách mất và sai trạng thái
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetSession}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
            title="Làm mới toàn bộ danh sách đã quét"
          >
            <RotateCcw size={15} />
            <span>Làm mới</span>
          </button>

          {result && (
            <>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95"
              >
                <FileSpreadsheet size={15} />
                <span>Xuất Excel (.xlsx)</span>
              </button>

              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95"
              >
                <FileText size={15} />
                <span>Xuất Báo cáo PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress & Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Sách dự kiến trên kệ</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowExpectedModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer"
                title="Xem danh sách chi tiết các mã vạch dự kiến trong kho"
              >
                <Eye size={13} />
                <span>Xem chi tiết</span>
              </button>
              <span className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <Layers size={16} />
              </span>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {isLoadingExpected ? '...' : expectedTotal}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-gray-400">Trạng thái AVAILABLE trong CSDL</p>
            <button
              type="button"
              onClick={() => setShowExpectedModal(true)}
              className="text-[11px] font-medium text-blue-500 hover:underline cursor-pointer"
            >
              Danh sách chi tiết &rarr;
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Đã quét thực tế</span>
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <QrCode size={18} />
            </span>
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {scannedList.length}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Mã vạch duy nhất trong đợt này</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Tiến độ quét kho</span>
            <span className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg">
              <TrendingUp size={18} />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {progressPercent}%
          </p>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Barcode Scanner Section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="text-center">
            <label className="block text-base font-bold text-gray-900 dark:text-white mb-1">
              Khu vực nhập / Máy quét mã vạch (Barcode Scanner)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Đặt đầu đọc mã vạch vào vạch sách hoặc gõ trực tiếp mã rồi ấn <strong>Enter</strong>. Ô nhập luôn tự động giữ con trỏ.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-600 dark:text-blue-400">
              <ScanLine size={24} className="animate-pulse" />
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Quét mã vạch sách (VD: BC-9780132350884-001)..."
              className="w-full pl-12 pr-28 py-3.5 bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-400 dark:border-blue-600 rounded-xl text-base font-mono font-bold text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-inner"
            />
            <button
              type="button"
              onClick={() => {
                if (barcodeInput.trim()) {
                  const fakeEvent = { key: 'Enter', preventDefault: () => {} } as any;
                  handleKeyDown(fakeEvent);
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Thêm
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Đã quét: <strong className="text-blue-600 font-mono">{scannedList.length}</strong> cuốn</span>
            <button
              onClick={handleVerify}
              disabled={scannedList.length === 0 || verifyMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <ClipboardCheck size={16} />
              <span>{verifyMutation.isPending ? 'Đang đối chiếu...' : 'Hoàn tất đối chiếu kho'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Temporary Scanned Barcodes Badges */}
        {scannedList.length > 0 && (
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Danh sách mã vừa quét ({scannedList.length} mã)
              </span>
              <button
                onClick={() => setScannedList([])}
                className="text-xs text-red-500 hover:underline flex items-center gap-1"
              >
                <Trash2 size={12} /> Xóa danh sách tạm
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
              {scannedList.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono font-medium shadow-2xs group"
                >
                  <span>{code}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveScanned(code)}
                    className="text-gray-400 hover:text-red-500 ml-1 rounded"
                    title="Xóa mã này khỏi danh sách quét"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Verification Result Section */}
      {result && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
          {/* Header of results */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-850 dark:to-gray-900">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-500" />
                  Kết quả đối chiếu kho sách
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Thời điểm kiểm kê: {new Date(result.summary.checkedAt).toLocaleString('vi-VN')}
                </p>
              </div>

              {/* Accuracy Pill */}
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-center shadow-xs">
                  <span className="text-[11px] text-gray-500 font-medium block">Tỷ lệ khớp kho</span>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {result.summary.accuracyRate}%
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stat Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              <button
                type="button"
                onClick={() => setActiveResultTab('MATCHED')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  activeResultTab === 'MATCHED'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> 1. Sách hợp lệ
                  </span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {result.summary.matchedCount}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Đúng số lượng, có mặt trên kệ
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveResultTab('MISSING')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  activeResultTab === 'MISSING'
                    ? 'border-red-500 bg-red-50/70 text-red-950 dark:bg-red-950/30 dark:text-red-300 shadow-sm ring-2 ring-red-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> 2. Sách bị thiếu
                  </span>
                  <span className="text-xl font-extrabold text-red-600 dark:text-red-400">
                    {result.summary.missingCount}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Có trong CSDL nhưng không thấy trên kệ
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveResultTab('ANOMALOUS')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  activeResultTab === 'ANOMALOUS'
                    ? 'border-purple-500 bg-purple-50/70 text-purple-950 dark:bg-purple-950/30 dark:text-purple-300 shadow-sm ring-2 ring-purple-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                    <HelpCircle size={16} /> 3. Sách bất thường
                  </span>
                  <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                    {result.summary.anomalousCount}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Đang báo Mượn/Mất hoặc mã vạch lạ
                </p>
              </button>
            </div>
          </div>

          {/* TAB 1: SÁCH HỢP LỆ */}
          {activeResultTab === 'MATCHED' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">STT</th>
                    <th className="px-4 py-3">Mã vạch (Barcode)</th>
                    <th className="px-4 py-3">Tên sách</th>
                    <th className="px-4 py-3">Tác giả</th>
                    <th className="px-4 py-3">Thể loại</th>
                    <th className="px-4 py-3">Vị trí kệ</th>
                    <th className="px-4 py-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {result.matched.length > 0 ? (
                    result.matched.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3 text-gray-400 font-mono">#{idx + 1}</td>
                        <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                          {item.barcode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                          {item.bookTitle}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.author}</td>
                        <td className="px-4 py-3 text-gray-500">{item.category}</td>
                        <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">
                          {item.location}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                            <CheckCircle2 size={11} /> Khớp kho
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        Không có cuốn sách nào được quét khớp hợp lệ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: SÁCH BỊ THIẾU */}
          {activeResultTab === 'MISSING' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-red-50/70 dark:bg-red-950/20 text-red-900 dark:text-red-300 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">STT</th>
                    <th className="px-4 py-3">Mã vạch (Barcode)</th>
                    <th className="px-4 py-3">Tên sách bị thiếu</th>
                    <th className="px-4 py-3">Tác giả</th>
                    <th className="px-4 py-3">Thể loại</th>
                    <th className="px-4 py-3">Vị trí kệ dự kiến</th>
                    <th className="px-4 py-3 text-right">Cảnh báo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {result.missing.length > 0 ? (
                    result.missing.map((item, idx) => (
                      <tr key={idx} className="hover:bg-red-50/30 dark:hover:bg-red-950/10">
                        <td className="px-4 py-3 text-gray-400 font-mono">#{idx + 1}</td>
                        <td className="px-4 py-3 font-mono font-bold text-red-600 dark:text-red-400">
                          {item.barcode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                          {item.bookTitle}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.author}</td>
                        <td className="px-4 py-3 text-gray-500">{item.category}</td>
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          {item.location}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200">
                            <AlertTriangle size={11} /> Không thấy trên kệ
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-emerald-600 font-medium">
                        Tuyệt vời! Không có cuốn sách nào bị thiếu trên kệ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: SÁCH BẤT THƯỜNG */}
          {activeResultTab === 'ANOMALOUS' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-purple-50/70 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">STT</th>
                    <th className="px-4 py-3">Mã vạch quét được</th>
                    <th className="px-4 py-3">Tên sách</th>
                    <th className="px-4 py-3">Trạng thái trong DB</th>
                    <th className="px-4 py-3">Lý do bất thường / Cần giải quyết</th>
                    <th className="px-4 py-3 text-right">Phân loại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {result.anomalous.length > 0 ? (
                    result.anomalous.map((item, idx) => (
                      <tr key={idx} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10">
                        <td className="px-4 py-3 text-gray-400 font-mono">#{idx + 1}</td>
                        <td className="px-4 py-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                          {item.barcode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                          {item.bookTitle}
                        </td>
                        <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">
                          {item.dbStatus}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">
                          {item.reason}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200">
                            <HelpCircle size={11} /> Cần kiểm tra lại
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-emerald-600 font-medium">
                        Không phát hiện mã vạch hoặc trạng thái bất thường nào trên kệ!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Chi tiết kho sách dự kiến (Expected Inventory Modal) */}
      {showExpectedModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={handleCloseExpectedModal}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCloseExpectedModal();
          }}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Layers size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    Danh sách Sách dự kiến trên kệ (Kho Available)
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {expectedTotal} cuốn
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Toàn bộ các bản sao sách (BookItem) đang ở trạng thái AVAILABLE sẵn sàng trên các kệ thư viện
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseExpectedModal}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                title="Đóng cửa sổ (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Search & Summary Bar */}
            <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm nhanh theo tên sách, mã vạch, tác giả hoặc vị trí kệ..."
                  className="w-full pl-10 pr-9 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full"
                    title="Xóa tìm kiếm"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Hiển thị <strong className="text-gray-900 dark:text-white font-semibold">{filteredExpectedItems.length}</strong> / {expectedTotal} bản sao
                </span>
                {searchQuery && (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    (đang lọc kết quả)
                  </span>
                )}
              </div>
            </div>

            {/* Data Table */}
            <div className="flex-1 overflow-y-auto">
              {filteredExpectedItems.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <Search size={22} />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Không tìm thấy bản sao sách nào
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Thử thay đổi từ khóa tìm kiếm "{searchQuery}"
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800/70 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 border-b border-gray-200 dark:border-gray-800 z-10">
                    <tr>
                      <th className="py-3 px-4 w-14 text-center">STT</th>
                      <th className="py-3 px-4">Tên sách & Tác giả</th>
                      <th className="py-3 px-4 w-48">Mã vạch (Barcode)</th>
                      <th className="py-3 px-4 w-44">Vị trí (Location)</th>
                      <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {filteredExpectedItems.map((item, index) => (
                      <tr
                        key={item.id || item.barcode}
                        className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                      >
                        <td className="py-3 px-4 text-center text-xs font-mono text-gray-400">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {item.bookTitle}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                            {item.author && <span>Tác giả: {item.author}</span>}
                            {item.category && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600 dark:text-blue-400">{item.category}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                            <Barcode size={14} className="text-gray-400" />
                            <span>{item.barcode}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                            <MapPin size={13} className="text-amber-500 shrink-0" />
                            <span>{item.location || 'Khu A - Kệ 1'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                            <CheckCircle2 size={12} />
                            AVAILABLE
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Mẹo: Bấm phím <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded shadow-xs">Esc</kbd> để đóng và tiếp tục quét mã vạch
              </span>
              <button
                type="button"
                onClick={handleCloseExpectedModal}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
