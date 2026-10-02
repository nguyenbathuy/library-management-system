import { Search, LogOut, Bell, BellOff, CheckCheck, X, Trash2, Clock, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { toast } from 'sonner';

interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const userName = user?.name || t('header.defaultUser');
  const userEmail = user?.email || "user@library.com";
  const userInitial = userName.charAt(0).toUpperCase();

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Truy vấn danh sách thông báo từ API
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await client.get('/notifications');
      return res.data as { notifications: NotificationItem[]; unreadCount: number };
    },
    enabled: !!user,
    refetchInterval: 30000, // Tự động làm mới mỗi 30 giây
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Mutation: Đánh dấu 1 thông báo là đã đọc
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await client.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutation: Đánh dấu tất cả là đã đọc
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await client.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc');
    },
  });

  // Mutation: Xóa 1 thông báo
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      await client.delete(`/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutation: Dọn sạch tất cả thông báo
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await client.delete('/notifications/clear-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Đã dọn sạch toàn bộ thông báo');
    },
  });

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Vừa xong';
      if (mins < 60) return `${mins} phút trước`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} giờ trước`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days} ngày trước`;
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return '';
    }
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center justify-between px-8 py-4">

        <div className="flex-1 max-w-2xl">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder={t('header.search')}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          {/* ====================================================
              CHUÔNG THÔNG BÁO & DROPDOWN POPOVER
          ==================================================== */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              title={t('header.notifications')}
              className={`relative p-2 rounded-full transition-colors ${
                showNotifications
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                  : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800'
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-900 animate-pulse shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Popover thông báo */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Header Dropdown */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Thông báo</h4>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full text-[10px] font-bold">
                        {unreadCount} mới
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllAsReadMutation.mutate()}
                          disabled={markAllAsReadMutation.isPending}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium transition-colors"
                          title="Đánh dấu tất cả là đã đọc"
                        >
                          <CheckCheck size={14} />
                          Đã đọc
                        </button>
                      )}
                      <button
                        onClick={() => clearAllMutation.mutate()}
                        disabled={clearAllMutation.isPending}
                        className="text-xs text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Dọn sạch toàn bộ thông báo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Danh sách thông báo */}
                <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 custom-scrollbar">
                  {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                      <Loader2 size={24} className="animate-spin text-blue-600" />
                      <span className="text-xs">Đang tải thông báo...</span>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-full mx-auto flex items-center justify-center mb-3">
                        <BellOff size={22} />
                      </div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Không có thông báo nào</p>
                      <p className="text-xs text-gray-400 mt-1">Các hoạt động mượn sách, đặt trước sẽ xuất hiện ở đây.</p>
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!item.isRead) markAsReadMutation.mutate(item.id);
                        }}
                        className={`group relative p-3.5 transition-colors cursor-pointer flex gap-3 ${
                          item.isRead
                            ? 'bg-white dark:bg-gray-900 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 opacity-75 hover:opacity-100'
                            : 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/80 dark:hover:bg-blue-950/40'
                        }`}
                      >
                        {/* Chấm tròn biểu thị chưa đọc */}
                        <div className="pt-1.5 shrink-0">
                          <span
                            className={`block w-2 h-2 rounded-full ${
                              item.isRead ? 'bg-transparent' : 'bg-blue-600 shadow-sm shadow-blue-500/50'
                            }`}
                          />
                        </div>

                        {/* Nội dung thông báo */}
                        <div className="flex-1 min-w-0 pr-6">
                          <h5
                            className={`text-xs font-bold leading-snug line-clamp-1 ${
                              item.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {item.title}
                          </h5>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
                            {item.message}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400">
                            <Clock size={11} />
                            <span>{formatTimeAgo(item.createdAt)}</span>
                          </div>
                        </div>

                        {/* Nút Xóa thông báo (X) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotificationMutation.mutate(item.id);
                          }}
                          className="absolute right-2 top-2 p-1 text-gray-300 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all"
                          title="Xóa thông báo này"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ====================================================
              MENU TÀI KHOẢN NGƯỜI DÙNG
          ==================================================== */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
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
                  {user?.role === 'ADMIN' ? t('header.admin') : t('header.user')}
                </p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
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