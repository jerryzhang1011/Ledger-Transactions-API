import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.id;

  // Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      requestId,
    };

    logger.warn({ err, requestId }, 'Validation error');
    res.status(400).json(response);
    return;
  }

  // Custom application errors
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
      requestId,
    };

    if (err.isOperational) {
      logger.warn({ err, requestId }, err.message);
    } else {
      logger.error({ err, requestId }, err.message);
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Database errors
  if (err.message?.includes('duplicate key')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists',
      },
      requestId,
    };

    logger.warn({ err, requestId }, 'Duplicate key error');
    res.status(409).json(response);
    return;
  }

  // Unknown errors
  logger.error({ err, requestId }, 'Unhandled error');

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message || 'An unexpected error occurred',
    },
    requestId,
  };

  res.status(500).json(response);
};

// Handle 404 routes
export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    requestId: req.id,
  };

  res.status(404).json(response);
};

