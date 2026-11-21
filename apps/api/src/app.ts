import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Config } from './config/env';
import { createErrorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';
import { createRateLimiter } from './middlewares/rate-limit';
import { requestId } from './middlewares/request-id';
import { createHealthRouter } from './modules/health/health.routes';

export interface AppDependencies {
  config: Config;
  logger: Logger;
}

/** Builds the Express application without listening, so tests can use it directly. */
export function createApp({ config, logger }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (_req, res, error) => {
        if (error !== undefined || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: config.http.corsOrigins, credentials: true }));
  app.use(createRateLimiter({ windowMs: config.rateLimit.windowMs, limit: config.rateLimit.max }));
  app.use(express.json({ limit: config.http.jsonBodyLimit }));

  const api = express.Router();
  api.use('/health', createHealthRouter(config));
  app.use('/api', api);

  app.use(notFound);
  app.use(createErrorHandler({ isProduction: config.isProduction }));

  return app;
}
