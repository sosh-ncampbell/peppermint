// Mock environment variables FIRST - before any imports
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });
Object.defineProperty(process.env, 'LOG_LEVEL', { value: 'silent', writable: true });
process.env.EXCHANGE_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';
process.env.JWT_SECRET = 'test-jwt-secret-32-characters-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.MICROSOFT_REDIRECT_URI = 'http://localhost:3000/admin/exchange/callback';

import { jest } from '@jest/globals';

// Now import the security module after env vars are set
let stopCleanupInterval: () => void;

beforeAll(() => {
  // Import and get the cleanup function after env vars are set
  const securityModule = require('../security');
  stopCleanupInterval = securityModule.stopCleanupInterval;
});

// Mock Prisma Client
const mockPrisma = {
  exchangeConnection: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  exchangeToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  exchangeOAuthSession: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  emailProcessingLog: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  ticketEmailMapping: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
};

// Make mockPrisma available globally for tests
(global as any).mockPrisma = mockPrisma;

// Mock fetch for Node.js 24
(global as any).fetch = jest.fn();

// Set up test environment
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.resetAllMocks();
});

// Clean up any intervals after all tests
afterAll(() => {
  if (stopCleanupInterval) {
    stopCleanupInterval();
  }
});