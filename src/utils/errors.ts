export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable Entity', code = 'UNPROCESSABLE_ENTITY') {
    super(message, 422, code);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests', code = 'TOO_MANY_REQUESTS') {
    super(message, 429, code);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', code = 'INTERNAL_SERVER_ERROR') {
    super(message, 500, code, false);
  }
}

// Business logic errors
export class InsufficientFundsError extends AppError {
  constructor(message = 'Insufficient funds') {
    super(message, 400, 'INSUFFICIENT_FUNDS');
  }
}

export class DuplicateTransactionError extends AppError {
  constructor(message = 'Duplicate transaction detected') {
    super(message, 409, 'DUPLICATE_TRANSACTION');
  }
}

export class AccountNotFoundError extends AppError {
  constructor(accountId: string) {
    super(`Account ${accountId} not found`, 404, 'ACCOUNT_NOT_FOUND');
  }
}

