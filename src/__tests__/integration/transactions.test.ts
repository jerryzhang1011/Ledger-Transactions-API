import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import {
  cleanDatabase,
  createTestUser,
  createTestAccount,
  getAccountBalance,
} from '../helpers/dbHelpers';

const app = createTestApp();

describe('Transaction API', () => {
  let user1: { id: string; email: string };
  let user2: { id: string; email: string };
  let account1: { id: string; balance: number };
  let account2: { id: string; balance: number };

  beforeAll(async () => {
    await cleanDatabase();

    // Create test users
    user1 = await createTestUser('alice@test.com', 'Alice');
    user2 = await createTestUser('bob@test.com', 'Bob');

    // Create accounts with initial balances
    account1 = await createTestAccount(user1.id, 100000, 'USD', 'Alice Checking'); // $1000
    account2 = await createTestAccount(user2.id, 50000, 'USD', 'Bob Checking'); // $500
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('POST /api/v1/transactions', () => {
    describe('Transfer', () => {
      it('should successfully transfer funds between accounts', async () => {
        const response = await request(app)
          .post('/api/v1/transactions')
          .set('X-Test-User-Id', user1.id)
          .send({
            type: 'TRANSFER',
            fromAccountId: account1.id,
            toAccountId: account2.id,
            amount: 10000, // $100
            currency: 'USD',
            description: 'Test transfer',
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe('TRANSFER');
        expect(response.body.data.status).toBe('COMPLETED');
        expect(response.body.data.amount).toBe(10000);

        // Verify balances
        const balance1 = await getAccountBalance(account1.id);
        const balance2 = await getAccountBalance(account2.id);

        expect(balance1).toBe(90000); // $900
        expect(balance2).toBe(60000); // $600
      });

      it('should fail with insufficient funds', async () => {
        const response = await request(app)
          .post('/api/v1/transactions')
          .set('X-Test-User-Id', user1.id)
          .send({
            type: 'TRANSFER',
            fromAccountId: account1.id,
            toAccountId: account2.id,
            amount: 1000000, // $10,000 - more than balance
            currency: 'USD',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INSUFFICIENT_FUNDS');
      });

      it('should prevent transfer from account user does not own', async () => {
        const response = await request(app)
          .post('/api/v1/transactions')
          .set('X-Test-User-Id', user2.id) // Bob trying to transfer from Alice's account
          .send({
            type: 'TRANSFER',
            fromAccountId: account1.id, // Alice's account
            toAccountId: account2.id,
            amount: 1000,
            currency: 'USD',
          });

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });

      it('should handle idempotency key correctly', async () => {
        const idempotencyKey = `test-idempotency-${Date.now()}`;
        const balanceBefore = await getAccountBalance(account1.id);

        // First request
        const response1 = await request(app)
          .post('/api/v1/transactions')
          .set('X-Test-User-Id', user1.id)
          .set('Idempotency-Key', idempotencyKey)
          .send({
            type: 'TRANSFER',
            fromAccountId: account1.id,
            toAccountId: account2.id,
            amount: 1000,
            currency: 'USD',
          });

        expect(response1.status).toBe(201);
        const transactionId = response1.body.data.id;

        // Second request with same idempotency key
        const response2 = await request(app)
          .post('/api/v1/transactions')
          .set('X-Test-User-Id', user1.id)
          .set('Idempotency-Key', idempotencyKey)
          .send({
            type: 'TRANSFER',
            fromAccountId: account1.id,
            toAccountId: account2.id,
            amount: 1000,
            currency: 'USD',
          });

        expect(response2.status).toBe(201);
        expect(response2.body.data.id).toBe(transactionId); // Same transaction returned

        // Balance should only decrease by 1000 (not 2000)
        const balanceAfter = await getAccountBalance(account1.id);
        expect(balanceBefore - balanceAfter).toBe(1000);
      });
    });

    describe('Deposit', () => {
      it('should successfully deposit funds', async () => {
        const balanceBefore = await getAccountBalance(account1.id);

        const response = await request(app)
          .post('/api/v1/transactions')
          .set('X-Test-User-Id', user1.id)
          .send({
            type: 'DEPOSIT',
            accountId: account1.id,
            amount: 5000, // $50
            currency: 'USD',
            description: 'Test deposit',
          });

        expect(response.status).toBe(201);
        expect(response.body.data.type).toBe('DEPOSIT');
        expect(response.body.data.status).toBe('COMPLETED');

        const balanceAfter = await getAccountBalance(account1.id);
        expect(balanceAfter - balanceBefore).toBe(5000);
      });
    });

    describe('Withdrawal', () => {
      it('should successfully withdraw funds', async () => {
        const balanceBefore = await getAccountBalance(account1.id);

        const response = await request(app)
          .post('/api/v1/transactions')
          .set('X-Test-User-Id', user1.id)
          .send({
            type: 'WITHDRAWAL',
            accountId: account1.id,
            amount: 5000, // $50
            currency: 'USD',
            description: 'Test withdrawal',
          });

        expect(response.status).toBe(201);
        expect(response.body.data.type).toBe('WITHDRAWAL');
        expect(response.body.data.status).toBe('COMPLETED');

        const balanceAfter = await getAccountBalance(account1.id);
        expect(balanceBefore - balanceAfter).toBe(5000);
      });
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('should list transactions with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/transactions')
        .set('X-Test-User-Id', user1.id)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('limit');
      expect(response.body.meta).toHaveProperty('total');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/transactions')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('should get transaction by ID', async () => {
      // First create a transaction
      const createResponse = await request(app)
        .post('/api/v1/transactions')
        .set('X-Test-User-Id', user1.id)
        .send({
          type: 'DEPOSIT',
          accountId: account1.id,
          amount: 100,
          currency: 'USD',
        });

      const transactionId = createResponse.body.data.id;

      // Then fetch it
      const response = await request(app)
        .get(`/api/v1/transactions/${transactionId}`)
        .set('X-Test-User-Id', user1.id);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(transactionId);
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/00000000-0000-0000-0000-000000000000')
        .set('X-Test-User-Id', user1.id);

      expect(response.status).toBe(404);
    });
  });
});
