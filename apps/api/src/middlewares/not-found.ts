import type { RequestHandler } from 'express';
import { AppError } from '../lib/app-error';

/** Last route handler: nothing matched the request. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404));
};
