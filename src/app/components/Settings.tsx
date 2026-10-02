import { useState } from 'react';
import {
  Bell, Shield, Palette, Database, Globe, Cpu,
  Play, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  Send, Mail, Check, Lock, Edit3, Eye, EyeOff, X, KeyRound
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { client } from '../api/client';
import { toast } from 'sonner';

interface ReminderReport {
  timestamp: string;
  totalActiveLoans: number;
  dueSoonCount: number;
  overdueCount: number;
  emailsSent: number;
  failedCount: number;
}

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();

  // Local states for interactive settings
  const [libraryName, setLibraryName] = useState('LibraryPKA Management System');
  const [loanPeriod, setLoanPeriod] = useState('14 ngày (Mặc định)');
  const [maxBooks, setMaxBooks] = useState('5 - 15 cuốn (Theo hạng thành viên)');
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [tempLibraryName, setTempLibraryName] = useState(libraryName);

  // Toggle states
  const [overdueRemindersEnabled, setOverdueRemindersEnabled] = useState(true);
  const [newBookAlertsEnabled, setNewBookAlertsEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Cronjob trigger mutation state
  const [lastReport, setLastReport] = useState<ReminderReport | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  // Modal đổi mật khẩu
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const { data } = await client.put('/auth/change-password', payload);
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Đổi mật khẩu thành công!');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrentPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi xảy ra khi đổi mật khẩu');
    }
  });

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Vui lòng điền đầy đủ tất cả các trường mật khẩu!');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có tối thiểu 6 ký tự!');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp nhau!');
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error('Mật khẩu mới không được trùng với mật khẩu hiện tại!');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    });
  };

  const triggerCronMutation = useMutation({
    mutationFn: async () => {
      const { data } = await client.post('/loans/reminders/trigger');
      return data;
    },
    onSuccess: (data: any) => {
      const msg = data?.message || 'Đã kích hoạt quét nợ phạt và gửi email thành công!';
      setTriggerMessage(msg);
      toast.success(msg);
      if (data?.report) {
        setLastReport(data.report);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi xảy ra khi kích hoạt tác vụ gửi email');
    }
  });

  const handleSaveGeneral = () => {
    setLibraryName(tempLibraryName);
    setIsEditingGeneral(false);
    toast.success('Đã lưu thông tin cấu hình chung thành công!');
  };

  const handleTriggerNow = () => {
    if (triggerCronMutation.isPending) return;
    setTriggerMessage(null);
    triggerCronMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {t('settings.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="space-y-6">

        {/* =========================================
            1. CÀI ĐẶT CHUNG
        ========================================= */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {t('settings.general')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.generalDesc')}
                </p>
              </div>
            </div>
            {!isEditingGeneral ? (
              <button
                onClick={() => {
                  setTempLibraryName(libraryName);
                  setIsEditingGeneral(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {t('settings.edit')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingGeneral(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveGeneral}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Lưu
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Tên thư viện */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 gap-2">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.libraryName')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.libraryNameDesc')}
                </p>
              </div>
              <div className="flex items-center">
                {isEditingGeneral ? (
                  <input
                    type="text"
                    value={tempLibraryName}
                    onChange={(e) => setTempLibraryName(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700/60">
                    {libraryName}
                  </span>
                )}
              </div>
            </div>

            {/* Thời hạn mượn */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 gap-2">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.loanPeriod')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.loanPeriodDesc')}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700/60">
                {loanPeriod}
              </span>
            </div>

            {/* Giới hạn mượn tối đa */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.maxBooks')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.maxBooksDesc')}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700/60">
                {maxBooks}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================
            2. HỆ THỐNG NGẦM (CRONJOB & EMAIL REMINDER)
        ========================================= */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-200 dark:border-blue-900/50 p-6 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {t('settings.cronjob')}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Đang hoạt động (Active)
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.cronjobDesc')}
                </p>
              </div>
            </div>

            <button
              onClick={handleTriggerNow}
              disabled={triggerCronMutation.isPending}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all shadow-md ${
                triggerCronMutation.isPending
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 shadow-blue-500/20'
              }`}
            >
              {triggerCronMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('settings.runningJob')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('settings.triggerNow')}
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {/* Lịch chạy định kỳ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" />
                  {t('settings.cronSchedule')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.cronScheduleDesc')}
                </p>
              </div>
              <code className="text-xs font-mono font-bold bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700">
                0 8 * * * (08:00 AM Hàng Ngày)
              </code>
            </div>

            {/* Thông tin mô tả nút trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 text-xs text-gray-500 dark:text-gray-400 gap-2">
              <p>
                💡 <strong>Ghi chú kiểm thử (Testing Note):</strong> Khi nhấn nút "Kích hoạt quét nợ phạt ngay lập tức", hệ thống sẽ quét toàn bộ bảng phiếu mượn, xác định các trường hợp sắp đến hạn (1-2 ngày) và trễ hạn để gửi email thông báo trực tiếp qua Nodemailer.
              </p>
            </div>

            {/* Kết quả lần chạy gần nhất nếu có */}
            {triggerMessage && (
              <div className="mt-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      {triggerMessage}
                    </p>
                    {lastReport && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs text-emerald-800 dark:text-emerald-300">
                        <div className="bg-white/60 dark:bg-emerald-900/30 p-2 rounded-lg">
                          <span className="block opacity-75">Sách lưu thông:</span>
                          <strong className="text-sm">{lastReport.totalActiveLoans} cuốn</strong>
                        </div>
                        <div className="bg-white/60 dark:bg-emerald-900/30 p-2 rounded-lg">
                          <span className="block opacity-75">Sắp đến hạn:</span>
                          <strong className="text-sm text-amber-600 dark:text-amber-400">{lastReport.dueSoonCount} cuốn</strong>
                        </div>
                        <div className="bg-white/60 dark:bg-emerald-900/30 p-2 rounded-lg">
                          <span className="block opacity-75">Đã quá hạn:</span>
                          <strong className="text-sm text-rose-600 dark:text-rose-400">{lastReport.overdueCount} cuốn</strong>
                        </div>
                        <div className="bg-white/60 dark:bg-emerald-900/30 p-2 rounded-lg">
                          <span className="block opacity-75">Email đã gửi:</span>
                          <strong className="text-sm text-blue-600 dark:text-blue-400">{lastReport.emailsSent} email</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================
            3. THÔNG BÁO & EMAIL
        ========================================= */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                {t('settings.notifications')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('settings.notificationsDesc')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Nhắc nhở quá hạn */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="max-w-[80%]">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.overdueReminders')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.overdueDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={overdueRemindersEnabled}
                  onChange={(e) => setOverdueRemindersEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Thông báo sách mới */}
            <div className="flex items-center justify-between py-2">
              <div className="max-w-[80%]">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.newBookNotif')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.newBookDesc')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={newBookAlertsEnabled}
                  onChange={(e) => setNewBookAlertsEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* =========================================
            4. BẢO MẬT & TÀI KHOẢN
        ========================================= */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                {t('settings.security')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('settings.securityDesc')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* 2FA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 gap-2">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.twoFactor')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.twoFactorDesc')}
                </p>
              </div>
              <button
                onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  twoFactorEnabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                }`}
              >
                {twoFactorEnabled ? 'Đã kích hoạt' : t('settings.enable')}
              </button>
            </div>

            {/* Đổi mật khẩu */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.changePassword')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.passwordDesc')}
                </p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline px-3 py-1.5"
              >
                {t('settings.change')}
              </button>
            </div>
          </div>
        </div>

        {/* =========================================
            5. GIAO DIỆN & NGÔN NGỮ
        ========================================= */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                {t('settings.appearance')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('settings.appearanceDesc')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Chuyển Theme */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('settings.theme')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('settings.themeDesc')}
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-bold"
              >
                {theme === 'light' ? `☀️ ${t('common.light')}` : `🌙 ${t('common.dark')}`}
              </button>
            </div>

            {/* Chọn ngôn ngữ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t('settings.language')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('settings.languageDesc')}
                  </p>
                </div>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'vi' | 'en')}
                className="px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                <option value="vi">🇻🇳 Tiếng Việt</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================
          MODAL ĐỔI MẬT KHẨU (CHANGE PASSWORD)
      ========================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setShowCurrentPass(false);
                setShowNewPass(false);
                setShowConfirmPass(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Đổi mật khẩu tài khoản
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cập nhật mật khẩu bảo vệ tài khoản {user?.email}
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              {/* Mật khẩu hiện tại */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mật khẩu hiện tại <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Nhập mật khẩu đang sử dụng"
                    required
                    className="w-full pl-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mật khẩu mới (Tối thiểu 6 ký tự) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Nhập mật khẩu mới"
                    required
                    minLength={6}
                    className="w-full pl-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    className="w-full pl-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Validation cảnh báo không khớp */}
              {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-xs text-rose-500 font-medium">
                  ⚠️ Mật khẩu mới và mật khẩu xác nhận không trùng khớp nhau!
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setShowCurrentPass(false);
                    setShowNewPass(false);
                    setShowConfirmPass(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    'Cập nhật mật khẩu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}