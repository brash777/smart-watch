import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/app-error';

export interface RateLimitOptions {
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum requests per client in each window. */
  limit: number;
}

/** Limits requests per client; over the limit it answers 429 RATE_LIMITED. */
export function createRateLimiter({ windowMs, limit }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError('RATE_LIMITED', 'Too many requests, try again later', 429));
    },
  });
}
