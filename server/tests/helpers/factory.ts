// Factory dữ liệu tối thiểu cho DB tạm (không dùng dữ liệu thật). Mật khẩu băm bằng bcryptjs thật.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const prisma = new PrismaClient();
export const DAY = 24 * 60 * 60 * 1000;
export const PASSWORD = 'Test@123';
let hashed: string | undefined;

export async function resetDatabase() {
  await prisma.notification.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.bookItem.deleteMany();
  await prisma.book.deleteMany();
  await prisma.category.deleteMany();
  await prisma.author.deleteMany();
  await prisma.publisher.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.token.deleteMany();
  await prisma.user.deleteMany();
}

export async function createUser(overrides: Partial<{
  email: string; name: string; role: string; membershipTier: string; isBlacklisted: boolean; twoFactorEnabled: boolean; password: string;
}> = {}) {
  const { password, ...data } = overrides;
  hashed ??= await bcrypt.hash(PASSWORD, 10);
  return prisma.user.create({
    data: {
      email: `user-${Math.random().toString(36).slice(2, 10)}@test.local`,
      name: 'Độc giả tích hợp',
      role: 'USER',
      membershipTier: 'STANDARD',
      ...data,
      password: password ? await bcrypt.hash(password, 10) : hashed,
    },
  });
}

export async function createBook(isbn: string, copies = 3, title = `Sách ${isbn}`) {
  const book = await prisma.book.create({
    data: {
      title,
      isbn,
      category: { connectOrCreate: { where: { name: 'Kiểm thử' }, create: { name: 'Kiểm thử' } } },
      author: { connectOrCreate: { where: { name: 'Nhóm 8' }, create: { name: 'Nhóm 8' } } },
      items: { create: Array.from({ length: copies }, (_, i) => ({ barcode: `${isbn}-${i + 1}`, location: 'Kệ IT' })) },
    },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  return book;
}

/** Tạo phiếu mượn trực tiếp qua Prisma (dựng mốc quá hạn bằng dueDate như mục 3.2.2 của báo cáo). */
export async function createLoan(userId: number, bookItemId: number, overrides: Record<string, unknown> = {}) {
  const loan = await prisma.loan.create({
    data: { userId, bookItemId, dueDate: new Date(Date.now() + 10 * DAY), status: 'ACTIVE', ...overrides },
  });
  if (!loan.returnDate) await prisma.bookItem.update({ where: { id: bookItemId }, data: { status: 'BORROWED' } });
  return loan;
}

export const tokenFor = (user: { id: number; email: string; role: string }) =>
  jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

export const bearer = (user: { id: number; email: string; role: string }) => ({ Authorization: `Bearer ${tokenFor(user)}` });

export const availableCount = (bookId: number) => prisma.bookItem.count({ where: { bookId, status: 'AVAILABLE' } });
export const daysBetween = (a: Date, b: Date) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
