import { BarChart3, Users, BookOpen, AlertCircle, TrendingUp, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/client';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.setFontSize(16);
      pdf.text('Báo Cáo Thống Kê Thư Viện', 14, 15);
      
      pdf.addImage(imgData, 'PNG', 14, 25, pdfWidth - 28, pdfHeight - 28);
      pdf.save('bao-cao-thu-vien.pdf');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Có lỗi xảy ra khi xuất báo cáo PDF');
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

  const chartData = trends.map(t => ({
    name: `T${t.month}`,
    "Lượt mượn": t.count
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="text-blue-600" />
            Bảng điều khiển
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Chào mừng trở lại! Dưới đây là tình hình hoạt động của thư viện hôm nay.
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors shadow-sm"
        >
          <Download size={18} />
          {isExporting ? 'Đang xuất...' : 'Xuất báo cáo PDF'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tổng đầu sách</p>
              <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.totalBooks || 0}</h3>
              <p className="text-xs text-gray-400 mt-1">Cuốn trong kho</p>
            </div>
            <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <BookOpen className="text-blue-600 dark:text-blue-400" size={32} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Độc giả hoạt động</p>
              <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.activeUsers || 0}</h3>
              <p className="text-xs text-gray-400 mt-1">Thành viên</p>
            </div>
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="text-green-600 dark:text-green-400" size={32} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Đang cho mượn</p>
              <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.totalBorrowed || 0}</h3>
              <p className="text-xs text-gray-400 mt-1">Phiếu mượn</p>
            </div>
            <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="text-purple-600 dark:text-purple-400" size={32} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sách quá hạn</p>
              <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats?.overdueBooks || 0}</h3>
              <p className="text-xs text-gray-400 mt-1">Cần thu hồi ngay</p>
            </div>
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertCircle className="text-red-600 dark:text-red-400" size={32} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" ref={chartRef}>
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-600" />
                Xu hướng mượn sách (Năm 2026)
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
              <Bar dataKey="Lượt mượn" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Books */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-orange-600" />
            Sách đọc nhiều
          </h3>
          <div className="space-y-3">
            {topBooks.map((book, index) => (
              <div key={book.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
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
                    {book.borrowCount} lượt
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
          Hoạt động mượn trả gần đây
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
                  {' '}đã {activity.action === 'borrowed' ? 'mượn' : 'trả'} cuốn{' '}
                  <span className="font-medium">"{activity.bookTitle}"</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(activity.date).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}