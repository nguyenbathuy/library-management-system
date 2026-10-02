import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import { sendPasswordResetOtpEmail } from '../services/mailService';
import { createNotification } from '../services/notificationService';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'USER',
      },
    });
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(400).json({ error: 'User already exists' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      membershipTier: user.membershipTier,
      isBlacklisted: user.isBlacklisted
    }
  });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      membershipTier: true,
      isBlacklisted: true,
      createdAt: true
    }
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
};

export const getAllUsers = async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      membershipTier: true,
      isBlacklisted: true,
      createdAt: true
    },
    orderBy: { id: 'asc' }
  });
  res.json(users);
};

export const toggleBlacklist = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isBlacklisted } = req.body;

    const targetUser = await prisma.user.findUnique({
      where: { id: Number(id) }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    // Không cho phép tự đưa chính mình vào danh sách đen
    if (targetUser.id === req.user?.userId) {
      return res.status(400).json({ error: 'Không thể tự đưa chính tài khoản của bạn vào danh sách đen' });
    }

    const newStatus = typeof isBlacklisted === 'boolean' ? isBlacklisted : !targetUser.isBlacklisted;

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: { isBlacklisted: newStatus },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        membershipTier: true,
        isBlacklisted: true,
        createdAt: true
      }
    });

    res.json({
      message: newStatus
        ? `Đã đưa độc giả "${updatedUser.name}" vào Danh sách Đen (chặn mượn sách).`
        : `Đã mở khóa và gỡ độc giả "${updatedUser.name}" khỏi Danh sách Đen.`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error toggling blacklist:', error);
    res.status(500).json({ error: 'Không thể cập nhật trạng thái danh sách đen' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có độ dài tối thiểu 6 ký tự' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng' });
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }

    // Kiểm tra xem mật khẩu mới có trùng mật khẩu cũ không
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' });
    }

    // Băm mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Tạo thông báo cho người dùng
    await createNotification({
      userId,
      title: 'Đổi mật khẩu thành công',
      message: 'Mật khẩu tài khoản của bạn vừa được cập nhật thành công.',
    });

    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Không thể cập nhật mật khẩu, vui lòng thử lại sau' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Vui lòng cung cấp địa chỉ email hợp lệ' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });
    }

    // Tạo mã OTP ngẫu nhiên 6 chữ số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Hạn 15 phút
    const expiryDate = new Date(Date.now() + 15 * 60 * 1000);

    // Lưu OTP vào DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtp: otp,
        resetOtpExpiry: expiryDate,
      },
    });

    // Gửi email OTP qua mailService
    const mailResult = await sendPasswordResetOtpEmail({
      to: user.email,
      userName: user.name,
      otp,
      expiryMinutes: 15,
    });

    res.json({
      message: 'Mã xác thực OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư (kể cả hòm thư rác/spam).',
      previewUrl: mailResult.previewUrl || undefined,
    });
  } catch (error: any) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({ error: 'Không thể gửi mã xác nhận OTP, vui lòng thử lại sau' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    if (!user.resetOtp || user.resetOtp !== cleanOtp) {
      return res.status(400).json({ error: 'Mã OTP không chính xác' });
    }

    if (!user.resetOtpExpiry || new Date(user.resetOtpExpiry) < new Date()) {
      return res.status(400).json({ error: 'Mã OTP đã hết hạn, vui lòng yêu cầu gửi lại mã mới' });
    }

    // Mã hóa mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật CSDL và xóa OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpiry: null,
      },
    });

    // Tạo thông báo cho người dùng
    await createNotification({
      userId: user.id,
      title: 'Đặt lại mật khẩu thành công',
      message: 'Mật khẩu tài khoản của bạn đã được đặt lại thành công qua mã xác thực OTP.',
    });

    res.json({ message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (error: any) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ error: 'Không thể đổi mật khẩu, vui lòng thử lại sau' });
  }
};



