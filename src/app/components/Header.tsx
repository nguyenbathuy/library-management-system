import { Search, LogOut, Bell } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  const userName = user?.name || "Người dùng";
  const userEmail = user?.email || "user@library.com";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center justify-between px-8 py-4">

        <div className="flex-1 max-w-2xl">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder={t('header.search')}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          <button className="relative p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
            <Bell className="w-6 h-6" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group"
            >
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                {userInitial}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  {userName}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {user?.role === 'ADMIN' ? 'Quản trị viên' : 'Độc giả'}
                </p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 mb-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{userName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  {t('header.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}