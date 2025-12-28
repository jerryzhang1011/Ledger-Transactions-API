import { Router } from 'express';
import { AccountController } from '../controllers/account.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createAccountSchema,
  updateAccountSchema,
  accountIdParamSchema,
} from '../validators/account.validators.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/v1/accounts - List user's accounts
router.get('/', AccountController.list);

// GET /api/v1/accounts/:accountId - Get single account
router.get(
  '/:accountId',
  validate(accountIdParamSchema, 'params'),
  AccountController.getById
);

// POST /api/v1/accounts - Create new account
router.post(
  '/',
  validate(createAccountSchema, 'body'),
  AccountController.create
);

// PATCH /api/v1/accounts/:accountId - Update account
router.patch(
  '/:accountId',
  validate(accountIdParamSchema, 'params'),
  validate(updateAccountSchema, 'body'),
  AccountController.update
);

// DELETE /api/v1/accounts/:accountId - Delete (deactivate) account
router.delete(
  '/:accountId',
  validate(accountIdParamSchema, 'params'),
  AccountController.delete
);

export default router;

