import { z } from 'zod';

const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'CNY', 'JPY']);

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100).default('Default Account'),
  currency: currencySchema.default('USD'),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const accountIdParamSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

