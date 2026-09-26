import { useState } from 'react';
import { Search, Plus, Mail, MoreVertical, UserCheck, X, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';

interface Member {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  // Extras available in UI but maybe not in DB yet, handle gracefully
  phone?: string;
  membershipType?: string;
  status?: string;
  booksOut?: number;
}

export function MembersManagement() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  // State form thành viên mới
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    password: 'password123', // Default password for manually added users
    role: 'USER' as 'ADMIN' | 'USER'
  });

  // Fetch Users
  const { data: members = [] } = useQuery({
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
      setNewMember({ name: '', email: '', password: 'password123', role: 'USER' });
      alert("Thêm thành viên thành công!");
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || "Có lỗi xảy ra");
    }
  });


  const handleAddMember = () => {
    if (!newMember.name || !newMember.email) return;
    addUserMutation.mutate(newMember);
  };

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">{t('members.title')}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t('members.subtitle')}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
          <Plus className="w-5 h-5" />
          {t('members.addNew')}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('members.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMembers.map((member) => (
          <div key={member.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                  {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${member.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {member.role}
                  </span>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600"><MoreVertical className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="truncate">{member.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="text-sm">
                <span className="text-gray-500">Tham gia: </span>
                <span className="font-medium text-gray-900 dark:text-white">{new Date(member.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-green-500" />
                <span className="text-xs font-bold text-green-600">Active</span>
              </div>
            </div>
          </div>
        ))}
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
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập họ tên..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu mặc định</label>
                <input
                  type="text"
                  value={newMember.password}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vai trò</label>
                <select
                  value={newMember.role}
                  // @ts-ignore
                  onChange={e => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USER">Độc giả (User)</option>
                  <option value="ADMIN">Quản trị viên (Admin)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium">Hủy</button>
              <button onClick={handleAddMember} disabled={addUserMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
                <Save size={18} /> {addUserMutation.isPending ? 'Đang lưu...' : 'Lưu thành viên'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}