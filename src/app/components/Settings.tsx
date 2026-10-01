import { Bell, Shield, Palette, Database, Globe } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{t('settings.title')}</h2>
        <p className="text-gray-600 dark:text-gray-400">{t('settings.subtitle')}</p>
      </div>

      {/* Danh sách các mục cài đặt */}
      <div className="space-y-6">

        {/* Cài đặt chung */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{t('settings.general')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.generalDesc')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.libraryName')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">LibraryPKA Management System</p>
              </div>
              <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{t('settings.edit')}</button>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.loanPeriod')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">30 ngày</p>
              </div>
              <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{t('settings.edit')}</button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.maxBooks')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">5 cuốn sách</p>
              </div>
              <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{t('settings.edit')}</button>
            </div>
          </div>
        </div>

        {/* Thông báo */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{t('settings.notifications')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.notificationsDesc')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="max-w-[80%]">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.overdueReminders')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.overdueDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="max-w-[80%]">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.newBookNotif')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.newBookDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Bảo mật */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{t('settings.security')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.securityDesc')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.twoFactor')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.twoFactorDesc')}</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold shadow-md shadow-blue-100 dark:shadow-none">
                {t('settings.enable')}
              </button>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.changePassword')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.passwordDesc')}</p>
              </div>
              <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{t('settings.change')}</button>
            </div>
          </div>
        </div>

        {/* Giao diện & Ngôn ngữ */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{t('settings.appearance')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.appearanceDesc')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.theme')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.themeDesc')}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-bold"
              >
                {theme === 'light' ? t('common.light') : t('common.dark')}
              </button>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.language')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.languageDesc')}</p>
                </div>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'vi' | 'en')}
                className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}