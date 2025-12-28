import express, { Express } from 'express';
import { requestIdMiddleware } from '../../middlewares/requestId';
import { errorHandler, notFoundHandler } from '../../middlewares/errorHandler';
import transactionRoutes from '../../routes/transaction.routes';
import accountRoutes from '../../routes/account.routes';

/**
 * Create a test app without session/passport for simpler testing.
 * Uses a mock auth middleware that injects user from header.
 */
export const createTestApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.use(requestIdMiddleware);

  // Mock authentication for testing
  app.use((req, _res, next) => {
    const userId = req.headers['x-test-user-id'] as string;
    if (userId) {
      req.user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      };
      req.isAuthenticated = () => true;
    } else {
      req.isAuthenticated = () => false;
    }
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy' });
  });

  // Routes
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/accounts', accountRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
