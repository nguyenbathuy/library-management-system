import nodemailer, { Transporter } from 'nodemailer';

let cachedTransporter: Transporter | null = null;

/**
 * Khởi tạo hoặc tái sử dụng Transporter
 * Hỗ trợ tài khoản Gmail / SMTP thật nếu có cấu hình trong .env,
 * hoặc tự động tạo Ethereal Email giả lập để test an toàn.
 */
export const getTransporter = async (): Promise<Transporter> => {
    if (cachedTransporter) return cachedTransporter;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log('[MailService] Sử dụng cấu hình SMTP từ biến môi trường (.env)');
        cachedTransporter = nodemailer.createTransport({
            service: process.env.SMTP_SERVICE || 'gmail',
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        console.log('[MailService] Đang kết nối tài khoản Ethereal Email để giả lập gửi thư test...');
        const testAccount = await nodemailer.createTestAccount();
        console.log(`[MailService] Tài khoản Ethereal: ${testAccount.user}`);

        cachedTransporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }

    return cachedTransporter;
};

export interface EmailResult {
    success: boolean;
    to: string;
    subject: string;
    previewUrl?: string | false;
    error?: string;
}

/**
 * Gửi email nhắc nhở sách sắp đến hạn (còn 1-2 ngày)
 */
export const sendDueSoonReminderEmail = async (params: {
    to: string;
    userName: string;
    bookTitle: string;
    barcode?: string;
    borrowDate: Date;
    dueDate: Date;
    daysLeft: number;
}): Promise<EmailResult> => {
    try {
        const transporter = await getTransporter();
        const fromAddress = process.env.SMTP_FROM || '"Thư Viện PKA" <library-noreply@phenikaa-uni.edu.vn>';

        const formattedBorrowDate = new Date(params.borrowDate).toLocaleDateString('vi-VN');
        const formattedDueDate = new Date(params.dueDate).toLocaleDateString('vi-VN');

        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 24px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 22px;">Thư Viện PKA - Thông Báo Mượn Trả Sách</h1>
                <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Hệ thống thông báo tự động</p>
            </div>
            <div style="padding: 24px; color: #1e293b;">
                <p style="font-size: 16px;">Xin chào <strong>${params.userName}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.6;">
                    Thư viện xin thông báo cuốn sách bạn đang mượn <strong>sắp đến hạn phải hoàn trả</strong> (chỉ còn <span style="color: #d97706; font-weight: bold;">${params.daysLeft} ngày</span>).
                </p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #b45309; font-size: 16px;">📖 Chi tiết phiếu mượn</h3>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Tên sách:</strong> ${params.bookTitle}</p>
                    ${params.barcode ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Mã vạch:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${params.barcode}</code></p>` : ''}
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Ngày mượn:</strong> ${formattedBorrowDate}</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Hạn hoàn trả:</strong> <span style="color: #dc2626; font-weight: bold;">${formattedDueDate}</span></p>
                </div>

                <p style="font-size: 14px; line-height: 1.6;">
                    Vui lòng sắp xếp thời gian mang sách đến thư viện hoàn trả đúng hạn để tránh phát sinh phí phạt hoặc ảnh hưởng đến quyền mượn sách.
                </p>

                <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
                    <p style="margin: 0;">Thư viện Đại học Phenikaa | Giờ mở cửa: 08:00 - 21:00 (Thứ 2 - Thứ 7)</p>
                    <p style="margin: 4px 0 0 0;">Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
                </div>
            </div>
        </div>
        `;

        const info = await transporter.sendMail({
            from: fromAddress,
            to: params.to,
            subject: `[Nhắc nhở] Sách "${params.bookTitle}" sắp đến hạn trả (${params.daysLeft} ngày nữa)`,
            html,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`[MailService] 📧 [Sắp đến hạn] Preview Ethereal Email cho ${params.to}: ${previewUrl}`);
        }

        return {
            success: true,
            to: params.to,
            subject: `[Nhắc nhở] Sách "${params.bookTitle}" sắp đến hạn trả`,
            previewUrl
        };
    } catch (error: any) {
        console.error(`[MailService] Lỗi gửi email sắp đến hạn cho ${params.to}:`, error);
        return {
            success: false,
            to: params.to,
            subject: 'Nhắc nhở sắp đến hạn',
            error: error.message
        };
    }
};

/**
 * Gửi email cảnh báo sách đã QUÁ HẠN mượn
 */
export const sendOverdueReminderEmail = async (params: {
    to: string;
    userName: string;
    bookTitle: string;
    barcode?: string;
    borrowDate: Date;
    dueDate: Date;
    overdueDays: number;
}): Promise<EmailResult> => {
    try {
        const transporter = await getTransporter();
        const fromAddress = process.env.SMTP_FROM || '"Thư Viện PKA" <library-noreply@phenikaa-uni.edu.vn>';

        const formattedBorrowDate = new Date(params.borrowDate).toLocaleDateString('vi-VN');
        const formattedDueDate = new Date(params.dueDate).toLocaleDateString('vi-VN');

        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fecaca; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 24px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 22px;">⚠️ CẢNH BÁO: SÁCH MƯỢN ĐÃ QUÁ HẠN</h1>
                <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Thư Viện PKA - Yêu cầu hoàn trả sách ngay</p>
            </div>
            <div style="padding: 24px; color: #1e293b;">
                <p style="font-size: 16px;">Kính gửi độc giả <strong>${params.userName}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.6; color: #b91c1c;">
                    Hệ thống ghi nhận bạn đang có phiếu mượn sách <strong>ĐÃ QUÁ HẠN ${params.overdueDays} NGÀY</strong> và chưa hoàn trả về thư viện.
                </p>
                
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #991b1b; font-size: 16px;">📕 Thông tin phiếu quá hạn</h3>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Tên sách:</strong> ${params.bookTitle}</p>
                    ${params.barcode ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Mã vạch:</strong> <code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px;">${params.barcode}</code></p>` : ''}
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Ngày mượn:</strong> ${formattedBorrowDate}</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>Hạn chót phải trả:</strong> <span style="color: #dc2626; font-weight: bold;">${formattedDueDate}</span></p>
                    <p style="margin: 4px 0; font-size: 14px; color: #dc2626;"><strong>Số ngày trễ hạn:</strong> ${params.overdueDays} ngày</p>
                </div>

                <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 12px; border-radius: 8px; font-size: 13px; color: #92400e; margin-bottom: 20px;">
                    ⚠️ <strong>Lưu ý quan trọng:</strong> Theo quy định thư viện, tài khoản giữ sách quá hạn sẽ bị <strong>tạm khóa quyền mượn sách mới (đưa vào Danh sách Đen)</strong> và có thể áp dụng mức phí phạt trễ hạn.
                </div>

                <p style="font-size: 14px; line-height: 1.6;">
                    Yêu cầu bạn mang sách đến quầy thủ thư để làm thủ tục hoàn trả trong thời gian sớm nhất.
                </p>

                <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
                    <p style="margin: 0;">Thư viện Đại học Phenikaa | Giờ mở cửa: 08:00 - 21:00 (Thứ 2 - Thứ 7)</p>
                    <p style="margin: 4px 0 0 0;">Email này được gửi tự động, vui lòng liên hệ trực tiếp thủ thư nếu có thắc mắc.</p>
                </div>
            </div>
        </div>
        `;

        const info = await transporter.sendMail({
            from: fromAddress,
            to: params.to,
            subject: `[CẢNH BÁO] Sách "${params.bookTitle}" ĐÃ QUÁ HẠN ${params.overdueDays} ngày`,
            html,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`[MailService] 🚨 [Quá hạn] Preview Ethereal Email cho ${params.to}: ${previewUrl}`);
        }

        return {
            success: true,
            to: params.to,
            subject: `[CẢNH BÁO] Sách "${params.bookTitle}" ĐÃ QUÁ HẠN`,
            previewUrl
        };
    } catch (error: any) {
        console.error(`[MailService] Lỗi gửi email quá hạn cho ${params.to}:`, error);
        return {
            success: false,
            to: params.to,
            subject: 'Cảnh báo sách quá hạn',
            error: error.message
        };
    }
};
