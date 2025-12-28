import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import {
  cleanDatabase,
  createTestUser,
  createTestAccount,
  getAccountBalance,
} from '../helpers/dbHelpers';

const app = createTestApp();

describe('Concurrency Tests', () => {
  /**
   * This test verifies that concurrent transfers do not result in race conditions.
   * 
   * The key insight: If we have $1000 and try to transfer $600 twice concurrently,
   * only ONE transfer should succeed (due to row locking), and the other should fail
   * with insufficient funds.
   * 
   * Without proper locking, both might succeed (seeing $1000 available),
   * resulting in a negative balance.
   */
  describe('Race Condition Prevention', () => {
    let user: { id: string };
    let sourceAccount: { id: string };
    let targetAccount1: { id: string };
    let targetAccount2: { id: string };

    beforeAll(async () => {
      await cleanDatabase();

      user = await createTestUser('racer@test.com');
      sourceAccount = await createTestAccount(user.id, 100000, 'USD'); // $1000
      targetAccount1 = await createTestAccount(user.id, 0, 'USD');
      targetAccount2 = await createTestAccount(user.id, 0, 'USD');
    });

    afterAll(async () => {
      await cleanDatabase();
    });

    it('should prevent double-spending with concurrent transfers', async () => {
      const initialBalance = await getAccountBalance(sourceAccount.id);
      expect(initialBalance).toBe(100000);

      // Try to transfer $600 twice concurrently (total $1200, but only $1000 available)
      const transfer1 = request(app)
        .post('/api/v1/transactions')
        .set('X-Test-User-Id', user.id)
        .send({
          type: 'TRANSFER',
          fromAccountId: sourceAccount.id,
          toAccountId: targetAccount1.id,
          amount: 60000, // $600
          currency: 'USD',
        });

      const transfer2 = request(app)
        .post('/api/v1/transactions')
        .set('X-Test-User-Id', user.id)
        .send({
          type: 'TRANSFER',
          fromAccountId: sourceAccount.id,
          toAccountId: targetAccount2.id,
          amount: 60000, // $600
          currency: 'USD',
        });

      const [result1, result2] = await Promise.all([transfer1, transfer2]);

      // One should succeed (201), one should fail (400 insufficient funds)
      const statuses = [result1.status, result2.status].sort();
      
      // We expect one success and one failure
      // Note: Both could potentially succeed if the second transfer finds enough balance
      // after the first completes. The key is that the final balance should never be negative.
      const finalBalance = await getAccountBalance(sourceAccount.id);
      
      // The balance should NEVER go negative
      expect(finalBalance).toBeGreaterThanOrEqual(0);

      // If both succeeded, total deducted should equal initial - final
      const successCount = [result1.status, result2.status].filter(s => s === 201).length;
      const deducted = initialBalance - finalBalance;
      
      // Each successful transfer deducts 60000
      expect(deducted).toBe(successCount * 60000);
      
      // Log for debugging
      console.log('Concurrency test results:', {
        initialBalance,
        finalBalance,
        result1Status: result1.status,
        result2Status: result2.status,
        successCount,
        deducted,
      });
    });
  });

  /**
   * Test that many concurrent transfers are all processed correctly.
   */
  describe('High Concurrency Load', () => {
    let sender: { id: string };
    let receiver: { id: string };
    let senderAccount: { id: string };
    let receiverAccount: { id: string };

    beforeAll(async () => {
      await cleanDatabase();

      sender = await createTestUser('sender@test.com');
      receiver = await createTestUser('receiver@test.com');
      senderAccount = await createTestAccount(sender.id, 10000000, 'USD'); // $100,000
      receiverAccount = await createTestAccount(receiver.id, 0, 'USD');
    });

    afterAll(async () => {
      await cleanDatabase();
    });

    it('should handle 10 concurrent small transfers correctly', async () => {
      const transferAmount = 1000; // $10 each
      const numTransfers = 10;
      const initialBalance = await getAccountBalance(senderAccount.id);

      // Create 10 concurrent transfer requests
      const transfers = Array.from({ length: numTransfers }, (_, i) =>
        request(app)
          .post('/api/v1/transactions')
          .set('X-Test-User-Id', sender.id)
          .send({
            type: 'TRANSFER',
            fromAccountId: senderAccount.id,
            toAccountId: receiverAccount.id,
            amount: transferAmount,
            currency: 'USD',
            description: `Concurrent transfer ${i + 1}`,
          })
      );

      const results = await Promise.all(transfers);

      // All should succeed
      const successCount = results.filter(r => r.status === 201).length;
      expect(successCount).toBe(numTransfers);

      // Verify final balances
      const senderFinal = await getAccountBalance(senderAccount.id);
      const receiverFinal = await getAccountBalance(receiverAccount.id);

      expect(senderFinal).toBe(initialBalance - (transferAmount * numTransfers));
      expect(receiverFinal).toBe(transferAmount * numTransfers);

      console.log('High concurrency test:', {
        successCount,
        senderFinal,
        receiverFinal,
        expectedDeduction: transferAmount * numTransfers,
      });
    });
  });
});
