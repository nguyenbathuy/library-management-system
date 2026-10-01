import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import bookRoutes from './routes/bookRoutes';
import loanRoutes from './routes/loanRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import reservationRoutes from './routes/reservationRoutes';
import { startReminderCron } from './jobs/reminderJob';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reservations', reservationRoutes);

app.get('/', (_req, res) => {
  res.send('Library API is running');
});

// Khởi chạy tác vụ Cron ngầm (chạy vào 08:00 sáng mỗi ngày)
startReminderCron();

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
