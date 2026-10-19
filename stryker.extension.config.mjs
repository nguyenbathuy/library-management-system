// Mutation testing mở rộng: các module bổ sung ở lượt mở rộng Chương 5 (controller đặt trước/kiểm kê/thanh toán/thông báo/
// thống kê/sách/phiếu mượn và reminderJob). Giữ riêng báo cáo (test-results/mutation-ext) để KHÔNG đè báo cáo Chương 6
// (test-results/mutation, 2 file loanRules.ts + authController.ts). Chạy: npm run test:mutation:ext
import base from './stryker.config.mjs';

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  ...base,
  mutate: [
    'server/src/controllers/inventoryController.ts',
    'server/src/controllers/reservationController.ts',
    'server/src/controllers/paymentController.ts',
    'server/src/controllers/notificationController.ts',
    'server/src/controllers/analyticsController.ts',
    'server/src/controllers/bookController.ts',
    'server/src/controllers/loanController.ts',
    'server/src/jobs/reminderJob.ts',
  ],
  htmlReporter: { fileName: 'test-results/mutation-ext/mutation-report.html' },
  jsonReporter: { fileName: 'test-results/mutation-ext/mutation-report.json' },
};
