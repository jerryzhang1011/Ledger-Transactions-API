import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { transactionRateLimiter } from '../middlewares/rateLimiter.js';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  uuidParamSchema,
} from '../validators/transaction.validators.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/v1/transactions - List transactions
router.get(
  '/',
  validate(listTransactionsQuerySchema, 'query'),
  TransactionController.list
);

// GET /api/v1/transactions/:id - Get single transaction
router.get(
  '/:id',
  validate(uuidParamSchema, 'params'),
  TransactionController.getById
);

// POST /api/v1/transactions - Create transaction
router.post(
  '/',
  transactionRateLimiter,
  validate(createTransactionSchema, 'body'),
  TransactionController.create
);

export default router;

