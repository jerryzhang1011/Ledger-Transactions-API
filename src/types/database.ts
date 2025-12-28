// Database table types

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CNY' | 'JPY';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string;
  provider_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  currency: Currency;
  balance: string; // BIGINT comes as string from pg
  version: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string; // BIGINT comes as string from pg
  currency: Currency;
  from_account_id: string | null;
  to_account_id: string | null;
  description: string | null;
  reference_id: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

// API Response types
export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AccountResponse {
  id: string;
  userId: string;
  name: string;
  currency: Currency;
  balance: number; // Converted to cents as number
  balanceFormatted: string; // e.g., "$1,234.56"
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  amountFormatted: string;
  currency: Currency;
  fromAccountId: string | null;
  toAccountId: string | null;
  description: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

// Pagination types
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface SingleResponse<T> {
  success: true;
  data: T;
}

