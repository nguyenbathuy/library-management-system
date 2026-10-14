// The test-only alias prevents resolution to the production Prisma package.
// The hoisted vi.mock factory must replace this module BEFORE controller import.
// If registration/resolution fails, collection stops without any real client.
throw new Error('Prisma mock was not registered: refusing controller import.');

export class PrismaClient {
  constructor() {
    throw new Error('Real database access is forbidden in Authentication unit tests.');
  }
}
