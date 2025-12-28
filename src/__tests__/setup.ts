import { db } from '../database/connection';

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Clean up database connection after all tests
afterAll(async () => {
  await db.destroy();
});

// Mock the logger to avoid noise in tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
  },
}));
