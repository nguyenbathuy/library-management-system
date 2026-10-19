// Test-only preload cho backend khi chạy E2E (node -r ...). KHÔNG sửa mã nguồn ứng dụng.
// - PrismaClient: mọi `new PrismaClient()` trong server nhận datasourceUrl = DB E2E tạm.
//   schema.prisma ghi cứng file:./dev.db nên đặt DATABASE_URL không đủ để cách ly.
// - nodemailer: createTransport luôn dùng jsonTransport cục bộ, createTestAccount giả lập
//   → không gửi email thật qua Gmail SMTP / Ethereal.
const path = require('node:path');
const { createRequire } = require('node:module');

const serverRequire = createRequire(path.join(__dirname, '../../server/package.json'));
const url = process.env.E2E_DATABASE_URL;
if (!url || !url.includes('/e2e/.tmp/')) {
  throw new Error(`[e2e-preload] Refusing to start: E2E_DATABASE_URL must point into e2e/.tmp (got ${url})`);
}

const prismaModule = serverRequire('@prisma/client');
const RealPrismaClient = prismaModule.PrismaClient;
class E2EPrismaClient extends RealPrismaClient {
  constructor(options = {}) {
    super({ ...options, datasourceUrl: url });
  }
}
prismaModule.PrismaClient = E2EPrismaClient;

const nodemailer = serverRequire('nodemailer');
const realCreateTransport = nodemailer.createTransport;
nodemailer.createTransport = () => realCreateTransport.call(nodemailer, { jsonTransport: true });
nodemailer.createTestAccount = async () => ({ user: 'e2e@mail.invalid', pass: 'e2e' });

console.log(`[e2e-preload] PrismaClient -> ${url}; nodemailer -> jsonTransport (no real email)`);
