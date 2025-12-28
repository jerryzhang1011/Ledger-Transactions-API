import { db } from '../../database/connection';
import { Currency } from '../../types/database';

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export interface TestAccount {
  id: string;
  userId: string;
  balance: number;
  currency: Currency;
}

/**
 * Clean all test data from the database
 */
export const cleanDatabase = async (): Promise<void> => {
  await db('transactions').del();
  await db('accounts').del();
  await db('users').del();
};

/**
 * Create a test user
 */
export const createTestUser = async (email: string, name = 'Test User'): Promise<TestUser> => {
  const [user] = await db('users')
    .insert({
      email,
      name,
      provider: 'test',
      provider_id: `test-${email}`,
    })
    .returning(['id', 'email', 'name']);

  return user as TestUser;
};

/**
 * Create a test account with initial balance
 */
export const createTestAccount = async (
  userId: string,
  balance = 0,
  currency: Currency = 'USD',
  name = 'Test Account'
): Promise<TestAccount> => {
  const [account] = await db('accounts')
    .insert({
      user_id: userId,
      name,
      currency,
      balance,
    })
    .returning(['id', 'user_id as userId', 'balance', 'currency']);

  return {
    ...account,
    balance: Number(account.balance),
  } as TestAccount;
};

/**
 * Get account balance by ID
 */
export const getAccountBalance = async (accountId: string): Promise<number> => {
  const account = await db('accounts').where({ id: accountId }).first();
  return Number(account?.balance ?? 0);
};

/**
 * Get transaction count for an account
 */
export const getTransactionCount = async (accountId: string): Promise<number> => {
  const [result] = await db('transactions')
    .where('from_account_id', accountId)
    .orWhere('to_account_id', accountId)
    .count('* as count');

  return Number(result.count);
};
