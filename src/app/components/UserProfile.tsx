import { User, Mail, CreditCard, Calendar, BookOpen, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export function UserProfile({ }: any) {
    const { user: currentUser } = useAuth();

    // Fetch My Loans
    const { data: myLoans = [] } = useQuery({
        queryKey: ['my-loans'],
        queryFn: async () => {
            const { data } = await client.get('/loans/my');
            return data;
        }
    });

    const totalBorrowed = myLoans.filter((l: any) => l.status !== 'Returned').length;
    const overdueCount = myLoans.filter((l: any) => l.status === 'Overdue').length;

    if (!currentUser) return <div>Vui lòng đăng nhập</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hồ sơ độc giả</h2>
                <p className="text-gray-500 dark:text-gray-400">Quản lý thông tin cá nhân và theo dõi lịch sử mượn trả.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* --- CỘT TRÁI: THÔNG TIN THẺ --- */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm h-fit">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
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

                {/* --- CỘT PHẢI: SÁCH ĐANG MƯỢN --- */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Thống kê nhỏ */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-4">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Đang mượn</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalBorrowed} cuốn</p>
                            </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-4">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Quá hạn</p>
                                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{overdueCount} cuốn</p>
                            </div>
                        </div>
                    </div>

                    {/* Danh sách chi tiết */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
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