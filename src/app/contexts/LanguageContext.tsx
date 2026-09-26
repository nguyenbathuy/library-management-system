import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'vi' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  vi: {
    // Navigation
    'nav.dashboard': 'Bảng điều khiển',
    'nav.books': 'Danh mục sách',
    'nav.members': 'Thành viên',
    'nav.borrowed': 'Quản lý mượn trả',
    'nav.settings': 'Cài đặt',
    
    // Header
    'header.search': 'Tìm kiếm...',
    'header.profile': 'Hồ sơ',
    'header.logout': 'Logout',
    'header.librarian': 'Thủ thư',

    // Login
    'login.title': 'Đăng nhập vào tài khoản',
    'login.subtitle': 'Nhập thông tin xác thực để truy cập hệ thống',
    'login.email': 'Địa chỉ Email',
    'login.password': 'Mật khẩu',
    'login.rememberMe': 'Ghi nhớ đăng nhập',
    'login.forgotPassword': 'Quên mật khẩu?',
    'login.signIn': 'Đăng nhập',
    'login.demoCredentials': 'Tài khoản dùng thử:',
    'login.noAccount': "Chưa có tài khoản?",
    'login.contactAdmin': 'Liên hệ quản trị viên',
    'login.welcome': 'Chào mừng bạn đến với LibraryPKA',
    'login.description': 'Quản lý thư viện hiệu quả với hệ thống quản trị toàn diện.',
    'login.feature1': 'Quản lý kho sách',
    'login.feature2': 'Theo dõi mượn trả',
    'login.feature3': 'Thống kê báo cáo',
    
    // Books - CẬP NHẬT THÊM TỪ KHÓA MỚI
    'books.title': 'Quản lý sách',
    'books.subtitle': 'Quản lý kho sách và danh mục',
    'books.addNew': 'Thêm sách mới',
    'books.search': 'Tìm kiếm sách...',
    'books.grid': 'Lưới',
    'books.table': 'Bảng',
    'books.bookDetails': 'Chi tiết sách',
    'books.isbn': 'ISBN',
    'books.category': 'Thể loại',
    'books.status': 'Trạng thái',
    'books.availability': 'Sẵn có',
    'books.actions': 'Thao tác',
    'books.showing': 'Hiển thị',
    'books.of': 'trên',
    'books.booksText': 'cuốn sách',
    'books.available': 'Có sẵn',
    'books.borrowed': 'Đang mượn',
    'books.reserved': 'Đã đặt trước',
    'books.viewDetails': 'Xem chi tiết',
    // Mới thêm
    'books.description': 'Tóm tắt nội dung',
    'books.publisher': 'Nhà xuất bản',
    'books.publishedYear': 'Năm XB',
    'books.pages': 'Số trang',
    'books.language': 'Ngôn ngữ',

    // Members
    'members.title': 'Thành viên',
    'members.subtitle': 'Quản lý thành viên thư viện',
    'members.addNew': 'Thêm thành viên',
    'members.search': 'Tìm thành viên...',
    'members.memberInfo': 'Thông tin thành viên',
    'members.type': 'Loại thẻ',
    'members.joinDate': 'Ngày tham gia',
    'members.booksOut': 'Sách đang mượn',
    'members.status': 'Trạng thái',
    'members.actions': 'Thao tác',
    'members.active': 'Hoạt động',
    'members.inactive': 'Ngừng hoạt động',
    
    // Borrowed
    'borrowed.title': 'Sách đang mượn',
    'borrowed.subtitle': 'Theo dõi sách đang được mượn và hạn trả',
    'borrowed.search': 'Tìm theo tên sách hoặc thành viên...',
    'borrowed.book': 'Sách',
    'borrowed.borrower': 'Người mượn',
    'borrowed.borrowDate': 'Ngày mượn',
    'borrowed.dueDate': 'Hạn trả',
    'borrowed.daysLeft': 'Thời gian còn lại',
    'borrowed.status': 'Trạng thái',
    'borrowed.actions': 'Thao tác',
    'borrowed.onTime': 'Đúng hạn',
    'borrowed.dueSoon': 'Sắp đến hạn',
    'borrowed.overdue': 'Quá hạn',
    'borrowed.days': 'ngày',
    'borrowed.daysOverdue': 'ngày quá hạn',
    'borrowed.returnBook': 'Trả sách',
    'borrowed.showing': 'Hiển thị',
    'borrowed.of': 'trên',
    'borrowed.borrowedBooks': 'lượt mượn',

    // Settings
    'settings.title': 'Cài đặt',
    'settings.subtitle': 'Quản lý tùy chọn hệ thống',
    'settings.general': 'Chung',
    'settings.notifications': 'Thông báo',
    'settings.appearance': 'Giao diện',
    'settings.appearanceDesc': 'Tùy chỉnh giao diện hệ thống',
    'settings.theme': 'Chủ đề',
    'settings.themeDesc': 'Chọn chủ đề yêu thích',
    'settings.language': 'Ngôn ngữ',
    'settings.languageDesc': 'Chọn ngôn ngữ hiển thị',
    
    // Common
    'common.all': 'Tất cả',
    'common.light': 'Sáng',
    'common.dark': 'Tối',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.books': 'Books',
    'nav.members': 'Members',
    'nav.borrowed': 'Borrowed Books',
    'nav.settings': 'Settings',
    'header.logout': 'Logout',
    'books.title': 'Books Management',
    'books.addNew': 'Add New Book',
    'common.all': 'All',
    'books.description': 'Description',
    'books.publisher': 'Publisher',
    'books.publishedYear': 'Year',
    'books.pages': 'Pages',
    'books.language': 'Language',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'vi';
  });

  const t = (key: string): string => {
    // @ts-ignore
    return translations[language][key] || key;
  };

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}