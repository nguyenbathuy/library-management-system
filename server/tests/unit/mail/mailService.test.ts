/**
 * Mục tiêu: kiểm thử đơn vị mailService: chọn transporter (SMTP thật theo biến môi trường / tài khoản Ethereal giả lập,
 *   có cache) và 4 hàm gửi mail (nhắc sắp đến hạn, nhắc quá hạn, OTP đặt lại mật khẩu, OTP đăng nhập 2FA).
 * Kỹ thuật: hộp trắng phủ nhánh + phân vùng tương đương theo cấu hình SMTP_* và tham số tùy chọn (barcode, userName, expiry);
 *   `nodemailer` được mock hoàn toàn nên KHÔNG có kết nối SMTP/Ethereal/HTTP thật (isolation.ts còn chặn mạng).
 * Ranh giới: chỉ chứng minh mailService tạo đúng cấu hình transporter và nội dung/tiêu đề mail gửi vào `sendMail` giả;
 *   KHÔNG chứng minh mail được giao thật (MAIL-01 cần hộp thư/Ethereal thật, ghi pending ở báo cáo).
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): MAIL-01 (nhắc hạn bằng email), AUTH-06 (OTP quên mật khẩu).
 * test.fails: NEW FINDING FIND-17 (tên người dùng/tên sách chèn thẳng vào HTML email, không escape).
 */
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  createTestAccount: vi.fn(),
  getTestMessageUrl: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mocks.createTransport,
    createTestAccount: mocks.createTestAccount,
    getTestMessageUrl: mocks.getTestMessageUrl,
  },
}));

type MailModule = typeof import('../../../src/services/mailService');
const SMTP_KEYS = ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_FROM'] as const;
const savedEnv = Object.fromEntries(SMTP_KEYS.map((key) => [key, process.env[key]]));

/** Nạp lại mailService để xóa transporter đã cache trong module. */
async function loadMail(env: Partial<Record<(typeof SMTP_KEYS)[number], string>> = {}): Promise<MailModule> {
  vi.resetModules();
  for (const key of SMTP_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  return import('../../../src/services/mailService');
}

const lastMail = () => mocks.sendMail.mock.calls.at(-1)![0] as { from: string; to: string; subject: string; html: string };
const dueParams = { to: 'a@t.local', userName: 'Độc giả', bookTitle: 'Đắc Nhân Tâm', barcode: 'BC-1', borrowDate: new Date('2026-10-01T00:00:00Z'), dueDate: new Date('2026-10-15T00:00:00Z'), daysLeft: 2 };
const overdueParams = { to: 'a@t.local', userName: 'Độc giả', bookTitle: 'Đắc Nhân Tâm', barcode: 'BC-1', borrowDate: new Date('2026-10-01T00:00:00Z'), dueDate: new Date('2026-10-15T00:00:00Z'), overdueDays: 4 };

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.createTestAccount.mockResolvedValue({ user: 'ethereal-user', pass: 'ethereal-pass' });
  mocks.sendMail.mockResolvedValue({ messageId: 'm1' });
  mocks.getTestMessageUrl.mockReturnValue('https://ethereal.email/message/abc');
});

afterAll(() => {
  for (const key of SMTP_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('getTransporter — chọn cấu hình gửi mail', () => {
  test('UT-MAIL-01 không có SMTP_USER/SMTP_PASS → tạo tài khoản Ethereal giả lập (smtp.ethereal.email:587)', async () => {
    const mail = await loadMail();
    await mail.getTransporter();
    expect(mocks.createTestAccount).toHaveBeenCalledTimes(1);
    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: 'smtp.ethereal.email', port: 587, secure: false, auth: { user: 'ethereal-user', pass: 'ethereal-pass' },
    });
  });

  test('UT-MAIL-02 chỉ có SMTP_USER (thiếu SMTP_PASS) vẫn dùng Ethereal', async () => {
    const mail = await loadMail({ SMTP_USER: 'u@gmail.com' });
    await mail.getTransporter();
    expect(mocks.createTestAccount).toHaveBeenCalledTimes(1);
  });

  test('UT-MAIL-03 có SMTP_USER + SMTP_PASS → SMTP thật, mặc định smtp.gmail.com:587, không secure, không gọi Ethereal', async () => {
    const mail = await loadMail({ SMTP_USER: 'u@gmail.com', SMTP_PASS: 'secret' });
    await mail.getTransporter();
    expect(mocks.createTestAccount).not.toHaveBeenCalled();
    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: 'u@gmail.com', pass: 'secret' }, tls: { rejectUnauthorized: false },
    });
  });

  test.each([
    ['UT-MAIL-04a host + port tùy chỉnh', { SMTP_HOST: 'smtp.corp.local', SMTP_PORT: '2525' }, 'smtp.corp.local', 2525, false],
    ['UT-MAIL-04b cổng 465 tự bật secure', { SMTP_PORT: '465' }, 'smtp.gmail.com', 465, true],
    ['UT-MAIL-04c SMTP_SECURE=true với cổng 587', { SMTP_SECURE: 'true' }, 'smtp.gmail.com', 587, true],
    ['UT-MAIL-04d SMTP_SECURE khác "true" (vd "1") không bật secure', { SMTP_SECURE: '1' }, 'smtp.gmail.com', 587, false],
    ['UT-MAIL-04e SMTP_PORT không phải số → quay về 587', { SMTP_PORT: 'abc' }, 'smtp.gmail.com', 587, false],
  ])('%s', async (_id, extra, host, port, secure) => {
    const mail = await loadMail({ SMTP_USER: 'u', SMTP_PASS: 'p', ...extra });
    await mail.getTransporter();
    expect(mocks.createTransport.mock.calls[0][0]).toMatchObject({ host, port, secure });
  });

  test('UT-MAIL-05 transporter được cache: gọi nhiều lần chỉ tạo một lần', async () => {
    const mail = await loadMail();
    const first = await mail.getTransporter();
    const second = await mail.getTransporter();
    expect(second).toBe(first);
    expect(mocks.createTransport).toHaveBeenCalledTimes(1);
    expect(mocks.createTestAccount).toHaveBeenCalledTimes(1);
  });
});

describe('Địa chỉ người gửi (From)', () => {
  test.each([
    ['UT-MAIL-06a mặc định', {}, '"Thư Viện PKA" <library-noreply@phenikaa-uni.edu.vn>'],
    ['UT-MAIL-06b theo SMTP_USER', { SMTP_USER: 'lib@gmail.com', SMTP_PASS: 'p' }, '"Thư Viện PKA" <lib@gmail.com>'],
    ['UT-MAIL-06c SMTP_FROM ưu tiên cao nhất', { SMTP_USER: 'lib@gmail.com', SMTP_PASS: 'p', SMTP_FROM: 'Thu vien <x@y.z>' }, 'Thu vien <x@y.z>'],
  ])('%s', async (_id, env, expected) => {
    const mail = await loadMail(env);
    await mail.sendLoginOtpEmail({ to: 'a@t.local', otp: '123456' });
    expect(lastMail().from).toBe(expected);
  });
});

describe('sendDueSoonReminderEmail (MAIL-01)', () => {
  test('UT-MAIL-07 gửi đúng người nhận, tiêu đề nêu tên sách + số ngày, nội dung có tên độc giả/barcode/hạn trả; trả previewUrl', async () => {
    const mail = await loadMail();
    const res = await mail.sendDueSoonReminderEmail(dueParams);
    const sent = lastMail();
    expect(sent.to).toBe('a@t.local');
    expect(sent.subject).toBe('[Nhắc nhở] Sách "Đắc Nhân Tâm" sắp đến hạn trả (2 ngày nữa)');
    expect(sent.html).toContain('Độc giả');
    expect(sent.html).toContain('Đắc Nhân Tâm');
    expect(sent.html).toContain('BC-1');
    expect(sent.html).toContain('2 ngày');
    expect(res).toEqual({ success: true, to: 'a@t.local', subject: '[Nhắc nhở] Sách "Đắc Nhân Tâm" sắp đến hạn trả', previewUrl: 'https://ethereal.email/message/abc' });
  });

  test('UT-MAIL-08 không có barcode → nội dung không có dòng "Mã vạch"', async () => {
    const mail = await loadMail();
    await mail.sendDueSoonReminderEmail({ ...dueParams, barcode: undefined });
    expect(lastMail().html).not.toContain('Mã vạch');
  });

  test('UT-MAIL-09 gửi thất bại → success false kèm thông điệp lỗi, không ném ngoại lệ', async () => {
    mocks.sendMail.mockRejectedValue(new Error('SMTP 550'));
    const mail = await loadMail();
    expect(await mail.sendDueSoonReminderEmail(dueParams)).toEqual({ success: false, to: 'a@t.local', subject: 'Nhắc nhở sắp đến hạn', error: 'SMTP 550' });
  });

  test('UT-MAIL-10 không tạo được transporter (Ethereal lỗi) → success false', async () => {
    mocks.createTestAccount.mockRejectedValue(new Error('offline'));
    const mail = await loadMail();
    expect(await mail.sendDueSoonReminderEmail(dueParams)).toMatchObject({ success: false, error: 'offline' });
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  test('UT-MAIL-11 không có previewUrl (SMTP thật) → previewUrl falsy nhưng vẫn success', async () => {
    mocks.getTestMessageUrl.mockReturnValue(false);
    const mail = await loadMail({ SMTP_USER: 'u', SMTP_PASS: 'p' });
    const res = await mail.sendDueSoonReminderEmail(dueParams);
    expect(res.success).toBe(true);
    expect(res.previewUrl).toBe(false);
  });

  // NEW FINDING FIND-17 — tên độc giả / tên sách đưa vào HTML email không được escape (HTML injection vào email gửi cho độc giả).
  test.fails('UT-MAIL-12 (FIND-17) tên sách chứa thẻ HTML phải được escape trong nội dung email', async () => {
    const mail = await loadMail();
    await mail.sendDueSoonReminderEmail({ ...dueParams, bookTitle: '<a href="http://evil.test">Nhấn vào đây</a>' });
    expect(lastMail().html).not.toContain('<a href="http://evil.test">');
  });
});

describe('sendOverdueReminderEmail (MAIL-01)', () => {
  test('UT-MAIL-13 tiêu đề cảnh báo nêu số ngày quá hạn; nội dung có tên sách, barcode và số ngày', async () => {
    const mail = await loadMail();
    const res = await mail.sendOverdueReminderEmail(overdueParams);
    const sent = lastMail();
    expect(sent.subject).toBe('[CẢNH BÁO] Sách "Đắc Nhân Tâm" ĐÃ QUÁ HẠN 4 ngày');
    expect(sent.html).toContain('Đắc Nhân Tâm');
    expect(sent.html).toContain('BC-1');
    expect(sent.html).toContain('4');
    expect(res).toMatchObject({ success: true, to: 'a@t.local', previewUrl: 'https://ethereal.email/message/abc' });
  });

  test('UT-MAIL-14 không barcode vẫn gửi được; gửi thất bại → success false', async () => {
    const mail = await loadMail();
    expect((await mail.sendOverdueReminderEmail({ ...overdueParams, barcode: undefined })).success).toBe(true);
    mocks.sendMail.mockRejectedValue(new Error('timeout'));
    expect(await mail.sendOverdueReminderEmail(overdueParams)).toEqual({ success: false, to: 'a@t.local', subject: 'Cảnh báo sách quá hạn', error: 'timeout' });
  });
});

describe('sendPasswordResetOtpEmail (AUTH-06)', () => {
  test('UT-MAIL-15 tiêu đề và nội dung chứa mã OTP; mặc định hiệu lực 15 phút, tên "bạn"', async () => {
    const mail = await loadMail();
    const res = await mail.sendPasswordResetOtpEmail({ to: 'a@t.local', otp: '654321' });
    const sent = lastMail();
    expect(sent.subject).toBe('[Thư Viện PKA] Mã OTP xác nhận đổi mật khẩu: 654321');
    expect(sent.html).toContain('654321');
    expect(sent.html).toContain('15 phút');
    expect(sent.html).toContain('<strong>bạn</strong>');
    expect(res).toMatchObject({ success: true, subject: 'Mã OTP đổi mật khẩu' });
  });

  test('UT-MAIL-16 tên người dùng và thời hạn tùy chỉnh được dùng; thất bại → success false', async () => {
    const mail = await loadMail();
    await mail.sendPasswordResetOtpEmail({ to: 'a@t.local', otp: '111111', userName: 'Lan', expiryMinutes: 5 });
    expect(lastMail().html).toContain('<strong>Lan</strong>');
    expect(lastMail().html).toContain('5 phút');
    mocks.sendMail.mockRejectedValue(new Error('down'));
    expect(await mail.sendPasswordResetOtpEmail({ to: 'a@t.local', otp: '1' })).toMatchObject({ success: false, error: 'down' });
  });
});

describe('sendLoginOtpEmail (2FA)', () => {
  test('UT-MAIL-17 tiêu đề/nội dung chứa OTP; mặc định hiệu lực 10 phút (khác mail đặt lại mật khẩu: 15 phút)', async () => {
    const mail = await loadMail();
    const res = await mail.sendLoginOtpEmail({ to: 'a@t.local', otp: '999888' });
    const sent = lastMail();
    expect(sent.subject).toBe('[Thư Viện PKA] Mã xác thực đăng nhập (OTP): 999888');
    expect(sent.html).toContain('999888');
    expect(sent.html).toContain('10 phút');
    expect(res).toMatchObject({ success: true, subject: 'Mã OTP đăng nhập 2FA' });
  });

  test('UT-MAIL-18 thời hạn/tên tùy chỉnh; thất bại → success false kèm lỗi', async () => {
    const mail = await loadMail();
    await mail.sendLoginOtpEmail({ to: 'a@t.local', otp: '1', userName: 'Minh', expiryMinutes: 3 });
    expect(lastMail().html).toContain('3 phút');
    expect(lastMail().html).toContain('<strong>Minh</strong>');
    mocks.sendMail.mockRejectedValue(new Error('down'));
    expect(await mail.sendLoginOtpEmail({ to: 'a@t.local', otp: '1' })).toEqual({ success: false, to: 'a@t.local', subject: 'Mã OTP đăng nhập 2FA', error: 'down' });
  });
});
