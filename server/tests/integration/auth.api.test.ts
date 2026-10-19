/**
 * Mục tiêu: kiểm thử tích hợp xác thực/phân quyền qua HTTP thật: bcryptjs + jsonwebtoken THẬT,
 *   middleware authenticateToken/authorizeAdmin, Prisma → SQLite cách ly.
 * Kỹ thuật: hộp đen mức API; OTP 2FA được đọc trực tiếp từ DB tạm (mail đã stub, không gửi thật).
 * Liên kết hộp đen: AUTH-01 (đăng nhập đúng), AUTH-02 (sai mật khẩu), AUTH-04 (USER vào chức năng quản trị
 *   → 403), AUTH-05 (đổi mật khẩu), SRCH-07 (phân quyền 403 trên tra cứu phiếu) — theo mô tả trong brief.
 *   MEM-02/MEM-05 (Chương 3 trong repo) tái hiện DEF-001/DEF-002 ở mức lưu DB.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { buildApp } from '../helpers/app';
import { bearer, createUser, PASSWORD, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN', name: 'Thủ thư IT' });
  reader = await createUser({ email: 'reader@it.local' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Đăng nhập', () => {
  test('IT-AUTH-01 (AUTH-01) admin đăng nhập đúng (2FA tắt) → token dùng được cho /me với role ADMIN', async () => {
    const res = await login('admin@it.local', PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.requireOtp).toBe(false);
    expect(res.body.user).not.toHaveProperty('password');
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'admin@it.local', role: 'ADMIN' });
  });

  test('IT-AUTH-02 (AUTH-02) sai mật khẩu → 401, không có token', async () => {
    const res = await login('admin@it.local', 'SaiMatKhau!');
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('token');
  });

  test('IT-AUTH-03 email không tồn tại → 401 cùng thông điệp với sai mật khẩu (không lộ tài khoản)', async () => {
    const unknown = await login('nobody@it.local', PASSWORD);
    const wrong = await login('admin@it.local', 'SaiMatKhau!');
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  test('IT-AUTH-07 bật 2FA → login chỉ trả requireOtp; verify-otp đúng mã trong DB → token; dùng lại OTP → 400', async () => {
    await prisma.user.update({ where: { id: reader.id }, data: { twoFactorEnabled: true } });
    const first = await login('reader@it.local', PASSWORD);
    expect(first.body).toMatchObject({ requireOtp: true, tempUserId: reader.id });
    expect(first.body).not.toHaveProperty('token');
    const { loginOtp } = await prisma.user.findUniqueOrThrow({ where: { id: reader.id } });
    expect(loginOtp).toMatch(/^\d{6}$/);
    const verified = await request(app).post('/api/auth/verify-otp').send({ tempUserId: reader.id, otp: loginOtp });
    expect(verified.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${verified.body.token}`)).status).toBe(200);
    const reused = await request(app).post('/api/auth/verify-otp').send({ tempUserId: reader.id, otp: loginOtp });
    expect(reused.status).toBe(400);
  });
});

describe('Phân quyền', () => {
  test('IT-AUTH-04 (AUTH-04) USER gọi API quản trị danh sách thành viên → 403', async () => {
    const res = await request(app).get('/api/auth/users').set(bearer(reader));
    expect(res.status).toBe(403);
    expect((await request(app).get('/api/auth/users').set(bearer(admin))).status).toBe(200);
  });

  test('IT-SRCH-07 (SRCH-07) USER tra cứu toàn bộ phiếu mượn / khóa thành viên → 403', async () => {
    expect((await request(app).get('/api/loans/all').set(bearer(reader))).status).toBe(403);
    expect((await request(app).patch(`/api/auth/users/${admin.id}/blacklist`).set(bearer(reader))).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).isBlacklisted).toBe(false);
  });

  test('IT-AUTH-06 không có token → 401; token bị sửa chữ ký → 403', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const forged = `${bearer(admin).Authorization}x`;
    expect((await request(app).get('/api/auth/me').set('Authorization', forged)).status).toBe(403);
  });
});

describe('Đổi mật khẩu', () => {
  test('IT-AUTH-05 (AUTH-05) đổi mật khẩu → đăng nhập bằng mật khẩu mới được, mật khẩu cũ bị từ chối', async () => {
    const res = await request(app).put('/api/auth/change-password').set(bearer(reader))
      .send({ currentPassword: PASSWORD, newPassword: 'MoiHon@456' });
    expect(res.status).toBe(200);
    expect((await login('reader@it.local', 'MoiHon@456')).status).toBe(200);
    expect((await login('reader@it.local', PASSWORD)).status).toBe(401);
  });

  test('IT-AUTH-08 sai mật khẩu hiện tại → 400/401, mật khẩu cũ vẫn dùng được', async () => {
    const res = await request(app).put('/api/auth/change-password').set(bearer(reader))
      .send({ currentPassword: 'KhongDung!', newPassword: 'MoiHon@456' });
    expect([400, 401]).toContain(res.status);
    expect((await login('reader@it.local', PASSWORD)).status).toBe(200);
  });
});

describe('Tạo thành viên — POST /api/auth/register', () => {
  test('IT-MEM-01 tạo thành viên hợp lệ → 201, đăng nhập được, mật khẩu được băm', async () => {
    const res = await request(app).post('/api/auth/register').set(bearer(admin))
      .send({ email: 'new@it.local', password: 'Abc@1234', name: 'Thành viên mới' });
    expect(res.status).toBe(201);
    const saved = await prisma.user.findUniqueOrThrow({ where: { email: 'new@it.local' } });
    expect(saved.password).not.toBe('Abc@1234');
    expect((await login('new@it.local', 'Abc@1234')).status).toBe(200);
  });

  // KNOWN BUG DEF-001
  test.fails('IT-MEM-02 email thiếu "@" → bị từ chối 400, không tạo tài khoản (DEF-001)', async () => {
    const res = await request(app).post('/api/auth/register').set(bearer(admin))
      .send({ email: 'emailkhonghople', password: 'Abc@1234', name: 'Sai email' });
    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { email: 'emailkhonghople' } })).toBe(0);
  });

  // KNOWN BUG DEF-002 — kiểm tra ở mức lưu SQLite (Chương 4 mới dừng ở lời gọi Prisma).
  test.fails('IT-MEM-05 chọn hạng LECTURER → bản ghi trong DB có membershipTier LECTURER (DEF-002)', async () => {
    await request(app).post('/api/auth/register').set(bearer(admin))
      .send({ email: 'lecturer@it.local', password: 'Abc@1234', name: 'Giảng viên', membershipTier: 'LECTURER' });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'lecturer@it.local' } })).membershipTier).toBe('LECTURER');
  });
});
