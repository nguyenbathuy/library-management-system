import { ShieldAlert, Home, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export function Forbidden() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 animate-in fade-in zoom-in-95">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-inner">
          <ShieldAlert size={42} />
        </div>

        <span className="px-3.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full text-xs font-bold tracking-wider uppercase">
          403 Forbidden
        </span>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
          Quyền truy cập bị từ chối
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          Tài khoản của bạn ({user?.email || 'Người dùng'}) có vai trò{' '}
          <strong className="text-gray-900 dark:text-gray-200">
            {user?.role === 'ADMIN' ? 'Thủ thư (ADMIN)' : 'Độc giả (USER)'}
          </strong>
          , không được phân quyền để truy cập vào trang quản trị này.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/books')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95"
          >
            <BookOpen size={16} />
            Tra cứu Tủ sách
          </button>
          <button
            onClick={() => navigate(user?.role === 'ADMIN' ? '/' : '/profile')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-all active:scale-95"
          >
            <Home size={16} />
            {user?.role === 'ADMIN' ? 'Về Bảng điều khiển' : 'Hồ sơ của tôi'}
          </button>
        </div>
      </div>
    </div>
  );
}
