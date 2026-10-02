import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'vi' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  vi: {
    // Brand & Layout
    'brand.name': 'Thư Viện PKA',
    'sidebar.dashboard': 'Tổng quan hệ thống',
    'sidebar.profile': 'Hồ sơ & Lịch sử mượn',
    'sidebar.books': 'Tra cứu Tủ sách',
    'sidebar.adminSection': 'Quản trị viên',
    'sidebar.members': 'Quản lý Độc giả',
    'sidebar.circulation': 'Quản lý Mượn / Đặt trước',
    'sidebar.inventory': 'Kiểm kê kho sách',
    'sidebar.settings': 'Cài đặt hệ thống',
    'theme.dark': 'Chế độ Tối',
    'theme.light': 'Chế độ Sáng',

    // Header
    'header.search': 'Tìm kiếm sách, tác giả, mã vạch...',
    'header.profile': 'Hồ sơ cá nhân',
    'header.logout': 'Đăng xuất',
    'header.admin': 'Thủ thư',
    'header.user': 'Độc giả',
    'header.defaultUser': 'Người dùng',
    'header.notifications': 'Thông báo',

    // Login
    'login.title': 'Đăng nhập vào tài khoản',
    'login.subtitle': 'Nhập thông tin xác thực để truy cập hệ thống',
    'login.email': 'Địa chỉ Email',
    'login.password': 'Mật khẩu',
    'login.rememberMe': 'Ghi nhớ đăng nhập',
    'login.forgotPassword': 'Quên mật khẩu?',
    'login.signIn': 'Đăng nhập',
    'login.demoCredentials': 'Tài khoản dùng thử:',
    'login.noAccount': 'Chưa có tài khoản?',
    'login.contactAdmin': 'Liên hệ quản trị viên',
    'login.welcome': 'Chào mừng bạn đến với LibraryPKA',
    'login.description': 'Quản lý thư viện hiệu quả với hệ thống quản trị toàn diện.',
    'login.feature1': 'Quản lý kho sách',
    'login.feature2': 'Theo dõi mượn trả',
    'login.feature3': 'Thống kê báo cáo',

    // Dashboard
    'dashboard.title': 'Bảng điều khiển',
    'dashboard.subtitle': 'Chào mừng trở lại! Dưới đây là tình hình hoạt động của thư viện hôm nay.',
    'dashboard.exportPdf': 'Xuất báo cáo PDF',
    'dashboard.exporting': 'Đang xuất...',
    'dashboard.totalBooks': 'Tổng đầu sách',
    'dashboard.inStock': 'Cuốn trong kho',
    'dashboard.activeUsers': 'Độc giả hoạt động',
    'dashboard.membersCount': 'Thành viên',
    'dashboard.borrowing': 'Đang cho mượn',
    'dashboard.activeLoans': 'Phiếu mượn',
    'dashboard.overdueBooks': 'Sách quá hạn',
    'dashboard.needAction': 'Cần thu hồi ngay',
    'dashboard.trendTitle': 'Xu hướng mượn sách (Năm 2026)',
    'dashboard.borrowCount': 'Lượt mượn',
    'dashboard.topBooks': 'Sách đọc nhiều',
    'dashboard.recentActivity': 'Hoạt động mượn trả gần đây',
    'dashboard.borrowedAction': 'mượn',
    'dashboard.returnedAction': 'trả',
    'dashboard.times': 'lượt',

    // Books
    'books.title': 'Quản lý sách',
    'books.subtitle': 'Quản lý kho sách và danh mục học liệu',
    'books.addNew': 'Thêm sách mới',
    'books.search': 'Tìm kiếm sách theo tên, tác giả, ISBN...',
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
    'books.outOfStock': 'Hết sách',
    'books.remaining': 'Còn',
    'books.viewDetails': 'Xem chi tiết',
    'books.description': 'Tóm tắt nội dung',
    'books.publisher': 'Nhà xuất bản',
    'books.publishedYear': 'Năm XB',
    'books.pages': 'Số trang',
    'books.language': 'Ngôn ngữ',
    'books.importExcel': 'Import Excel',
    'books.importing': 'Đang import...',
    'books.loading': 'Đang tải dữ liệu sách...',
    'books.notFound': 'Không tìm thấy cuốn sách nào phù hợp.',
    'books.borrow': 'Mượn sách',
    'books.reserve': 'Đặt trước',
    'books.editBook': 'Chỉnh sửa sách',
    'books.bookTitle': 'Tiêu đề',
    'books.author': 'Tác giả',
    'books.quantity': 'Số lượng',

    // Common
    'common.save': 'Lưu lại',
    'common.cancel': 'Hủy',
    'common.edit': 'Chỉnh sửa',
    'common.delete': 'Xóa',
    'common.search': 'Tìm kiếm...',
    'common.loading': 'Đang tải...',
    'common.actions': 'Thao tác',
    'common.status': 'Trạng thái',

    // Borrowed
    'borrowed.title': 'Quản lý mượn trả',
    'borrowed.subtitle': 'Theo dõi sách đang lưu thông và hạn trả',
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
    'borrowed.returned': 'Đã trả',
    'borrowed.days': 'ngày',
    'borrowed.returnBook': 'Trả sách',
    'borrowed.renew': 'Gia hạn',
    'borrowed.renewTooltip': 'Gia hạn thêm 7 ngày',
    'borrowed.showing': 'Hiển thị',
    'borrowed.of': 'trên',
    'borrowed.borrowedBooks': 'lượt mượn',
    'borrowed.scanBarcode': 'Quét mã vạch mượn/trả',
    'borrowed.reservationsTab': 'Danh sách Đặt trước',
    'borrowed.loansTab': 'Phiếu mượn đang lưu thông',

    // Members
    'members.title': 'Thành viên',
    'members.subtitle': 'Quản lý thành viên thư viện',
    'members.addNew': 'Thêm thành viên',
    'members.search': 'Tìm thành viên theo tên hoặc email...',
    'members.memberInfo': 'Thông tin thành viên',
    'members.type': 'Loại thẻ',
    'members.joinDate': 'Ngày tham gia',
    'members.booksOut': 'Sách đang mượn',
    'members.status': 'Trạng thái',
    'members.actions': 'Thao tác',
    'members.active': 'Hoạt động',
    'members.inactive': 'Ngừng hoạt động',
    'members.blacklisted': 'Danh sách Đen',

    // Profile
    'profile.title': 'Hồ sơ độc giả',
    'profile.subtitle': 'Quản lý thông tin cá nhân, theo dõi lịch sử mượn trả và sách đặt trước',
    'profile.currentLoans': 'Sách đang mượn',
    'profile.history': 'Lịch sử mượn trả',
    'profile.reservations': 'Sách đã đặt trước',
    'profile.cardId': 'Mã thẻ',
    'profile.joined': 'Tham gia',
    'profile.librarian': 'Thủ thư',
    'profile.studentCard': 'Thẻ Sinh viên',
    'profile.activeLoans': 'Đang mượn',
    'profile.overdue': 'Quá hạn',
    'profile.waiting': 'Chờ nhận sách',
    'profile.noLoans': 'Bạn hiện không có sách nào đang mượn',
    'profile.noReservations': 'Không có sách nào đang đặt trước',
    'profile.cancelReservation': 'Hủy đặt trước',

    // Settings
    'settings.title': 'Cài đặt',
    'settings.subtitle': 'Quản lý tùy chọn hệ thống và thông số vận hành thư viện',
    'settings.general': 'Cài đặt chung',
    'settings.generalDesc': 'Thông tin nhận diện thư viện và quy định mượn trả tiêu chuẩn',
    'settings.libraryName': 'Tên thư viện',
    'settings.libraryNameDesc': 'Tên hiển thị chính thức của thư viện trên hệ thống và email thông báo',
    'settings.loanPeriod': 'Thời hạn mượn sách',
    'settings.loanPeriodDesc': 'Quy định số ngày mượn tối đa trước khi tính phạt trễ hạn (mặc định 14 ngày)',
    'settings.maxBooks': 'Giới hạn mượn tối đa',
    'settings.maxBooksDesc': 'Số lượng sách tối đa độc giả được phép mượn cùng lúc theo hạng thành viên',
    'settings.edit': 'Chỉnh sửa',
    
    'settings.notifications': 'Thông báo & Email',
    'settings.notificationsDesc': 'Tùy chỉnh thông báo hệ thống và email tự động gửi đến độc giả',
    'settings.overdueReminders': 'Nhắc nhở hạn trả sách',
    'settings.overdueDesc': 'Tự động gửi email cảnh báo khi sách sắp đến hạn (1-2 ngày) hoặc đã quá hạn',
    'settings.newBookNotif': 'Thông báo sách mới',
    'settings.newBookDesc': 'Nhận thông báo khi thư viện nhập thêm các đầu sách mới về kho',
    
    'settings.security': 'Bảo mật & Tài khoản',
    'settings.securityDesc': 'Bảo vệ tài khoản và thiết lập các phương thức xác thực an toàn',
    'settings.twoFactor': 'Xác thực 2 lớp (2FA)',
    'settings.twoFactorDesc': 'Tăng cường bảo mật bằng mã xác minh OTP gửi qua ứng dụng bảo mật',
    'settings.enable': 'Kích hoạt',
    'settings.changePassword': 'Đổi mật khẩu',
    'settings.passwordDesc': 'Cập nhật mật khẩu định kỳ để nâng cao an toàn thông tin tài khoản',
    'settings.change': 'Thay đổi',
    
    'settings.appearance': 'Giao diện & Ngôn ngữ',
    'settings.appearanceDesc': 'Tùy biến hiển thị màu sắc và ngôn ngữ sử dụng của hệ thống',
    'settings.theme': 'Chủ đề giao diện',
    'settings.themeDesc': 'Chuyển đổi linh hoạt giữa chế độ nền sáng (Light) và nền tối (Dark)',
    'settings.language': 'Ngôn ngữ hiển thị',
    'settings.languageDesc': 'Chọn ngôn ngữ giao diện ưu tiên khi sử dụng phần mềm',
    
    'settings.cronjob': 'Hệ thống ngầm (Cronjob)',
    'settings.cronjobDesc': 'Quản lý lịch trình tự động quét nợ phạt, kiểm tra hạn trả và kích hoạt tác vụ ngầm',
    'settings.cronSchedule': 'Lịch trình quét tự động',
    'settings.cronScheduleDesc': 'Tiến trình tự động kích hoạt vào lúc 08:00 sáng mỗi ngày ("0 8 * * *")',
    'settings.triggerNow': 'Kích hoạt quét nợ phạt ngay lập tức',
    'settings.triggerNowDesc': 'Quét toàn bộ phiếu mượn quá hạn và gửi email nhắc nhở ngay tức thì (dành cho Admin test)',
    'settings.runningJob': 'Đang quét & gửi email...',
    'settings.lastRun': 'Lần kích hoạt gần nhất',
    
    // Common
    'common.all': 'Tất cả',
    'common.light': 'Sáng',
    'common.dark': 'Tối',
  },
  en: {
    // Brand & Layout
    'brand.name': 'PKA Library',
    'sidebar.dashboard': 'System Dashboard',
    'sidebar.profile': 'Profile & Loans',
    'sidebar.books': 'Browse Catalog',
    'sidebar.adminSection': 'Administrator',
    'sidebar.members': 'Manage Members',
    'sidebar.circulation': 'Loans & Reserves',
    'sidebar.inventory': 'Inventory Check',
    'sidebar.settings': 'System Settings',
    'theme.dark': 'Dark Mode',
    'theme.light': 'Light Mode',

    // Header
    'header.search': 'Search books, authors, barcodes...',
    'header.profile': 'User Profile',
    'header.logout': 'Sign Out',
    'header.admin': 'Librarian',
    'header.user': 'Member',
    'header.defaultUser': 'User',
    'header.notifications': 'Notifications',

    // Login
    'login.title': 'Sign in to Account',
    'login.subtitle': 'Enter your credentials to access system',
    'login.email': 'Email Address',
    'login.password': 'Password',
    'login.rememberMe': 'Remember Me',
    'login.forgotPassword': 'Forgot Password?',
    'login.signIn': 'Sign In',
    'login.demoCredentials': 'Demo Accounts:',
    'login.noAccount': "Don't have an account?",
    'login.contactAdmin': 'Contact Administrator',
    'login.welcome': 'Welcome to LibraryPKA',
    'login.description': 'Efficient library management with comprehensive admin tools.',
    'login.feature1': 'Catalog Inventory',
    'login.feature2': 'Circulation Tracking',
    'login.feature3': 'Reports & Analytics',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Welcome back! Here is what is happening in the library today.',
    'dashboard.exportPdf': 'Export PDF Report',
    'dashboard.exporting': 'Exporting...',
    'dashboard.totalBooks': 'Total Titles',
    'dashboard.inStock': 'Copies in stock',
    'dashboard.activeUsers': 'Active Readers',
    'dashboard.membersCount': 'Registered members',
    'dashboard.borrowing': 'Currently Borrowed',
    'dashboard.activeLoans': 'Active loans',
    'dashboard.overdueBooks': 'Overdue Books',
    'dashboard.needAction': 'Requires action',
    'dashboard.trendTitle': 'Borrowing Trends (Year 2026)',
    'dashboard.borrowCount': 'Borrow count',
    'dashboard.topBooks': 'Popular Books',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.borrowedAction': 'borrowed',
    'dashboard.returnedAction': 'returned',
    'dashboard.times': 'times',

    // Books
    'books.title': 'Book Management',
    'books.subtitle': 'Manage library inventory and academic resources',
    'books.addNew': 'Add New Book',
    'books.search': 'Search books by title, author, ISBN...',
    'books.grid': 'Grid',
    'books.table': 'Table',
    'books.bookDetails': 'Book Details',
    'books.isbn': 'ISBN',
    'books.category': 'Category',
    'books.status': 'Status',
    'books.availability': 'Availability',
    'books.actions': 'Actions',
    'books.showing': 'Showing',
    'books.of': 'of',
    'books.booksText': 'books',
    'books.available': 'Available',
    'books.borrowed': 'Borrowed',
    'books.reserved': 'Reserved',
    'books.outOfStock': 'Out of stock',
    'books.remaining': 'Remaining',
    'books.viewDetails': 'View Details',
    'books.description': 'Description',
    'books.publisher': 'Publisher',
    'books.publishedYear': 'Year',
    'books.pages': 'Pages',
    'books.language': 'Language',
    'books.importExcel': 'Import Excel',
    'books.importing': 'Importing...',
    'books.loading': 'Loading books data...',
    'books.notFound': 'No matching books found.',
    'books.borrow': 'Borrow Book',
    'books.reserve': 'Reserve',
    'books.editBook': 'Edit Book',
    'books.bookTitle': 'Title',
    'books.author': 'Author',
    'books.quantity': 'Quantity',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.search': 'Search...',
    'common.loading': 'Loading...',
    'common.actions': 'Actions',
    'common.status': 'Status',

    // Borrowed
    'borrowed.title': 'Circulation Management',
    'borrowed.subtitle': 'Track active loans and due dates',
    'borrowed.search': 'Search by book title or member name...',
    'borrowed.book': 'Book',
    'borrowed.borrower': 'Borrower',
    'borrowed.borrowDate': 'Borrow Date',
    'borrowed.dueDate': 'Due Date',
    'borrowed.daysLeft': 'Time Remaining',
    'borrowed.status': 'Status',
    'borrowed.actions': 'Actions',
    'borrowed.onTime': 'On Time',
    'borrowed.dueSoon': 'Due Soon',
    'borrowed.overdue': 'Overdue',
    'borrowed.returned': 'Returned',
    'borrowed.days': 'days',
    'borrowed.returnBook': 'Return Book',
    'borrowed.renew': 'Renew',
    'borrowed.renewTooltip': 'Renew for 7 days',
    'borrowed.showing': 'Showing',
    'borrowed.of': 'of',
    'borrowed.borrowedBooks': 'loans',
    'borrowed.scanBarcode': 'Scan Barcode',
    'borrowed.reservationsTab': 'Reservations',
    'borrowed.loansTab': 'Active Loans',

    // Members
    'members.title': 'Members Management',
    'members.subtitle': 'Manage library members and credentials',
    'members.addNew': 'Add Member',
    'members.search': 'Search members by name or email...',
    'members.memberInfo': 'Member Info',
    'members.type': 'Tier',
    'members.joinDate': 'Join Date',
    'members.booksOut': 'Books Out',
    'members.status': 'Status',
    'members.actions': 'Actions',
    'members.active': 'Active',
    'members.inactive': 'Inactive',
    'members.blacklisted': 'Blacklisted',

    // Profile
    'profile.title': 'Personal Profile & Library Card',
    'profile.subtitle': 'View membership details, borrowing limits, and active loans',
    'profile.currentLoans': 'Current Loans',
    'profile.history': 'Circulation History',
    'profile.reservations': 'Reserved Books',
    'profile.cardId': 'Card ID',
    'profile.joined': 'Joined',
    'profile.librarian': 'Librarian',
    'profile.studentCard': 'Student Card',
    'profile.activeLoans': 'Borrowing',
    'profile.overdue': 'Overdue',
    'profile.waiting': 'Waiting for Pickup',
    'profile.noLoans': 'You have no active loans',
    'profile.noReservations': 'No reservations found',
    'profile.cancelReservation': 'Cancel Reservation',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage system preferences and library circulation rules',
    'settings.general': 'General Settings',
    'settings.generalDesc': 'Library identity and standard circulation policies',
    'settings.libraryName': 'Library Name',
    'settings.libraryNameDesc': 'Official library display name on system and notification emails',
    'settings.loanPeriod': 'Loan Period',
    'settings.loanPeriodDesc': 'Maximum borrowing days before overdue fines are applied (default 14 days)',
    'settings.maxBooks': 'Max Books Allowed',
    'settings.maxBooksDesc': 'Maximum number of books a member can borrow at once by tier',
    'settings.edit': 'Edit',
    
    'settings.notifications': 'Notifications & Email',
    'settings.notificationsDesc': 'Manage system alerts and automated emails to patrons',
    'settings.overdueReminders': 'Overdue Reminders',
    'settings.overdueDesc': 'Automatically send email alerts when books are due soon or overdue',
    'settings.newBookNotif': 'New Book Alerts',
    'settings.newBookDesc': 'Receive updates when new books are imported into catalog',
    
    'settings.security': 'Security & Account',
    'settings.securityDesc': 'Manage account protection and secure authentication methods',
    'settings.twoFactor': 'Two-Factor Authentication (2FA)',
    'settings.twoFactorDesc': 'Enhance security using an authenticator app OTP verification',
    'settings.enable': 'Enable',
    'settings.changePassword': 'Change Password',
    'settings.passwordDesc': 'Update your password regularly to maintain account security',
    'settings.change': 'Change',
    
    'settings.appearance': 'Appearance & Language',
    'settings.appearanceDesc': 'Customize color themes and system display language',
    'settings.theme': 'Interface Theme',
    'settings.themeDesc': 'Switch between light and dark interface themes',
    'settings.language': 'Display Language',
    'settings.languageDesc': 'Choose your preferred language for the system interface',
    
    'settings.cronjob': 'Background System (Cronjob)',
    'settings.cronjobDesc': 'Manage automated loan scans, overdue alerts, and trigger background tasks',
    'settings.cronSchedule': 'Scheduled Automatic Scan',
    'settings.cronScheduleDesc': 'Daily background routine triggered at 08:00 AM ("0 8 * * *")',
    'settings.triggerNow': 'Trigger Overdue Scan Immediately',
    'settings.triggerNowDesc': 'Scan all overdue loans and dispatch reminder emails immediately without waiting',
    'settings.runningJob': 'Scanning & Sending Emails...',
    'settings.lastRun': 'Last Execution',

    // Common
    'common.all': 'All',
    'common.light': 'Light',
    'common.dark': 'Dark',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('language');
      if (saved === 'vi' || saved === 'en') return saved;
    } catch (e) {
      console.error('Error reading language from localStorage:', e);
    }
    return 'vi';
  });

  useEffect(() => {
    try {
      localStorage.setItem('language', language);
      document.documentElement.lang = language;
    } catch (e) {
      console.error('Error writing language to localStorage:', e);
    }
  }, [language]);

  const t = (key: string): string => {
    // @ts-ignore
    const currentVal = translations[language]?.[key];
    if (currentVal !== undefined) return currentVal;
    // Fallback to Vietnamese if available
    // @ts-ignore
    const fallbackVal = translations['vi']?.[key];
    if (fallbackVal !== undefined) return fallbackVal;
    return key;
  };

  const changeLanguage = (lang: Language) => {
    setLanguageState(lang);
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