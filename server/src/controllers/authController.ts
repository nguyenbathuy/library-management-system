import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';

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

