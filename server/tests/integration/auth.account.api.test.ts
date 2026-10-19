/**
 * Mục tiêu: bổ sung kiểm thử tích hợp cho các endpoint /api/auth chưa được phủ ở auth.api.test.ts: đăng ký (biên đầu vào),
 *   xác thực OTP đăng nhập, gửi lại OTP, bật/tắt 2FA, hồ sơ cá nhân, danh sách thành viên, danh sách đen (blacklist),
 *   quên/đặt lại mật khẩu bằng OTP, các nhánh kiểm tra của đổi mật khẩu — qua HTTP thật trên SQLite tạm, mail bị stub.
 * Kỹ thuật: hộp đen mức API + kiểm tra DB; phân vùng tương đương và giá trị biên (độ dài mật khẩu 5/6, OTP hết hạn);
 *   kiểm tra không lộ dữ liệu nhạy cảm (hash mật khẩu, OTP) trong phản hồi.
 * Liên kết hộp đen (Kiểm thử phần mềm.pdf): AUTH-01 (OTP), AUTH-02 (đăng ký), AUTH-05 (đổi mật khẩu), AUTH-06 (quên mật khẩu bằng
 *   OTP), MEM-02, MEM-03 (email trùng), MEM-04 (blacklist → không mượn được).
 * test.fails: NEW FINDING FIND-10 (id không phải số → 500), FIND-18 (đăng ký không chuẩn hóa email nên email có chữ hoa không
 *   đăng nhập được), FIND-19 (đăng ký thiếu mật khẩu → 500), FIND-20 (quên mật khẩu tiết lộ email có tồn tại hay không,
 *   trong khi đăng nhập cố ý dùng thông điệp chung — căn cứ IT-AUTH-03, cần nhóm xác nhận).
 * Ranh giới: mail chỉ bị stub (không chứng minh giao mail thật); không kiểm thử giao diện (popup OTP, trang quên mật khẩu).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import bcrypt from 'bcryptjs';
import { buildApp } from '../helpers/app';
import { bearer, createBook, createUser, DAY, PASSWORD, prisma, resetDatabase } from '../helpers/factory';
import { assertIsolated } from '../helpers/testDb';

const mailCalls = (globalThis as unknown as { __mailCalls: Array<{ fn: string; args: any }> }).__mailCalls;
const app = buildApp();
let admin: Awaited<ReturnType<typeof createUser>>;
let reader: Awaited<ReturnType<typeof createUser>>;

const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });
const dbUser = (id: number) => prisma.user.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  await assertIsolated(prisma, process.env.LMS_TEST_DATABASE_FILE!);
});

beforeEach(async () => {
  await resetDatabase();
  mailCalls.length = 0;
  admin = await createUser({ email: 'admin@it.local', role: 'ADMIN', name: 'Thủ thư' });
  reader = await createUser({ email: 'reader@it.local', name: 'Độc giả' });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Đăng ký — POST /api/auth/register (AUTH-02, MEM-02, MEM-03)', () => {
  const register = (body: Record<string, unknown>) => request(app).post('/api/auth/register').send(body);

  test('IT-REG-01 (MEM-03) email đã tồn tại → 400, không tạo thêm tài khoản', async () => {
    const res = await register({ email: 'reader@it.local', password: 'Abc@1234', name: 'Trùng' });
    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { email: 'reader@it.local' } })).toBe(1);
  });

  test('IT-REG-02 (AUTH-02) email mới → 201; tài khoản có role USER, STANDARD, chưa Blacklist, mật khẩu không lưu dạng rõ', async () => {
    expect((await register({ email: 'new.user@it.local', password: 'Abc@1234', name: 'Mới' })).status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new.user@it.local' } });
    expect(user).toMatchObject({ role: 'USER', membershipTier: 'STANDARD', isBlacklisted: false, twoFactorEnabled: false });
    expect(user.password).not.toBe('Abc@1234');
    expect(await bcrypt.compare('Abc@1234', user.password)).toBe(true);
  });

  test('IT-REG-03 không thể tự đăng ký quyền ADMIN qua body (role bị bỏ qua)', async () => {
    await register({ email: 'sneaky@it.local', password: 'Abc@1234', name: 'X', role: 'ADMIN', isBlacklisted: false });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'sneaky@it.local' } })).role).toBe('USER');
  });

  // NEW FINDING FIND-18 — register lưu email nguyên văn, login lại chuyển email về chữ thường để tìm → tài khoản đăng ký với
  // email có chữ hoa (hoặc khoảng trắng) không bao giờ đăng nhập được (MEM-02: "tài khoản ... đăng nhập được").
  test.fails('IT-REG-04 (FIND-18, MEM-02) đăng ký với email có chữ hoa → đăng nhập được bằng chính email đó', async () => {
    expect((await register({ email: 'Nguoi.Moi@It.Local', password: 'Abc@1234', name: 'Hoa' })).status).toBe(201);
    expect((await login('Nguoi.Moi@It.Local', 'Abc@1234')).status).toBe(200);
  });

  test.fails('IT-REG-05 (FIND-18) email chỉ khác chữ hoa/thường với tài khoản có sẵn phải bị coi là trùng (400)', async () => {
    const res = await register({ email: 'READER@IT.LOCAL', password: 'Abc@1234', name: 'Trùng hoa' });
    expect(res.status).toBe(400);
  });

  // NEW FINDING FIND-19 — thiếu mật khẩu: bcrypt.hash(undefined) ném lỗi ngoài khối try → HTTP 500 thay vì 400.
  test.fails('IT-REG-06 (FIND-19) thiếu mật khẩu phải bị từ chối bằng 4xx, không phải 500', async () => {
    const res = await register({ email: 'nopass@it.local', name: 'Không mật khẩu' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('IT-REG-07 thiếu mật khẩu không tạo tài khoản (bất kể mã lỗi)', async () => {
    await register({ email: 'nopass2@it.local', name: 'Không mật khẩu' });
    expect(await prisma.user.findUnique({ where: { email: 'nopass2@it.local' } })).toBeNull();
  });
});

describe('Đăng nhập — nhánh đầu vào', () => {
  test('IT-LOG-01 thiếu email hoặc mật khẩu → 400, không phát token', async () => {
    for (const body of [{}, { email: 'reader@it.local' }, { password: PASSWORD }]) {
      const res = await request(app).post('/api/auth/login').send(body);
      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty('token');
    }
  });

  test('IT-LOG-02 email được trim + chuyển chữ thường khi đăng nhập (tài khoản có sẵn)', async () => {
    expect((await login('  READER@IT.LOCAL ', PASSWORD)).status).toBe(200);
  });

  test('IT-LOG-03 phản hồi đăng nhập không chứa hash mật khẩu', async () => {
    const res = await login('reader@it.local', PASSWORD);
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(res.body.user).toMatchObject({ role: 'USER', membershipTier: 'STANDARD', twoFactorEnabled: false });
  });
});

describe('OTP đăng nhập 2FA — POST /verify-otp, /resend-otp (AUTH-01)', () => {
  let twoFa: Awaited<ReturnType<typeof createUser>>;
  beforeEach(async () => {
    twoFa = await createUser({ email: 'twofa@it.local', twoFactorEnabled: true });
  });
  const otpFor = async () => {
    await login('twofa@it.local', PASSWORD);
    return (await dbUser(twoFa.id)).loginOtp!;
  };

  test('IT-OTP-01 đăng nhập 2FA → không có token; OTP 6 số được lưu, hạn ~10 phút; email OTP được gửi (stub) đúng mã', async () => {
    const res = await login('twofa@it.local', PASSWORD);
    expect(res.body).toMatchObject({ requireOtp: true, tempUserId: twoFa.id });
    expect(res.body).not.toHaveProperty('token');
    const user = await dbUser(twoFa.id);
    expect(user.loginOtp).toMatch(/^\d{6}$/);
    const ttl = user.loginOtpExpiry!.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(9 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(mailCalls.find((m) => m.fn === 'sendLoginOtpEmail')!.args).toMatchObject({ to: 'twofa@it.local', otp: user.loginOtp });
  });

  test('IT-OTP-02 (AUTH-01) OTP sai → 400, không token, OTP đúng vẫn còn hiệu lực', async () => {
    const otp = await otpFor();
    const wrong = otp === '000000' ? '111111' : '000000';
    const res = await request(app).post('/api/auth/verify-otp').send({ tempUserId: twoFa.id, otp: wrong });
    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty('token');
    expect((await dbUser(twoFa.id)).loginOtp).toBe(otp);
    expect((await request(app).post('/api/auth/verify-otp').send({ tempUserId: twoFa.id, otp })).status).toBe(200);
  });

  test('IT-OTP-03 OTP hết hạn → 400', async () => {
    const otp = await otpFor();
    await prisma.user.update({ where: { id: twoFa.id }, data: { loginOtpExpiry: new Date(Date.now() - 1000) } });
    const res = await request(app).post('/api/auth/verify-otp').send({ tempUserId: twoFa.id, otp });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('hết hạn');
  });

  test('IT-OTP-04 đầu vào sai: thiếu trường → 400; tempUserId không phải số → 400; người dùng không tồn tại → 404', async () => {
    expect((await request(app).post('/api/auth/verify-otp').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/verify-otp').send({ tempUserId: 'abc', otp: '123456' })).status).toBe(400);
    expect((await request(app).post('/api/auth/verify-otp').send({ tempUserId: 99999, otp: '123456' })).status).toBe(404);
  });

  test('IT-OTP-05 người dùng chưa từng yêu cầu OTP (loginOtp null) không thể xác thực bằng OTP bất kỳ', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ tempUserId: twoFa.id, otp: '123456' });
    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty('token');
  });

  test('IT-OTP-06 gửi lại OTP → mã mới thay mã cũ (mã cũ không còn dùng được), có email stub', async () => {
    const oldOtp = await otpFor();
    mailCalls.length = 0;
    const res = await request(app).post('/api/auth/resend-otp').send({ tempUserId: twoFa.id });
    expect(res.status).toBe(200);
    const fresh = (await dbUser(twoFa.id)).loginOtp!;
    expect(fresh).toMatch(/^\d{6}$/);
    expect(mailCalls.filter((m) => m.fn === 'sendLoginOtpEmail')).toHaveLength(1);
    if (fresh !== oldOtp) {
      expect((await request(app).post('/api/auth/verify-otp').send({ tempUserId: twoFa.id, otp: oldOtp })).status).toBe(400);
    }
    expect((await request(app).post('/api/auth/verify-otp').send({ tempUserId: twoFa.id, otp: fresh })).status).toBe(200);
  });

  test('IT-OTP-07 gửi lại OTP: thiếu tempUserId → 400; không phải số → 400; không tồn tại → 404', async () => {
    expect((await request(app).post('/api/auth/resend-otp').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/resend-otp').send({ tempUserId: 'abc' })).status).toBe(400);
    expect((await request(app).post('/api/auth/resend-otp').send({ tempUserId: 99999 })).status).toBe(404);
  });
});

describe('Bật/tắt 2FA, hồ sơ, danh sách thành viên', () => {
  test('IT-ACC-01 toggle-2fa: không có body → đảo trạng thái; enabled=true/false → đặt đúng; không token → 401', async () => {
    const toggle = (body: object) => request(app).patch('/api/auth/toggle-2fa').set(bearer(reader)).send(body);
    expect((await toggle({})).body.twoFactorEnabled).toBe(true);
    expect((await dbUser(reader.id)).twoFactorEnabled).toBe(true);
    expect((await toggle({})).body.twoFactorEnabled).toBe(false);
    expect((await toggle({ enabled: true })).body.twoFactorEnabled).toBe(true);
    expect((await toggle({ enabled: true })).body.twoFactorEnabled).toBe(true); // đặt lại cùng giá trị, không đảo
    expect((await toggle({ enabled: false })).body.twoFactorEnabled).toBe(false);
    expect((await request(app).patch('/api/auth/toggle-2fa').send({})).status).toBe(401);
  });

  test('IT-ACC-02 /me trả hồ sơ của chính mình, không có hash mật khẩu / OTP', async () => {
    const res = await request(app).get('/api/auth/me').set(bearer(reader));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: reader.id, email: 'reader@it.local', role: 'USER' });
    for (const secret of ['password', 'loginOtp', 'resetOtp']) expect(res.body).not.toHaveProperty(secret);
  });

  test('IT-ACC-03 token của tài khoản đã bị xóa → /me trả 404', async () => {
    const ghost = await createUser({ email: 'ghost@it.local' });
    const header = bearer(ghost);
    await prisma.user.delete({ where: { id: ghost.id } });
    expect((await request(app).get('/api/auth/me').set(header)).status).toBe(404);
  });

  test('IT-ACC-04 (MEM-01) /users (ADMIN) trả đủ thành viên theo id, không lộ mật khẩu/OTP', async () => {
    const res = await request(app).get('/api/auth/users').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.map((u: any) => u.email)).toEqual(['admin@it.local', 'reader@it.local']);
    for (const user of res.body) {
      for (const secret of ['password', 'loginOtp', 'resetOtp']) expect(user).not.toHaveProperty(secret);
    }
  });
});

describe('Danh sách đen — PATCH /api/auth/users/:id/blacklist (MEM-04)', () => {
  const toggle = (id: number | string, body: object = {}, as = admin) => request(app).patch(`/api/auth/users/${id}/blacklist`).set(bearer(as)).send(body);

  test('IT-BL-01 (MEM-04) không có body → đảo trạng thái hai chiều, lưu DB', async () => {
    expect((await toggle(reader.id)).body.user.isBlacklisted).toBe(true);
    expect((await dbUser(reader.id)).isBlacklisted).toBe(true);
    expect((await toggle(reader.id)).body.user.isBlacklisted).toBe(false);
    expect((await dbUser(reader.id)).isBlacklisted).toBe(false);
  });

  test('IT-BL-02 isBlacklisted boolean được đặt đúng, không đảo; giá trị không phải boolean bị coi như đảo', async () => {
    await toggle(reader.id, { isBlacklisted: true });
    await toggle(reader.id, { isBlacklisted: true });
    expect((await dbUser(reader.id)).isBlacklisted).toBe(true);
    await toggle(reader.id, { isBlacklisted: 'false' });
    expect((await dbUser(reader.id)).isBlacklisted).toBe(false);
  });

  test('IT-BL-03 (MEM-04) bị blacklist → mượn sách bị chặn 403; gỡ blacklist → mượn lại được', async () => {
    const book = await createBook('BL-IT-01', 2);
    await toggle(reader.id, { isBlacklisted: true });
    const send = () => request(app).post('/api/loans/borrow-by-barcode').set(bearer(admin)).send({ barcode: 'BL-IT-01-1', userId: reader.id });
    expect((await send()).status).toBe(403);
    expect(await prisma.loan.count()).toBe(0);
    await toggle(reader.id, { isBlacklisted: false });
    expect((await send()).status).toBe(200);
    expect(book.items).toHaveLength(2);
  });

  test('IT-BL-04 Admin không thể tự đưa mình vào danh sách đen; người dùng không tồn tại → 404', async () => {
    expect((await toggle(admin.id)).status).toBe(400);
    expect((await dbUser(admin.id)).isBlacklisted).toBe(false);
    expect((await toggle(99999)).status).toBe(404);
  });

  test('IT-BL-05 USER → 403; không token → 401', async () => {
    expect((await toggle(admin.id, {}, reader)).status).toBe(403);
    expect((await request(app).patch(`/api/auth/users/${reader.id}/blacklist`).send({})).status).toBe(401);
  });

  // NEW FINDING FIND-10 — id không phải số → Number("abc") = NaN → Prisma lỗi → 500.
  test.fails('IT-BL-06 (FIND-10) id không phải số phải trả 4xx, không phải 500', async () => {
    const res = await toggle('abc');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('Quên / đặt lại mật khẩu bằng OTP (AUTH-06)', () => {
  const forgot = (email: unknown) => request(app).post('/api/auth/forgot-password').send({ email });
  const reset = (body: object) => request(app).post('/api/auth/reset-password').send(body);

  test('IT-PWD-01 (AUTH-06) email tồn tại → OTP 6 số lưu DB (hạn ~15 phút), mail OTP (stub) gửi đúng mã; email không phân biệt hoa/thường', async () => {
    const res = await forgot('  READER@it.local ');
    expect(res.status).toBe(200);
    const user = await dbUser(reader.id);
    expect(user.resetOtp).toMatch(/^\d{6}$/);
    const ttl = user.resetOtpExpiry!.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(14 * 60 * 1000);
    expect(mailCalls.find((m) => m.fn === 'sendPasswordResetOtpEmail')!.args).toMatchObject({ to: 'reader@it.local', otp: user.resetOtp });
    expect(JSON.stringify(res.body)).not.toContain(user.resetOtp!);
  });

  test('IT-PWD-02 thiếu/không phải chuỗi email → 400, không gửi mail', async () => {
    expect((await forgot(undefined)).status).toBe(400);
    expect((await forgot(123)).status).toBe(400);
    expect(mailCalls).toHaveLength(0);
  });

  test('IT-PWD-03 (AUTH-06) OTP đúng → đặt lại được: đăng nhập bằng mật khẩu mới, mật khẩu cũ bị từ chối, OTP bị xóa, có thông báo', async () => {
    await forgot('reader@it.local');
    const otp = (await dbUser(reader.id)).resetOtp!;
    const res = await reset({ email: 'reader@it.local', otp, newPassword: 'MoiHon@456' });
    expect(res.status).toBe(200);
    expect((await login('reader@it.local', 'MoiHon@456')).status).toBe(200);
    expect((await login('reader@it.local', PASSWORD)).status).toBe(401);
    expect(await dbUser(reader.id)).toMatchObject({ resetOtp: null, resetOtpExpiry: null });
    expect((await prisma.notification.findMany({ where: { userId: reader.id } })).map((n) => n.title)).toEqual(['Đặt lại mật khẩu thành công']);
  });

  test('IT-PWD-04 (AUTH-06) OTP sai → 400, mật khẩu không đổi, OTP đúng vẫn dùng được', async () => {
    await forgot('reader@it.local');
    const otp = (await dbUser(reader.id)).resetOtp!;
    const wrong = otp === '000000' ? '111111' : '000000';
    expect((await reset({ email: 'reader@it.local', otp: wrong, newPassword: 'MoiHon@456' })).status).toBe(400);
    expect((await login('reader@it.local', PASSWORD)).status).toBe(200);
    expect((await reset({ email: 'reader@it.local', otp, newPassword: 'MoiHon@456' })).status).toBe(200);
  });

  test('IT-PWD-05 OTP đã dùng không dùng lại được; OTP hết hạn → 400', async () => {
    await forgot('reader@it.local');
    const otp = (await dbUser(reader.id)).resetOtp!;
    await reset({ email: 'reader@it.local', otp, newPassword: 'MoiHon@456' });
    expect((await reset({ email: 'reader@it.local', otp, newPassword: 'KhacNua@789' })).status).toBe(400);
    await forgot('reader@it.local');
    const fresh = (await dbUser(reader.id)).resetOtp!;
    await prisma.user.update({ where: { id: reader.id }, data: { resetOtpExpiry: new Date(Date.now() - DAY) } });
    const expired = await reset({ email: 'reader@it.local', otp: fresh, newPassword: 'KhacNua@789' });
    expect(expired.status).toBe(400);
    expect(expired.body.error).toContain('hết hạn');
  });

  test('IT-PWD-06 đầu vào sai: thiếu trường → 400; mật khẩu mới 5 ký tự (biên) → 400; 6 ký tự → được; email không tồn tại → 404', async () => {
    await forgot('reader@it.local');
    const otp = (await dbUser(reader.id)).resetOtp!;
    expect((await reset({ email: 'reader@it.local', otp })).status).toBe(400);
    expect((await reset({ email: 'reader@it.local', otp, newPassword: '12345' })).status).toBe(400);
    expect((await reset({ email: 'nobody@it.local', otp, newPassword: 'MoiHon@456' })).status).toBe(404);
    expect((await reset({ email: 'reader@it.local', otp, newPassword: '123456' })).status).toBe(200);
  });

  // NEW FINDING FIND-20 — thông điệp/mã khác nhau cho email có/không tồn tại cho phép dò danh sách tài khoản, trong khi
  // đăng nhập cố ý dùng thông điệp chung (IT-AUTH-03). Căn cứ: OWASP; nhóm cần xác nhận có chấp nhận đánh đổi UX không.
  test.fails('IT-PWD-07 (FIND-20) email không tồn tại và email có tồn tại phải nhận cùng một mã trạng thái', async () => {
    const known = await forgot('reader@it.local');
    const unknown = await forgot('nobody@it.local');
    expect(unknown.status).toBe(known.status);
  });
});

describe('Đổi mật khẩu — nhánh kiểm tra (AUTH-05)', () => {
  const change = (body: object, as: typeof reader | null = reader) => {
    const req = request(app).put('/api/auth/change-password');
    return (as ? req.set(bearer(as)) : req).send(body);
  };

  test('IT-CPW-01 thiếu mật khẩu hiện tại hoặc mới → 400; không token → 401', async () => {
    expect((await change({ newPassword: 'MoiHon@456' })).status).toBe(400);
    expect((await change({ currentPassword: PASSWORD })).status).toBe(400);
    expect((await change({ currentPassword: PASSWORD, newPassword: 'MoiHon@456' }, null)).status).toBe(401);
  });

  test('IT-CPW-02 mật khẩu mới 5 ký tự (biên dưới) → 400; đúng 6 ký tự → 200', async () => {
    expect((await change({ currentPassword: PASSWORD, newPassword: '12345' })).status).toBe(400);
    expect((await login('reader@it.local', PASSWORD)).status).toBe(200);
    expect((await change({ currentPassword: PASSWORD, newPassword: '123456' })).status).toBe(200);
  });

  test('IT-CPW-03 mật khẩu mới trùng mật khẩu hiện tại → 400, không đổi, không tạo thông báo', async () => {
    const res = await change({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(res.status).toBe(400);
    expect(await prisma.notification.count()).toBe(0);
  });

  test('IT-CPW-04 (NOTI-01) đổi thành công tạo đúng 1 thông báo "Đổi mật khẩu thành công" cho người đổi', async () => {
    expect((await change({ currentPassword: PASSWORD, newPassword: 'MoiHon@456' })).status).toBe(200);
    expect((await prisma.notification.findMany({ where: { userId: reader.id } })).map((n) => n.title)).toEqual(['Đổi mật khẩu thành công']);
    expect(await prisma.notification.count({ where: { userId: admin.id } })).toBe(0);
  });
});
