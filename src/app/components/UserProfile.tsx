import { User, CreditCard, Calendar, BookOpen, Clock, AlertCircle, CheckCircle, BookmarkPlus, Bell, XCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export function UserProfile() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Fetch My Loans
  const { data: myLoans = [] } = useQuery({
    queryKey: ['my-loans'],
    queryFn: async () => {
      const { data } = await client.get('/loans/my');
      return data;
    }
  });

  // Fetch My Reservations
  const { data: myReservations = [] } = useQuery({
    queryKey: ['my-reservations'],
    queryFn: async () => {
      const { data } = await client.get('/reservations/my');
      return data;
    }
  });

  // Cancel reservation mutation
  const cancelReservationMutation = useMutation({
    mutationFn: async (id: number) => {
      await client.delete(`/reservations/${id}`);
    },
    onSuccess: () => {
      alert('Đã hủy yêu cầu đặt trước!');
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Có lỗi khi hủy');
    }
  });

  const totalBorrowed = myLoans.filter((l: any) => l.status !== 'Returned').length;
  const overdueCount = myLoans.filter((l: any) => l.status === 'Overdue').length;
  const waitingReservations = myReservations.filter((r: any) => r.status === 'WAITING' || r.status === 'NOTIFIED');

  if (!currentUser) return <div>Vui lòng đăng nhập</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hồ sơ độc giả</h2>
        <p className="text-gray-500 dark:text-gray-400">Quản lý thông tin cá nhân, theo dõi lịch sử mượn trả và sách đặt trước.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- CỘT TRÁI: THÔNG TIN THẺ --- */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm h-fit">
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
              <User size={48} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{currentUser.name}</h3>
            <span className="text-sm text-gray-500">{currentUser.email}</span>
            <span className="mt-2 px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium border border-green-200">
              {currentUser.role === 'ADMIN' ? 'Thủ thư' : 'Thẻ Sinh viên'}
            </span>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <CreditCard className="text-gray-400" size={18} />
              <div>
                <p className="text-xs text-gray-500">Mã thẻ</p>
                <p className="font-medium text-gray-900 dark:text-white">LIB-{currentUser.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="text-gray-400" size={18} />
              <div>
                <p className="text-xs text-gray-500">Tham gia</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* --- CỘT PHẢI: SÁCH ĐANG MƯỢN & ĐẶT TRƯỚC --- */}
        <div className="lg:col-span-2 space-y-6">

          {/* Thống kê nhỏ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg">
                <BookOpen size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Đang mượn</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{totalBorrowed} cuốn</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800 flex items-center gap-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 rounded-lg">
                <BookmarkPlus size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Đang đặt trước</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{waitingReservations.length} cuốn</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 rounded-lg">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Quá hạn</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-400">{overdueCount} cuốn</p>
              </div>
            </div>
          </div>

          {/* Danh sách Đặt trước của tôi */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="text-amber-600 dark:text-amber-400" size={20} />
                <h3 className="font-bold text-gray-900 dark:text-white">Sách đang đặt trước (Reservations)</h3>
              </div>
              {waitingReservations.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  Đang chờ {waitingReservations.length} cuốn
                </span>
              )}
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {myReservations.length > 0 ? (
                myReservations.map((resItem: any) => (
                  <div key={resItem.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded overflow-hidden shrink-0 bg-gray-100 border">
                        <img
                          src={resItem.book?.coverImage || 'https://via.placeholder.com/40x56?text=No+Cover'}
                          alt={resItem.book?.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                          {resItem.book?.title}
                        </p>
                        <p className="text-xs text-gray-500">{resItem.book?.author}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Đặt ngày: {new Date(resItem.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {resItem.status === 'WAITING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200">
                          <Clock size={12} /> Đang chờ có sách
                        </span>
                      )}
                      {resItem.status === 'NOTIFIED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 animate-pulse">
                          <Bell size={12} /> Sách đã về - Hãy đến nhận
                        </span>
                      )}
                      {resItem.status === 'FULFILLED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle size={12} /> Đã nhận sách
                        </span>
                      )}
                      {resItem.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Đã hủy
                        </span>
                      )}

                      {(resItem.status === 'WAITING' || resItem.status === 'NOTIFIED') && (
                        <button
                          onClick={() => {
                            if (confirm('Bạn có chắc chắn muốn hủy đặt trước cuốn sách này?')) {
                              cancelReservationMutation.mutate(resItem.id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors text-xs flex items-center gap-1"
                          title="Hủy đặt trước"
                        >
                          <XCircle size={16} />
                          <span className="hidden sm:inline">Hủy</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500 text-sm">
                  Bạn chưa có yêu cầu đặt trước nào.
                </div>
              )}
            </div>
          </div>

          {/* Danh sách Lịch sử mượn sách */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white">Lịch sử mượn sách</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Tên sách</th>
                    <th className="px-6 py-3">Ngày mượn</th>
                    <th className="px-6 py-3">Hạn trả</th>
                    <th className="px-6 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {myLoans.length > 0 ? (
                    myLoans.map((loan: any) => (
                      <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          {loan.book?.title}
                          <p className="text-xs text-gray-500 font-normal">{loan.book?.author}</p>
                        </td>
                        <td className="px-6 py-4">{new Date(loan.borrowDate).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-medium text-blue-600">{new Date(loan.dueDate).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          {loan.status === 'On Time' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle size={12} /> Đúng hạn
                            </span>
                          )}
                          {loan.status === 'Due Soon' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Clock size={12} /> Sắp đến hạn
                            </span>
                          )}
                          {loan.status === 'Overdue' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertCircle size={12} /> Quá hạn
                            </span>
                          )}
                          {loan.status === 'Returned' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Đã trả
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        Bạn chưa mượn cuốn sách nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}