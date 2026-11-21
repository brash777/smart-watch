import { Router } from 'express';
import type { Config } from '../../config/env';
import type { PrismaClient } from '../../lib/prisma';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { createAuthController } from './auth.controller';
import { createAuthRepository } from './auth.repository';
import { loginInput, registerInput } from './auth.schemas';
import { createAuthService } from './auth.service';
import type { TokenService } from './auth.tokens';

export interface AuthRouterDependencies {
  config: Config;
  prisma: PrismaClient;
  tokens: TokenService;
}

/** /api/auth: register, login, refresh and logout. */
export function createAuthRouter({ config, prisma, tokens }: AuthRouterDependencies): Router {
  const service = createAuthService({
    repository: createAuthRepository(prisma),
    tokens,
    bcryptRounds: config.auth.bcryptRounds,
  });
  const controller = createAuthController(service, { secureCookies: config.isProduction });
  // Stricter limit for the routes that guess passwords or create accounts (AUTH_RATE_LIMIT_MAX).
  const authRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.authMax,
  });

  const router = Router();
  router.post('/register', authRateLimiter, validate(registerInput), controller.register);
  router.post('/login', authRateLimiter, validate(loginInput), controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  return router;
}
