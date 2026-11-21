import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import type { PrismaClient } from '../../lib/prisma';
import { requireRole } from '../../middlewares/require-role';
import { validate } from '../../middlewares/validate';
import { createUsersController } from './users.controller';
import { createUsersRepository } from './users.repository';
import { createUsersInputs } from './users.schemas';
import { createUsersService } from './users.service';

export interface UsersRouterDependencies {
  config: Config;
  prisma: PrismaClient;
  authenticate: RequestHandler;
  optionalAuth: RequestHandler;
}

function createUsersModule({ config, prisma }: Pick<UsersRouterDependencies, 'config' | 'prisma'>) {
  const inputs = createUsersInputs(config.pagination);
  const controller = createUsersController(
    createUsersService(createUsersRepository(prisma)),
    inputs,
  );
  return { inputs, controller };
}

/** /api/users: public profiles, search and the signed-in user's own profile. */
export function createUsersRouter(deps: UsersRouterDependencies): Router {
  const { inputs, controller } = createUsersModule(deps);

  const router = Router();
  // Fixed paths go before /:username so they are not read as usernames.
  router.get('/search', validate(inputs.search), controller.search);
  router.patch('/me', deps.authenticate, validate(inputs.updateMe), controller.updateMe);
  router.get('/:username', deps.optionalAuth, validate(inputs.profile), controller.getProfile);
  return router;
}

/** /api/admin/users: user management for ADMINs. */
export function createAdminUsersRouter(
  deps: Omit<UsersRouterDependencies, 'optionalAuth'>,
): Router {
  const { inputs, controller } = createUsersModule(deps);

  const router = Router();
  router.use(deps.authenticate, requireRole('ADMIN'));
  router.get('/', validate(inputs.adminList), controller.adminList);
  router.patch('/:id/status', validate(inputs.adminStatus), controller.adminSetStatus);
  router.patch('/:id/role', validate(inputs.adminRole), controller.adminSetRole);
  return router;
}
