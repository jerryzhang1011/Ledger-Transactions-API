import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    throw new UnauthorizedError('Authentication required');
  }
  next();
};

export const requireAccountOwnership =
  (accountIdParam: string = 'accountId') =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const accountId = req.params[accountIdParam];
    if (!accountId) {
      return next();
    }

    // Import here to avoid circular dependency
    const { AccountModel } = await import('../models/account.model.js');
    const account = await AccountModel.findById(accountId);

    if (!account) {
      throw new ForbiddenError('Account not found or access denied');
    }

    if (account.user_id !== req.user.id) {
      throw new ForbiddenError('You do not have access to this account');
    }

    next();
  };

// For development/testing without Google OAuth
export const devAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'production') {
    // Check for X-Dev-User-Id header for testing
    const devUserId = req.headers['x-dev-user-id'] as string | undefined;
    if (devUserId) {
      req.user = {
        id: devUserId,
        email: 'dev@example.com',
        name: 'Dev User',
      };
      // Override isAuthenticated for dev mode
      req.isAuthenticated = () => true;
    }
  }
  next();
};

