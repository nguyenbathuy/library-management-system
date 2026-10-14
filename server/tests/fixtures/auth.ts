export const CLOCK = new Date('2026-10-11T00:00:00.000Z');
export const HASH = 'unit-test-hash-output';
export const TOKEN = 'unit-test-jwt-output';
export const ACTOR = { userId: 1, email: 'user@example.com', role: 'USER' };

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: 'user@example.com',
    name: 'Unit Test User',
    password: 'unit-test-stored-hash',
    role: 'USER',
    membershipTier: 'STANDARD',
    isBlacklisted: false,
    resetOtp: '123456',
    resetOtpExpiry: new Date(CLOCK.getTime() + 1),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
