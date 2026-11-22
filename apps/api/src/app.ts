import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Config } from './config/env';
import type { PrismaClient } from './lib/prisma';
import { createAuthMiddlewares } from './middlewares/authenticate';
import { createErrorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';
import { createRateLimiter } from './middlewares/rate-limit';
import { createRequireSpaceRole } from './middlewares/require-space-role';
import { requestId } from './middlewares/request-id';
import { createAuthRepository } from './modules/auth/auth.repository';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createTokenService } from './modules/auth/auth.tokens';
import { createFollowsRouter } from './modules/follows/follows.routes';
import { createHealthRouter } from './modules/health/health.routes';
import { createSettingsRepository } from './modules/settings/settings.repository';
import { createSettingsService } from './modules/settings/settings.service';
import { createSpacesRepository } from './modules/spaces/spaces.repository';
import { createSpacesRouter } from './modules/spaces/spaces.routes';
import { createAdminUsersRouter, createUsersRouter } from './modules/users/users.routes';

export interface AppDependencies {
  config: Config;
  logger: Logger;
  prisma: PrismaClient;
}

/** Builds the Express application without listening, so tests can use it directly. */
export function createApp({ config, logger, prisma }: AppDependencies): Express {
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
  app.use(cookieParser());

  const tokens = createTokenService(config.auth);
  const authRepository = createAuthRepository(prisma);
  const { authenticate, optionalAuth } = createAuthMiddlewares({
    verifyAccessToken: (token) => tokens.verifyAccessToken(token),
    findUser: (id) => authRepository.findSessionUser(id),
  });
  const settings = createSettingsService(createSettingsRepository(prisma));
  const spacesRepository = createSpacesRepository(prisma);
  const requireSpaceRole = createRequireSpaceRole((spaceId, userId) =>
    spacesRepository.findAccess(spaceId, userId),
  );

  const api = express.Router();
  api.use('/health', createHealthRouter(config));
  api.use('/auth', createAuthRouter({ config, prisma, tokens, authenticate }));
  api.use('/users', createUsersRouter({ config, prisma, authenticate, optionalAuth }));
  api.use('/users', createFollowsRouter({ config, prisma, authenticate }));
  api.use('/admin/users', createAdminUsersRouter({ config, prisma, authenticate }));
  api.use(
    '/spaces',
    createSpacesRouter({
      config,
      repository: spacesRepository,
      settings,
      authenticate,
      optionalAuth,
      requireSpaceRole,
    }),
  );
  app.use('/api', api);

  app.use(notFound);
  app.use(createErrorHandler({ isProduction: config.isProduction }));

  return app;
}
