// Dựng Express app giống server/src/index.ts (cùng middleware JSON + cùng các router /api/*)
// nhưng KHÔNG gọi app.listen, KHÔNG khởi động cron và KHÔNG phục vụ static uploads.
// Phần bootstrap còn lại của index.ts vì vậy nằm ngoài phạm vi kiểm thử tích hợp.
import express from 'express';
import cors from 'cors';
import authRoutes from '../../src/routes/authRoutes';
import bookRoutes from '../../src/routes/bookRoutes';
import loanRoutes from '../../src/routes/loanRoutes';
import analyticsRoutes from '../../src/routes/analyticsRoutes';
import reservationRoutes from '../../src/routes/reservationRoutes';
import paymentRoutes from '../../src/routes/paymentRoutes';
import inventoryRoutes from '../../src/routes/inventoryRoutes';
import notificationRoutes from '../../src/routes/notificationRoutes';

export function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/books', bookRoutes);
  app.use('/api/loans', loanRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/notifications', notificationRoutes);
  return app;
}

export { loanRoutes };
