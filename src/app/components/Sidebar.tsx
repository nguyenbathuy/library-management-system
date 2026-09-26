import { LayoutDashboard, Book, Users, BookMarked, Settings, Moon, Sun, History } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const userRole = user?.role;

  const getLinkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
    }`;

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-300">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
          L
        </div>
        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Thư Viện PKA
        </span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">

        {/* --- DÀNH CHO THỦ THƯ (ADMIN) --- */}
        {userRole === 'ADMIN' && (
          <NavLink to="/" className={getLinkClass}>
            <LayoutDashboard size={20} />
            Tổng quan hệ thống
          </NavLink>
        )}

        {/* --- DÀNH CHO ĐỘC GIẢ (USER) --- */}
        {userRole === 'USER' && (
          <NavLink to="/profile" className={getLinkClass}>
            <History size={20} />
            Hồ sơ & Lịch sử mượn
          </NavLink>
        )}

        {/* --- CHUNG --- */}
        <NavLink to="/books" className={getLinkClass}>
          <Book size={20} />
          Tra cứu Tủ sách
        </NavLink>

        {/* --- QUẢN LÝ (ADMIN) --- */}
        {userRole === 'ADMIN' && (
          <>
            <div className="pt-2 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quản trị viên</p>
            </div>
            <NavLink to="/members" className={getLinkClass}>
              <Users size={20} />
              Quản lý Độc giả
            </NavLink>

            <NavLink to="/borrowed" className={getLinkClass}>
              <BookMarked size={20} />
              Quản lý Mượn/Trả
            </NavLink>
          </>
        )}

        {/* --- CÀI ĐẶT --- */}
        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
          <NavLink to="/settings" className={getLinkClass}>
            <Settings size={20} />
            Cài đặt hệ thống
          </NavLink>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          <span className="text-sm font-medium">{theme === 'light' ? 'Chế độ Tối' : 'Chế độ Sáng'}</span>
        </button>
      </div>
    </aside>
  );
}