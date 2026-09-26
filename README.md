📚 Library Management System UI (Community)
🚀 Hướng dẫn cài đặt và khởi chạy
Để cài đặt dự án trên máy cục bộ, bạn vui lòng thực hiện các bước sau trong Terminal:

Cài đặt thư viện:
Run npm i để cài đặt các dependencies cần thiết.

Khởi tạo Database (Prisma):
Vì dự án sử dụng Prisma, hãy đảm bảo bạn đã chạy lệnh sau để đồng bộ schema:
npx prisma generate

Chạy dự án:
Run npm run dev để khởi động server phát triển (Development Server).

🔐 Thông tin tài khoản Admin
Sau khi giao diện khởi chạy thành công, bạn có thể sử dụng thông tin dưới đây để đăng nhập vào hệ thống với quyền quản trị:

Email: admin@library.com

Mật khẩu: 123

🛠 Công nghệ sử dụng
Frontend: Vite, React, Tailwind CSS

Database ORM: Prisma

Scripts: Có sẵn các file PowerShell (.ps1) để test API và CRUD cho Book/Login.
