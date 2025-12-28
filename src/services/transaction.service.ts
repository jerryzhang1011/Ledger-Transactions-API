import { db } from '../database/connection.js';
import { TransactionModel, CreateTransactionData } from '../models/transaction.model.js';
import { AccountModel } from '../models/account.model.js';
import { Transaction, TransactionStatus, Currency } from '../types/database.js';
import {
  InsufficientFundsError,
  DuplicateTransactionError,
  AccountNotFoundError,
  BadRequestError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number; // in cents
  currency: Currency;
  description?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface DepositRequest {
  accountId: string;
  amount: number; // in cents
  currency: Currency;
  description?: string;
  idempotencyKey?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface WithdrawalRequest {
  accountId: string;
  amount: number; // in cents
  currency: Currency;
  description?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export class TransactionService {
  /**
   * Execute a transfer between two accounts with ACID guarantees.
   *
   * Key implementation details:
   * 1. Uses database transaction for atomicity
   * 2. SELECT FOR UPDATE locks rows to prevent race conditions
   * 3. Idempotency key prevents duplicate transactions on retries
   * 4. All amounts stored in cents (integers) to avoid floating point issues
   */
  static async transfer(request: TransferRequest): Promise<Transaction> {
    const {
      fromAccountId,
      toAccountId,
      amount,
      currency,
      description,
      idempotencyKey,
      metadata,
    } = request;

    // Validate inputs
    if (amount <= 0) {
      throw new BadRequestError('Amount must be positive');
    }

    if (fromAccountId === toAccountId) {
      throw new BadRequestError('Cannot transfer to the same account');
    }

    // Check for idempotency
    if (idempotencyKey) {
      const existingTransaction = await TransactionModel.findByIdempotencyKey(idempotencyKey);
      if (existingTransaction) {
        logger.info({ idempotencyKey }, 'Duplicate transaction detected, returning existing');
        return existingTransaction;
      }
    }

    return db.transaction(async (trx) => {
      // Lock both accounts in a consistent order to prevent deadlocks
      // Always lock the account with the smaller ID first
      const [firstId, secondId] =
        fromAccountId < toAccountId
          ? [fromAccountId, toAccountId]
          : [toAccountId, fromAccountId];

      const firstAccount = await AccountModel.findByIdForUpdate(firstId, trx);
      const secondAccount = await AccountModel.findByIdForUpdate(secondId, trx);

      const fromAccount = fromAccountId === firstId ? firstAccount : secondAccount;
      const toAccount = toAccountId === firstId ? firstAccount : secondAccount;

      if (!fromAccount) {
        throw new AccountNotFoundError(fromAccountId);
      }

      if (!toAccount) {
        throw new AccountNotFoundError(toAccountId);
      }

      // Verify currency match
      if (fromAccount.currency !== currency || toAccount.currency !== currency) {
        throw new BadRequestError('Currency mismatch between accounts and transaction');
      }

      // Check balance
      const fromBalance = BigInt(fromAccount.balance);
      if (fromBalance < BigInt(amount)) {
        throw new InsufficientFundsError(
          `Insufficient funds. Available: ${fromBalance.toString()}, Required: ${amount}`
        );
      }

      // Create transaction record
      const transaction = await TransactionModel.create(
        {
          type: 'TRANSFER',
          amount,
          currency,
          fromAccountId,
          toAccountId,
          description,
          idempotencyKey,
          metadata,
        },
        trx
      );

      // Update balances atomically
      const updatedFrom = await AccountModel.updateBalance(fromAccountId, -amount, trx);
      const updatedTo = await AccountModel.updateBalance(toAccountId, amount, trx);

      if (!updatedFrom || !updatedTo) {
        // This should not happen due to our checks, but handle it
        throw new InsufficientFundsError('Balance update failed');
      }

      // Mark transaction as completed
      const completedTransaction = await TransactionModel.updateStatus(
        transaction.id,
        'COMPLETED',
        trx
      );

      logger.info(
        {
          transactionId: transaction.id,
          fromAccountId,
          toAccountId,
          amount,
        },
        'Transfer completed successfully'
      );

      return completedTransaction!;
    });
  }

  /**
   * Deposit funds into an account.
   */
  static async deposit(request: DepositRequest): Promise<Transaction> {
    const { accountId, amount, currency, description, idempotencyKey, referenceId, metadata } =
      request;

    if (amount <= 0) {
      throw new BadRequestError('Amount must be positive');
    }

    // Check for idempotency
    if (idempotencyKey) {
      const existingTransaction = await TransactionModel.findByIdempotencyKey(idempotencyKey);
      if (existingTransaction) {
        logger.info({ idempotencyKey }, 'Duplicate deposit detected, returning existing');
        return existingTransaction;
      }
    }

    return db.transaction(async (trx) => {
      // Lock the account
      const account = await AccountModel.findByIdForUpdate(accountId, trx);

      if (!account) {
        throw new AccountNotFoundError(accountId);
      }

      if (account.currency !== currency) {
        throw new BadRequestError('Currency mismatch');
      }

      // Create transaction record
      const transaction = await TransactionModel.create(
        {
          type: 'DEPOSIT',
          amount,
          currency,
          toAccountId: accountId,
          description,
          idempotencyKey,
          referenceId,
          metadata,
        },
        trx
      );

      // Update balance
      const updated = await AccountModel.updateBalance(accountId, amount, trx);

      if (!updated) {
        throw new BadRequestError('Failed to update account balance');
      }

      // Mark as completed
      const completedTransaction = await TransactionModel.updateStatus(
        transaction.id,
        'COMPLETED',
        trx
      );

      logger.info(
        { transactionId: transaction.id, accountId, amount },
        'Deposit completed successfully'
      );

      return completedTransaction!;
    });
  }

  /**
   * Withdraw funds from an account.
   */
  static async withdraw(request: WithdrawalRequest): Promise<Transaction> {
    const { accountId, amount, currency, description, idempotencyKey, metadata } = request;

    if (amount <= 0) {
      throw new BadRequestError('Amount must be positive');
    }

    // Check for idempotency
    if (idempotencyKey) {
      const existingTransaction = await TransactionModel.findByIdempotencyKey(idempotencyKey);
      if (existingTransaction) {
        logger.info({ idempotencyKey }, 'Duplicate withdrawal detected, returning existing');
        return existingTransaction;
      }
    }

    return db.transaction(async (trx) => {
      // Lock the account
      const account = await AccountModel.findByIdForUpdate(accountId, trx);

      if (!account) {
        throw new AccountNotFoundError(accountId);
      }

      if (account.currency !== currency) {
        throw new BadRequestError('Currency mismatch');
      }

      // Check balance
      const balance = BigInt(account.balance);
      if (balance < BigInt(amount)) {
        throw new InsufficientFundsError(
          `Insufficient funds. Available: ${balance.toString()}, Required: ${amount}`
        );
      }

      // Create transaction record
      const transaction = await TransactionModel.create(
        {
          type: 'WITHDRAWAL',
          amount,
          currency,
          fromAccountId: accountId,
          description,
          idempotencyKey,
          metadata,
        },
        trx
      );

      // Update balance
      const updated = await AccountModel.updateBalance(accountId, -amount, trx);

      if (!updated) {
        throw new InsufficientFundsError('Balance update failed');
      }

      // Mark as completed
      const completedTransaction = await TransactionModel.updateStatus(
        transaction.id,
        'COMPLETED',
        trx
      );

      logger.info(
        { transactionId: transaction.id, accountId, amount },
        'Withdrawal completed successfully'
      );

      return completedTransaction!;
    });
  }

  /**
   * Get transaction by ID with authorization check.
   */
  static async getById(
    transactionId: string,
    userId: string
  ): Promise<Transaction | null> {
    const transaction = await TransactionModel.findById(transactionId);

    if (!transaction) {
      return null;
    }

    // Verify user owns one of the accounts
    const accounts = await AccountModel.findByUserId(userId);
    const accountIds = new Set(accounts.map((a) => a.id));

    const hasAccess =
      (transaction.from_account_id && accountIds.has(transaction.from_account_id)) ||
      (transaction.to_account_id && accountIds.has(transaction.to_account_id));

    if (!hasAccess) {
      return null;
    }

    return transaction;
  }
}

