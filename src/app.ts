import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { httpLogger } from './middlewares/httpLogger.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { rateLimiter } from './middlewares/rateLimiter.js';
import { devAuth } from './middlewares/auth.js';
import { setupSession } from './config/session.js';
import { setupPassport } from './config/passport.js';
import authRoutes from './routes/auth.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import accountRoutes from './routes/account.routes.js';

export const createApp = async (): Promise<Express> => {
  const app = express();

  // Security middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: config.env === 'production' ? process.env.FRONTEND_URL : true,
      credentials: true,
    })
  );

  // Request parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request ID for tracing
  app.use(requestIdMiddleware);

  // HTTP request logging
  app.use(httpLogger);

  // Rate limiting
  app.use(rateLimiter);

  // Session and auth
  await setupSession(app);
  setupPassport(app);

  // Dev auth header support (for testing without OAuth)
  app.use(devAuth);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API Routes
  app.use('/auth', authRoutes);
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/accounts', accountRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

