import { Knex } from 'knex';
import { db } from '../database/connection.js';
import { Account, AccountResponse, Currency } from '../types/database.js';

export interface CreateAccountData {
  userId: string;
  name?: string;
  currency?: Currency;
  initialBalance?: number;
}

export class AccountModel {
  private static tableName = 'accounts';

  static async findById(id: string, trx?: Knex.Transaction): Promise<Account | null> {
    const query = (trx || db)<Account>(this.tableName).where({ id, is_active: true });
    const account = await query.first();
    return account || null;
  }

  static async findByIdForUpdate(id: string, trx: Knex.Transaction): Promise<Account | null> {
    const account = await trx<Account>(this.tableName)
      .where({ id, is_active: true })
      .forUpdate()
      .first();
    return account || null;
  }

  static async findByUserId(userId: string): Promise<Account[]> {
    return db<Account>(this.tableName).where({ user_id: userId, is_active: true }).orderBy('created_at', 'asc');
  }

  static async create(data: CreateAccountData, trx?: Knex.Transaction): Promise<Account> {
    const query = (trx || db)<Account>(this.tableName);

    const [account] = await query
      .insert({
        user_id: data.userId,
        name: data.name || 'Default Account',
        currency: data.currency || 'USD',
        balance: data.initialBalance || 0,
      })
      .returning('*');

    return account;
  }

  static async updateBalance(
    id: string,
    amount: number,
    trx: Knex.Transaction
  ): Promise<Account | null> {
    // Use raw SQL for atomic update with version check
    const result = await trx.raw<{ rows: Account[] }>(
      `
      UPDATE accounts 
      SET balance = balance + ?, version = version + 1, updated_at = NOW()
      WHERE id = ? AND is_active = true AND (balance + ?) >= 0
      RETURNING *
      `,
      [amount, id, amount]
    );

    return result.rows[0] || null;
  }

  static async deactivate(id: string): Promise<boolean> {
    const updated = await db<Account>(this.tableName)
      .where({ id })
      .update({ is_active: false, updated_at: new Date() });

    return updated > 0;
  }

  static formatBalance(balanceCents: string | number, currency: Currency): string {
    const amount = Number(balanceCents) / 100;
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    });
    return formatter.format(amount);
  }

  static toResponse(account: Account): AccountResponse {
    const balanceNumber = Number(account.balance);
    return {
      id: account.id,
      userId: account.user_id,
      name: account.name,
      currency: account.currency,
      balance: balanceNumber,
      balanceFormatted: this.formatBalance(account.balance, account.currency),
      isActive: account.is_active,
      createdAt: account.created_at.toISOString(),
      updatedAt: account.updated_at.toISOString(),
    };
  }
}

