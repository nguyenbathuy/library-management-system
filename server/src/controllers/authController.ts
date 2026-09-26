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
        const user = await prisma.user.create({
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

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
};

export const getMe = async (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, email: true, name: true, role: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, createdAt: true }
    });
    res.json(users);
};
