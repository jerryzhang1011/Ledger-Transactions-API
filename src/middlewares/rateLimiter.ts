import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { TooManyRequestsError } from '../utils/errors.js';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError());
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.id || req.ip || 'anonymous';
  },
});

// Stricter rate limit for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Too many authentication attempts'));
  },
});

// Stricter rate limit for transaction endpoints
export const transactionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 transactions per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new TooManyRequestsError('Transaction rate limit exceeded'));
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip || 'anonymous';
  },
});

