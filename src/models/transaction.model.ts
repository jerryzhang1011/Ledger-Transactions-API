import { Knex } from 'knex';
import { db } from '../database/connection.js';
import {
  Transaction,
  TransactionResponse,
  TransactionType,
  TransactionStatus,
  Currency,
} from '../types/database.js';
import { AccountModel } from './account.model.js';

export interface CreateTransactionData {
  type: TransactionType;
  amount: number;
  currency: Currency;
  fromAccountId?: string;
  toAccountId?: string;
  description?: string;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  fromAccountId?: string;
  toAccountId?: string;
  accountId?: string; // Either from or to
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface TransactionSort {
  field: 'created_at' | 'amount' | 'type';
  order: 'asc' | 'desc';
}

export class TransactionModel {
  private static tableName = 'transactions';

  static async findById(id: string): Promise<Transaction | null> {
    const transaction = await db<Transaction>(this.tableName).where({ id }).first();
    return transaction || null;
  }

  static async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const transaction = await db<Transaction>(this.tableName)
      .where({ idempotency_key: key })
      .first();
    return transaction || null;
  }

  static async findAll(
    filters: TransactionFilters = {},
    sort: TransactionSort = { field: 'created_at', order: 'desc' },
    page = 1,
    limit = 20
  ): Promise<{ data: Transaction[]; total: number }> {
    const query = db<Transaction>(this.tableName);

    // Apply filters
    if (filters.type) {
      query.where('type', filters.type);
    }
    if (filters.status) {
      query.where('status', filters.status);
    }
    if (filters.fromAccountId) {
      query.where('from_account_id', filters.fromAccountId);
    }
    if (filters.toAccountId) {
      query.where('to_account_id', filters.toAccountId);
    }
    if (filters.accountId) {
      query.where((builder) => {
        builder.where('from_account_id', filters.accountId).orWhere('to_account_id', filters.accountId);
      });
    }
    if (filters.startDate) {
      query.where('created_at', '>=', filters.startDate);
    }
    if (filters.endDate) {
      query.where('created_at', '<=', filters.endDate);
    }
    if (filters.minAmount !== undefined) {
      query.where('amount', '>=', filters.minAmount);
    }
    if (filters.maxAmount !== undefined) {
      query.where('amount', '<=', filters.maxAmount);
    }

    // Get total count
    const countQuery = query.clone();
    const [{ count }] = await countQuery.count('* as count');
    const total = Number(count);

    // Apply sorting and pagination
    const offset = (page - 1) * limit;
    const data = await query
      .orderBy(sort.field, sort.order)
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  static async create(data: CreateTransactionData, trx?: Knex.Transaction): Promise<Transaction> {
    const query = (trx || db)<Transaction>(this.tableName);

    const [transaction] = await query
      .insert({
        type: data.type,
        status: 'PENDING',
        amount: data.amount,
        currency: data.currency,
        from_account_id: data.fromAccountId || null,
        to_account_id: data.toAccountId || null,
        description: data.description || null,
        reference_id: data.referenceId || null,
        idempotency_key: data.idempotencyKey || null,
        metadata: data.metadata || {},
      })
      .returning('*');

    return transaction;
  }

  static async updateStatus(
    id: string,
    status: TransactionStatus,
    trx?: Knex.Transaction
  ): Promise<Transaction | null> {
    const query = (trx || db)<Transaction>(this.tableName);

    const updateData: Partial<Transaction> = {
      status,
      updated_at: new Date(),
    };

    if (status === 'COMPLETED') {
      updateData.completed_at = new Date();
    }

    const [transaction] = await query.where({ id }).update(updateData).returning('*');

    return transaction || null;
  }

  static formatAmount(amountCents: string | number, currency: Currency): string {
    const amount = Number(amountCents) / 100;
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    });
    return formatter.format(amount);
  }

  static toResponse(transaction: Transaction): TransactionResponse {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: Number(transaction.amount),
      amountFormatted: this.formatAmount(transaction.amount, transaction.currency),
      currency: transaction.currency,
      fromAccountId: transaction.from_account_id,
      toAccountId: transaction.to_account_id,
      description: transaction.description,
      referenceId: transaction.reference_id,
      metadata: transaction.metadata,
      createdAt: transaction.created_at.toISOString(),
      completedAt: transaction.completed_at?.toISOString() || null,
    };
  }
}

