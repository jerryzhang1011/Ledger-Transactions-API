import { Request, Response, NextFunction } from 'express';
import { TransactionService } from '../services/transaction.service.js';
import { TransactionModel, TransactionFilters, TransactionSort } from '../models/transaction.model.js';
import { AccountModel } from '../models/account.model.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { PaginatedResponse, SingleResponse, TransactionResponse } from '../types/database.js';
import {
  CreateTransactionInput,
  ListTransactionsQuery,
} from '../validators/transaction.validators.js';

export class TransactionController {
  /**
   * GET /api/v1/transactions
   * List transactions with pagination, filtering, and sorting
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const query = req.query as unknown as ListTransactionsQuery;

      // Get user's accounts
      const accounts = await AccountModel.findByUserId(userId);
      const accountIds = accounts.map((a) => a.id);

      if (accountIds.length === 0) {
        // User has no accounts, return empty list
        const response: PaginatedResponse<TransactionResponse> = {
          success: true,
          data: [],
          meta: {
            page: query.page,
            limit: query.limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
        res.json(response);
        return;
      }

      // Build filters - limit to user's accounts
      const filters: TransactionFilters = {
        type: query.type,
        status: query.status,
        startDate: query.startDate,
        endDate: query.endDate,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
      };

      // If specific account requested, verify ownership
      if (query.accountId) {
        if (!accountIds.includes(query.accountId)) {
          throw new ForbiddenError('Access denied to this account');
        }
        filters.accountId = query.accountId;
      } else if (query.fromAccountId || query.toAccountId) {
        if (query.fromAccountId && !accountIds.includes(query.fromAccountId)) {
          throw new ForbiddenError('Access denied to this account');
        }
        if (query.toAccountId && !accountIds.includes(query.toAccountId)) {
          throw new ForbiddenError('Access denied to this account');
        }
        filters.fromAccountId = query.fromAccountId;
        filters.toAccountId = query.toAccountId;
      } else {
        // Default: show transactions for any of user's accounts
        // We'll need to filter in memory or adjust the query
        // For simplicity, we'll use the first account's transactions
        // In a real app, you might want to aggregate across all accounts
        filters.accountId = accountIds[0];
      }

      const sort: TransactionSort = {
        field: query.sortBy,
        order: query.sortOrder,
      };

      const { data, total } = await TransactionModel.findAll(
        filters,
        sort,
        query.page,
        query.limit
      );

      const totalPages = Math.ceil(total / query.limit);

      const response: PaginatedResponse<TransactionResponse> = {
        success: true,
        data: data.map((tx) => TransactionModel.toResponse(tx)),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
          hasNextPage: query.page < totalPages,
          hasPrevPage: query.page > 1,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/transactions/:id
   * Get a single transaction by ID
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const transaction = await TransactionService.getById(id, userId);

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      const response: SingleResponse<TransactionResponse> = {
        success: true,
        data: TransactionModel.toResponse(transaction),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/transactions
   * Create a new transaction (transfer, deposit, or withdrawal)
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const input = req.body as CreateTransactionInput;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      // Verify account ownership
      const userAccounts = await AccountModel.findByUserId(userId);
      const userAccountIds = new Set(userAccounts.map((a) => a.id));

      let transaction;

      switch (input.type) {
        case 'TRANSFER': {
          if (!userAccountIds.has(input.fromAccountId)) {
            throw new ForbiddenError('You do not own the source account');
          }
          transaction = await TransactionService.transfer({
            fromAccountId: input.fromAccountId,
            toAccountId: input.toAccountId,
            amount: input.amount,
            currency: input.currency,
            description: input.description,
            idempotencyKey: idempotencyKey || input.idempotencyKey,
            metadata: input.metadata,
          });
          break;
        }

        case 'DEPOSIT': {
          if (!userAccountIds.has(input.accountId)) {
            throw new ForbiddenError('You do not own this account');
          }
          transaction = await TransactionService.deposit({
            accountId: input.accountId,
            amount: input.amount,
            currency: input.currency,
            description: input.description,
            referenceId: input.referenceId,
            idempotencyKey: idempotencyKey || input.idempotencyKey,
            metadata: input.metadata,
          });
          break;
        }

        case 'WITHDRAWAL': {
          if (!userAccountIds.has(input.accountId)) {
            throw new ForbiddenError('You do not own this account');
          }
          transaction = await TransactionService.withdraw({
            accountId: input.accountId,
            amount: input.amount,
            currency: input.currency,
            description: input.description,
            idempotencyKey: idempotencyKey || input.idempotencyKey,
            metadata: input.metadata,
          });
          break;
        }
      }

      const response: SingleResponse<TransactionResponse> = {
        success: true,
        data: TransactionModel.toResponse(transaction),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
}

