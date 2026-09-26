import { useState } from 'react';
import { Search, RotateCcw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';

export interface BorrowedBook {
  id: number;
  bookId: number;
  book: { title: string; author: string }; // Nested from Prisma include
  user: { name: string; email: string };   // Nested from Prisma include
  borrowDate: string;
  dueDate: string;
  status: 'On Time' | 'Overdue' | 'Due Soon' | 'Returned';
}

interface BorrowedBooksProps {
  userRole: 'ADMIN' | 'USER' | null;
  // Ignore old props
  borrowedBooks?: any;
  onReturnBook?: any;
}

export function BorrowedBooks({ userRole }: BorrowedBooksProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Fetch Loans
  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['all-loans'],
    queryFn: async () => {
      const { data } = await client.get('/loans/all');
      return data;
    }
  });

  // Return Book Mutation
  const returnMutation = useMutation({
    mutationFn: async (loanId: number) => {
      await client.post('/loans/return', { loanId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['books'] }); // Update book availability
      alert("Thu hồi sách thành công!");
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || "Có lỗi xảy ra");
    }
  });


  // Filter logic handled client side for now
  const filteredLoans = loans.filter((loan: any) =>
    loan.book?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.user?.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <div>Đang tải danh sách mượn...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý mượn trả</h2>
        <p className="text-gray-500 dark:text-gray-400">Theo dõi danh sách sách đang cho mượn và xử lý trả sách.</p>
      </div>

      <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <Search className="text-gray-400 w-5 h-5" />
        <Input
          placeholder="Tìm kiếm theo tên sách, tên độc giả hoặc email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thông tin Sách</TableHead>
              <TableHead>Người mượn</TableHead>
              <TableHead>Ngày mượn</TableHead>
              <TableHead>Hạn trả</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLoans.length > 0 ? (
              filteredLoans.map((loan: any) => (
                <TableRow key={loan.id}>
                  <TableCell>
                    <p className="font-medium text-gray-900 dark:text-white">{loan.book?.title}</p>
                    <p className="text-xs text-gray-500">{loan.book?.author}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900 dark:text-white">{loan.user?.name}</p>
                    <p className="text-xs text-gray-500">{loan.user?.email}</p>
                  </TableCell>
                  <TableCell>{new Date(loan.borrowDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{new Date(loan.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {loan.status === 'On Time' && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 gap-1">
                        <CheckCircle size={12} /> Đúng hạn
                      </Badge>
                    )}
                    {loan.status === 'Due Soon' && (
                      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200 gap-1">
                        <Clock size={12} /> Sắp đến hạn
                      </Badge>
                    )}
                    {loan.status === 'Overdue' && (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 gap-1">
                        <AlertCircle size={12} /> Quá hạn
                      </Badge>
                    )}
                    {loan.status === 'Returned' && (
                      <Badge variant="secondary">Đã trả</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {loan.status !== 'Returned' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => returnMutation.mutate(loan.id)}
                        disabled={returnMutation.isPending}
                      >
                        <RotateCcw size={16} /> Thu hồi
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                  Không tìm thấy phiếu mượn nào phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}