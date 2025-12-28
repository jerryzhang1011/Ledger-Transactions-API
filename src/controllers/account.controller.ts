import { Request, Response, NextFunction } from 'express';
import { AccountModel } from '../models/account.model.js';
import { db } from '../database/connection.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { SingleResponse, AccountResponse } from '../types/database.js';
import { CreateAccountInput, UpdateAccountInput } from '../validators/account.validators.js';

export class AccountController {
  /**
   * GET /api/v1/accounts
   * List all accounts for the authenticated user
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const accounts = await AccountModel.findByUserId(userId);

      res.json({
        success: true,
        data: accounts.map((account) => AccountModel.toResponse(account)),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/accounts/:accountId
   * Get a single account by ID
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const userId = req.user!.id;

      const account = await AccountModel.findById(accountId);

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      if (account.user_id !== userId) {
        throw new ForbiddenError('Access denied');
      }

      const response: SingleResponse<AccountResponse> = {
        success: true,
        data: AccountModel.toResponse(account),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/accounts
   * Create a new account for the authenticated user
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const input = req.body as CreateAccountInput;

      const account = await AccountModel.create({
        userId,
        name: input.name,
        currency: input.currency,
      });

      const response: SingleResponse<AccountResponse> = {
        success: true,
        data: AccountModel.toResponse(account),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/accounts/:accountId
   * Update account name
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const userId = req.user!.id;
      const input = req.body as UpdateAccountInput;

      const account = await AccountModel.findById(accountId);

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      if (account.user_id !== userId) {
        throw new ForbiddenError('Access denied');
      }

      // Update account (simplified - only name can be updated)
      const [updated] = await db('accounts')
        .where({ id: accountId })
        .update({
          name: input.name ?? account.name,
          updated_at: new Date(),
        })
        .returning('*');

      const response: SingleResponse<AccountResponse> = {
        success: true,
        data: AccountModel.toResponse(updated),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/accounts/:accountId
   * Deactivate an account (soft delete)
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId } = req.params;
      const userId = req.user!.id;

      const account = await AccountModel.findById(accountId);

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      if (account.user_id !== userId) {
        throw new ForbiddenError('Access denied');
      }

      // Check if account has balance
      if (BigInt(account.balance) > 0) {
        throw new ForbiddenError('Cannot delete account with positive balance');
      }

      await AccountModel.deactivate(accountId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

