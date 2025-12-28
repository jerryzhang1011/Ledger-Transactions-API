import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase, createTestUser, createTestAccount } from '../helpers/dbHelpers';

const app = createTestApp();

describe('Account API', () => {
  let user: { id: string; email: string };

  beforeAll(async () => {
    await cleanDatabase();
    user = await createTestUser('account-test@test.com', 'Account Test User');
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('POST /api/v1/accounts', () => {
    it('should create a new account', async () => {
      const response = await request(app)
        .post('/api/v1/accounts')
        .set('X-Test-User-Id', user.id)
        .send({
          name: 'Savings Account',
          currency: 'USD',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Savings Account');
      expect(response.body.data.currency).toBe('USD');
      expect(response.body.data.balance).toBe(0);
    });

    it('should use defaults when not provided', async () => {
      const response = await request(app)
        .post('/api/v1/accounts')
        .set('X-Test-User-Id', user.id)
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Default Account');
      expect(response.body.data.currency).toBe('USD');
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/v1/accounts').send({
        name: 'Test',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/accounts', () => {
    it('should list all user accounts', async () => {
      const response = await request(app)
        .get('/api/v1/accounts')
        .set('X-Test-User-Id', user.id);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/accounts/:accountId', () => {
    let accountId: string;

    beforeAll(async () => {
      const account = await createTestAccount(user.id, 50000, 'EUR', 'Euro Account');
      accountId = account.id;
    });

    it('should get account by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/accounts/${accountId}`)
        .set('X-Test-User-Id', user.id);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(accountId);
      expect(response.body.data.balance).toBe(50000);
      expect(response.body.data.balanceFormatted).toContain('€');
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .get('/api/v1/accounts/00000000-0000-0000-0000-000000000000')
        .set('X-Test-User-Id', user.id);

      expect(response.status).toBe(404);
    });

    it('should return 403 for account owned by another user', async () => {
      const otherUser = await createTestUser('other@test.com');
      const otherAccount = await createTestAccount(otherUser.id, 1000, 'USD');

      const response = await request(app)
        .get(`/api/v1/accounts/${otherAccount.id}`)
        .set('X-Test-User-Id', user.id);

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/accounts/:accountId', () => {
    let accountId: string;

    beforeAll(async () => {
      const account = await createTestAccount(user.id, 0, 'USD', 'Original Name');
      accountId = account.id;
    });

    it('should update account name', async () => {
      const response = await request(app)
        .patch(`/api/v1/accounts/${accountId}`)
        .set('X-Test-User-Id', user.id)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/v1/accounts/:accountId', () => {
    it('should deactivate account with zero balance', async () => {
      const account = await createTestAccount(user.id, 0, 'USD', 'To Delete');

      const response = await request(app)
        .delete(`/api/v1/accounts/${account.id}`)
        .set('X-Test-User-Id', user.id);

      expect(response.status).toBe(204);
    });

    it('should not delete account with positive balance', async () => {
      const account = await createTestAccount(user.id, 1000, 'USD', 'Has Balance');

      const response = await request(app)
        .delete(`/api/v1/accounts/${account.id}`)
        .set('X-Test-User-Id', user.id);

      expect(response.status).toBe(403);
    });
  });
});
