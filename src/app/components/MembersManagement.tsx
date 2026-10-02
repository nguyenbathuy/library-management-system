import { useState } from 'react';
import {
  Search, Plus, Mail, UserCheck, X, Save,
  ShieldAlert, ShieldCheck, Crown, Award, BookOpen, AlertTriangle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

export interface Member {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  membershipTier?: 'STANDARD' | 'PREMIUM' | 'LECTURER' | string;
  isBlacklisted?: boolean;
  phone?: string;
  membershipType?: string;
  status?: string;
  booksOut?: number;
}

export function MembersManagement() {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLACKLISTED'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  // State form thành viên mới
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    password: 'password123',
    role: 'USER' as 'ADMIN' | 'USER',
    membershipTier: 'STANDARD'
  });

  // Fetch Users
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await client.get('/auth/users');
      return data as Member[];
    }
  });

  // Add User Mutation
  const addUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      await client.post('/auth/register', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddModal(false);
      setNewMember({ name: '', email: '', password: 'password123', role: 'USER', membershipTier: 'STANDARD' });
      toast.success("Thêm thành viên mới thành công!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Có lỗi xảy ra khi thêm thành viên");
    }
  });

  // Toggle Blacklist Mutation
  const toggleBlacklistMutation = useMutation({
    mutationFn: async ({ id, isBlacklisted }: { id: number; isBlacklisted: boolean }) => {
      const { data } = await client.patch(`/auth/users/${id}/blacklist`, { isBlacklisted });
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Cập nhật danh sách đen thành công!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi khi cập nhật trạng thái danh sách đen');
    }
  });

  const handleToggleBlacklist = (member: Member) => {
    const willBlacklist = !member.isBlacklisted;
    const confirmMsg = willBlacklist
      ? `Bạn có chắc chắn muốn đưa độc giả "${member.name}" (${member.email}) vào DANH SÁCH ĐEN?\n⚠️ Độc giả này sẽ bị chặn ngay lập tức, không được phép mượn bất kỳ cuốn sách mới nào!`
      : `Bạn có muốn gỡ bỏ độc giả "${member.name}" khỏi Danh sách Đen và cho phép mượn sách trở lại?`;

    if (window.confirm(confirmMsg)) {
      toggleBlacklistMutation.mutate({
        id: member.id,
        isBlacklisted: willBlacklist
      });
    }
  };

  const handleAddMember = () => {
    if (!newMember.name || !newMember.email) return;
    addUserMutation.mutate(newMember);
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && !member.isBlacklisted) ||
      (statusFilter === 'BLACKLISTED' && member.isBlacklisted);

    return matchesSearch && matchesStatus;
  });

  const blacklistedCount = members.filter(m => m.isBlacklisted).length;
  const activeCount = members.filter(m => !m.isBlacklisted).length;

  return (
    <div className="space-y-6 relative">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{t('members.title')}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t('members.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm self-start sm:self-auto font-medium"
        >
          <Plus className="w-5 h-5" />
          {t('members.addNew')}
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{language === 'vi' ? 'Tổng số độc giả' : 'Total Members'}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{members.length}</p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-green-200 dark:border-green-900/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">{t('members.active')}</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{activeCount}</p>
          </div>
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
            <ShieldCheck size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-red-200 dark:border-red-900/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-red-700 dark:text-red-400 font-medium">{t('members.blacklisted')}</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{blacklistedCount}</p>
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
            <ShieldAlert size={22} />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('members.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === 'ALL'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
          >
            {language === 'vi' ? 'Tất cả' : 'All'} ({members.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === 'ACTIVE'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 hover:bg-green-100'
              }`}
          >
            {t('members.active')} ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('BLACKLISTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === 'BLACKLISTED'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100'
              }`}
          >
            {t('members.blacklisted')} ({blacklistedCount})
          </button>
        </div>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMembers.map((member) => {
          const tier = (member.membershipTier || 'STANDARD').toUpperCase();
          const maxBooks = tier === 'PREMIUM' ? 10 : tier === 'LECTURER' ? 15 : 5;

          return (
            <div
              key={member.id}
              className={`bg-white dark:bg-gray-900 rounded-xl border p-5 transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${member.isBlacklisted
                  ? 'border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10'
                  : 'border-gray-200 dark:border-gray-800'
                }`}
            >
              <div>
                {/* Header: Avatar, Name, Role & Status */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${member.isBlacklisted
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-600'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                      }`}>
                      {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={member.name}>
                        {member.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${member.role === 'ADMIN'
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}>
                          {member.role === 'ADMIN' ? t('header.admin') : t('header.user')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {member.isBlacklisted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200">
                      <ShieldAlert size={12} /> {t('members.blacklisted')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200">
                      <UserCheck size={12} /> {t('members.active')}
                    </span>
                  )}
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>

                {/* Membership Tier & Limits */}
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-xs space-y-1 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1">
                      {tier === 'PREMIUM' ? <Crown size={12} className="text-amber-500" /> : <Award size={12} className="text-blue-500" />}
                      Hạng thành viên:
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{tier}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1">
                      <BookOpen size={12} className="text-indigo-500" /> Hạn mức mượn:
                    </span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">Tối đa {maxBooks} cuốn</span>
                  </div>
                </div>
              </div>

              {/* Footer: Date & Blacklist Toggle Switch */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Mã thẻ: LIB-{member.id}</span>
                  <span>{new Date(member.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>

                {/* --- TOGGLE BLACKLIST BUTTON --- */}
                {member.role !== 'ADMIN' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      {member.isBlacklisted ? (
                        <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                          <AlertTriangle size={13} /> Chặn mượn sách
                        </span>
                      ) : (
                        <span className="text-gray-500">Quyền mượn sách</span>
                      )}
                    </span>

                    {/* Interactive Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleBlacklist(member)}
                      disabled={toggleBlacklistMutation.isPending}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${member.isBlacklisted ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-700'
                        }`}
                      role="switch"
                      aria-checked={Boolean(member.isBlacklisted)}
                      title={member.isBlacklisted ? 'Nhấn để gỡ khỏi Blacklist' : 'Nhấn để đưa vào Blacklist'}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${member.isBlacklisted ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            {isLoading ? 'Đang tải danh sách độc giả...' : 'Không tìm thấy độc giả nào phù hợp.'}
          </div>
        )}
      </div>

      {/* MODAL THÊM THÀNH VIÊN */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-2xl p-6 border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Thêm thành viên mới</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Nhập họ tên độc giả..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu mặc định</label>
                <input
                  type="text"
                  value={newMember.password}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vai trò</label>
                  <select
                    value={newMember.role}
                    // @ts-ignore
                    onChange={e => setNewMember({ ...newMember, role: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="USER">Độc giả (User)</option>
                    <option value="ADMIN">Quản trị viên (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hạng thành viên</label>
                  <select
                    value={newMember.membershipTier}
                    onChange={e => setNewMember({ ...newMember, membershipTier: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="STANDARD">Standard (Tối đa 5 cuốn)</option>
                    <option value="PREMIUM">Premium (Tối đa 10 cuốn)</option>
                    <option value="LECTURER">Lecturer (Tối đa 15 cuốn)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium text-sm">Hủy</button>
              <button onClick={handleAddMember} disabled={addUserMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 text-sm shadow-sm">
                <Save size={18} /> {addUserMutation.isPending ? 'Đang lưu...' : 'Lưu thành viên'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}