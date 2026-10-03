import { BarChart3, Users, BookOpen, AlertCircle, TrendingUp, Download, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/client';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import jsPDFInstance, { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DashboardStats {
  totalBooks: number;
  activeUsers: number;
  totalBorrowed: number;
  overdueBooks: number;
}

interface BorrowTrend {
  month: number;
  count: number;
}

interface TopBook {
  id: number;
  title: string;
  borrowCount: number;
}

interface RecentActivity {
  id: number;
  userName: string;
  bookTitle: string;
  action: string;
  date: string;
}

export function Dashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportTime, setExportTime] = useState<string>('');
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    try {
      setIsExporting(true);

      const now = new Date();
      const formattedDate = now.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setExportTime(formattedDate);

      // Chờ React cập nhật DOM với timestamp mới nhất
      await new Promise(resolve => setTimeout(resolve, 80));

      const isDark = document.documentElement.classList.contains('dark');
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: isDark ? '#111827' : '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const Constructor = (jsPDF as any) || (jsPDFInstance as any)?.jsPDF || (jsPDFInstance as any)?.default || jsPDFInstance;
      const pdf = new (Constructor as any)('l', 'mm', 'a4');
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const pdfWidth = pageWidth - (margin * 2);
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // KHÔNG sử dụng pdf.text() để tránh lỗi font tiếng Việt của jsPDF.
      // Toàn bộ tiêu đề, logo, ngày giờ và số liệu đều được chụp từ HTML canvas chuẩn Unicode 100%.
      const contentTop = 10;
      const availableHeight = pageHeight - (contentTop * 2);

      if (pdfHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin, contentTop, pdfWidth, pdfHeight, undefined, 'FAST');
      } else {
        let heightLeft = pdfHeight;
        let position = contentTop;

        pdf.addImage(imgData, 'PNG', margin, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - contentTop);

        while (heightLeft > 0) {
          pdf.addPage();
          position = heightLeft - pdfHeight;
          pdf.addImage(imgData, 'PNG', margin, position, pdfWidth, pdfHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`bao-cao-thu-vien-${now.toISOString().slice(0, 10)}.pdf`);
      toast.success('Xuất báo cáo PDF thành công!');
    } catch (error) {
      console.error('Lỗi chi tiết khi xuất báo cáo PDF:', error);
      toast.error('Có lỗi xảy ra khi xuất báo cáo PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['analytics-stats'],
    queryFn: async () => {
      const { data } = await client.get('/analytics/stats');
      return data;
    }
  });

  // Fetch borrow trends
  const { data: trends = [] } = useQuery<BorrowTrend[]>({
    queryKey: ['borrow-trends'],
    queryFn: async () => {
      const { data } = await client.get('/analytics/borrow-trends?year=2026');
      return data;
    }
  });

  // Fetch top books
  const { data: topBooks = [] } = useQuery<TopBook[]>({
    queryKey: ['top-books'],
    queryFn: async () => {
      const { data } = await client.get('/analytics/top-books?limit=5');
      return data;
    }
  });

  // Fetch recent activity
  const { data: activities = [] } = useQuery<RecentActivity[]>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data } = await client.get('/analytics/recent-activity?limit=10');
      return data;
    }
  });

  const borrowMetricLabel = t('dashboard.borrowCount');
  const chartData = trends.map(tData => ({
    name: language === 'vi' ? `T${tData.month}` : `M${tData.month}`,
    [borrowMetricLabel]: tData.count
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="text-blue-600" />
            {t('dashboard.title')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors shadow-sm text-sm font-semibold cursor-pointer disabled:cursor-not-allowed"
        >
          {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {isExporting ? t('dashboard.exporting') : t('dashboard.exportPdf')}
        </button>
      </div>

      <div ref={dashboardRef} className="space-y-6">
        {/* Khối Header Báo Cáo - Xuất hiện trong file PDF xuất ra chuẩn tiếng Việt 100% */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/images/phenikaa-logo.png"
              alt="Phenikaa University"
              className="w-14 h-14 object-contain"
            />
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('dashboard.title')} - {t('brand.name')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Trường Đại học Phenikaa • Trung tâm Thông tin - Thư viện
              </p>
            </div>
          </div>
          <div className="flex sm:flex-col sm:items-end justify-between text-xs text-gray-500 dark:text-gray-400 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"></span>
              {language === 'vi' ? 'Báo cáo thống kê' : 'Statistics Report'}
            </span>
            <p className="mt-1">
              {language === 'vi' ? 'Thời gian xuất' : 'Exported at'}:{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {exportTime || new Date().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </p>
            {user?.name && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {language === 'vi' ? 'Người lập' : 'Generated by'}: {user.name}
              </p>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.totalBooks')}</p>
                <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.totalBooks || 0}</h3>
                <p className="text-xs text-gray-400 mt-1">{t('dashboard.inStock')}</p>
              </div>
              <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BookOpen className="text-blue-600 dark:text-blue-400" size={32} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.activeUsers')}</p>
                <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.activeUsers || 0}</h3>
                <p className="text-xs text-gray-400 mt-1">{t('dashboard.membersCount')}</p>
              </div>
              <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="text-green-600 dark:text-green-400" size={32} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.borrowing')}</p>
                <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.totalBorrowed || 0}</h3>
                <p className="text-xs text-gray-400 mt-1">{t('dashboard.activeLoans')}</p>
              </div>
              <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="text-purple-600 dark:text-purple-400" size={32} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.overdueBooks')}</p>
                <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.overdueBooks || 0}</h3>
                <p className="text-xs text-gray-400 mt-1">{t('dashboard.needAction')}</p>
              </div>
              <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-600" />
                {t('dashboard.trendTitle')}
              </h3>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Bar dataKey={borrowMetricLabel} fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Books */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-orange-600" />
            {t('dashboard.topBooks')}
          </h3>
          <div className="space-y-3">
            {topBooks.map((book, index) => (
              <div key={book.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  index === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' :
                  index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {book.title}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {book.borrowCount} {t('dashboard.times')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
          {t('dashboard.recentActivity')}
        </h3>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <div className={`p-2 rounded-lg ${activity.action === 'borrowed'
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'bg-green-100 dark:bg-green-900/30'
                }`}>
                <BookOpen size={16} className={
                  activity.action === 'borrowed'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-green-600 dark:text-green-400'
                } />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-medium">{activity.userName}</span>
                  {' '}{activity.action === 'borrowed' ? t('dashboard.borrowedAction') : t('dashboard.returnedAction')}{' '}
                  <span className="font-medium">"{activity.bookTitle}"</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(activity.date).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
}