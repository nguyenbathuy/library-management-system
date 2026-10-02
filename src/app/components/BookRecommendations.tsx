import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client';
import { Book } from './BooksManagement';
import { toast } from 'sonner';
import {
  Sparkles,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  BookmarkPlus,
  FileText,
  Flame,
  Award
} from 'lucide-react';

interface BookRecommendationsProps {
  onSelectBook: (book: Book) => void;
  onBorrow?: (bookId: number) => void;
  onReserve?: (bookId: number) => void;
  userRole?: 'ADMIN' | 'USER' | null;
}

interface RecommendationsResponse {
  success: boolean;
  type: 'PERSONALIZED' | 'TRENDING';
  reason: string;
  books: Book[];
}

export function BookRecommendations({
  onSelectBook,
  onBorrow,
  onReserve,
  userRole
}: BookRecommendationsProps) {
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const internalBorrowMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const { data } = await client.post('/loans/borrow', { bookId });
      return data;
    },
    onSuccess: (data: any, bookId: number) => {
      toast.success('Mượn sách thành công!');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });
      queryClient.invalidateQueries({ queryKey: ['my-loans'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      queryClient.setQueryData<RecommendationsResponse>(['book-recommendations'], (oldData) => {
        if (!oldData || !oldData.books) return oldData;
        return {
          ...oldData,
          books: oldData.books.map((b) => {
            if (b.id === bookId) {
              const newAvailable = typeof data?.availableCopies === 'number'
                ? data.availableCopies
                : (typeof data?.available === 'number' ? data.available : Math.max(0, (b.available ?? 1) - 1));
              return {
                ...b,
                available: newAvailable,
                status: newAvailable > 0 ? 'Available' : 'Borrowed'
              };
            }
            return b;
          })
        };
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Có lỗi xảy ra khi mượn sách');
    }
  });

  const handleBorrow = (bookId: number) => {
    if (onBorrow) {
      onBorrow(bookId);
    } else {
      internalBorrowMutation.mutate(bookId);
    }
  };

  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: ['book-recommendations'],
    queryFn: async () => {
      const res = await client.get('/books/recommendations');
      return res.data;
    },
    staleTime: 5 * 60 * 1000 // 5 minutes cache
  });

  const books = data?.books || [];
  const recommendationType = data?.type || 'TRENDING';
  const reason = data?.reason || 'Gợi ý những cuốn sách được bạn đọc yêu thích nhất';

  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 300;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
    setTimeout(updateScrollButtons, 350);
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/70 dark:from-gray-900 dark:via-blue-950/20 dark:to-purple-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 animate-pulse" />
          <div className="h-6 w-48 bg-blue-200/70 dark:bg-blue-800/50 rounded animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-60 h-72 flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl animate-pulse p-3 space-y-3"
            >
              <div className="w-full h-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (books.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 dark:from-gray-900/90 dark:via-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-5 mb-6 shadow-sm relative overflow-hidden transition-all">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-gradient-to-br from-indigo-400/10 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-amber-500 to-indigo-600 text-white rounded-lg shadow-sm">
              <Sparkles size={18} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Gợi ý dành riêng cho bạn
              {recommendationType === 'PERSONALIZED' ? (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Phù hợp với bạn
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  Thịnh hành
                </span>
              )}
            </h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1.5">
            {recommendationType === 'PERSONALIZED' ? (
              <Award size={14} className="text-indigo-500 shrink-0" />
            ) : (
              <Flame size={14} className="text-rose-500 shrink-0" />
            )}
            <span>{reason}</span>
          </p>
        </div>

        {/* Carousel arrows */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            className={`p-2 rounded-lg border transition-all ${
              canScrollLeft
                ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 active:scale-95'
                : 'bg-gray-100 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 border-transparent cursor-not-allowed'
            }`}
            title="Cuộn sang trái"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => handleScroll('right')}
            disabled={!canScrollRight}
            className={`p-2 rounded-lg border transition-all ${
              canScrollRight
                ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 active:scale-95'
                : 'bg-gray-100 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 border-transparent cursor-not-allowed'
            }`}
            title="Cuộn sang phải"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Books Carousel Row */}
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollButtons}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 pt-1 -mx-1 px-1 no-scrollbar focus:outline-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {books.map((book) => {
          const isPersonalized = book.recommendationBadge === 'Phù hợp với bạn';

          return (
            <div
              key={book.id}
              onClick={() => onSelectBook(book)}
              className="w-60 flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col cursor-pointer group overflow-hidden"
            >
              {/* Cover Image Container */}
              <div className="h-40 relative overflow-hidden bg-gray-100 dark:bg-gray-900">
                <img
                  src={book.coverImage || 'https://via.placeholder.com/300x400?text=No+Cover'}
                  alt={book.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Recommendation Badge */}
                <div className="absolute top-2 left-2 z-10">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm text-white ${
                      isPersonalized
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                        : 'bg-gradient-to-r from-amber-500 to-rose-600'
                    }`}
                  >
                    {isPersonalized ? <Sparkles size={11} /> : <TrendingUp size={11} />}
                    {book.recommendationBadge || (isPersonalized ? 'Phù hợp với bạn' : 'Thịnh hành')}
                  </span>
                </div>

                {/* Ebook tag if available */}
                {book.ebookUrl && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-emerald-600/90 backdrop-blur-md rounded text-[10px] text-white font-medium flex items-center gap-0.5 shadow">
                    <FileText size={10} /> PDF
                  </div>
                )}

                {/* Category tag at bottom of image */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[11px] text-white">
                  {book.category}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4
                    className="font-bold text-sm text-gray-800 dark:text-gray-100 line-clamp-2 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                    title={book.title}
                  >
                    {book.title}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                    {book.author}
                  </p>

                  {/* Recommendation context pill */}
                  {book.recommendationReason && (
                    <div className="mb-3 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 rounded text-[11px] text-indigo-700 dark:text-indigo-300 truncate">
                      💡 {book.recommendationReason}
                    </div>
                  )}
                </div>

                {/* Footer Status & Action */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between gap-2">
                  <div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        book.available > 0
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}
                    >
                      {book.available > 0 ? `Còn ${book.available} bản` : 'Hết sách'}
                    </span>
                  </div>

                  {userRole !== 'ADMIN' && (
                    book.available > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBorrow(book.id);
                        }}
                        disabled={internalBorrowMutation.isPending}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shadow-sm flex items-center gap-1 active:scale-95"
                      >
                        <BookOpen size={12} />
                        Mượn
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onReserve) onReserve(book.id);
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm flex items-center gap-1 active:scale-95"
                      >
                        <BookmarkPlus size={12} />
                        Đặt trước
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
