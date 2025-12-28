import { z } from 'zod';

const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'CNY', 'JPY']);
const transactionTypeSchema = z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']);
const transactionStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']);

// Create transfer request
export const createTransferSchema = z.object({
  fromAccountId: z.string().uuid('Invalid from account ID'),
  toAccountId: z.string().uuid('Invalid to account ID'),
  amount: z
    .number()
    .int('Amount must be an integer (in cents)')
    .positive('Amount must be positive')
    .max(1000000000, 'Amount exceeds maximum limit'), // $10M max
  currency: currencySchema,
  description: z.string().max(500).optional(),
  idempotencyKey: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Create deposit request
export const createDepositSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  amount: z
    .number()
    .int('Amount must be an integer (in cents)')
    .positive('Amount must be positive')
    .max(1000000000, 'Amount exceeds maximum limit'),
  currency: currencySchema,
  description: z.string().max(500).optional(),
  referenceId: z.string().max(255).optional(),
  idempotencyKey: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Create withdrawal request
export const createWithdrawalSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  amount: z
    .number()
    .int('Amount must be an integer (in cents)')
    .positive('Amount must be positive')
    .max(1000000000, 'Amount exceeds maximum limit'),
  currency: currencySchema,
  description: z.string().max(500).optional(),
  idempotencyKey: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Generic transaction creation (auto-detects type)
export const createTransactionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TRANSFER'),
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.number().int().positive().max(1000000000),
    currency: currencySchema,
    description: z.string().max(500).optional(),
    idempotencyKey: z.string().max(255).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('DEPOSIT'),
    accountId: z.string().uuid(),
    amount: z.number().int().positive().max(1000000000),
    currency: currencySchema,
    description: z.string().max(500).optional(),
    referenceId: z.string().max(255).optional(),
    idempotencyKey: z.string().max(255).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('WITHDRAWAL'),
    accountId: z.string().uuid(),
    amount: z.number().int().positive().max(1000000000),
    currency: currencySchema,
    description: z.string().max(500).optional(),
    idempotencyKey: z.string().max(255).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
]);

// Query parameters for listing transactions
export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
  accountId: z.string().uuid().optional(),
  fromAccountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minAmount: z.coerce.number().int().positive().optional(),
  maxAmount: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['created_at', 'amount', 'type']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// UUID param validation
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateDepositInput = z.infer<typeof createDepositSchema>;
export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

