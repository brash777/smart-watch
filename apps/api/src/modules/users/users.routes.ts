import { type RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import type { Config } from '../../config/env';
import type { ImageProcessor } from '../../lib/images/image-processor';
import type { PrismaClient } from '../../lib/prisma';
import type { StorageProvider } from '../../lib/storage';
import { requireRole } from '../../middlewares/require-role';
import type { ImageUpload } from '../../middlewares/upload';
import { validate } from '../../middlewares/validate';
import type { AvatarUrlResolver } from './avatars';
import { createUsersController } from './users.controller';
import { createUsersRepository } from './users.repository';
import { createUsersInputs } from './users.schemas';
import { createUsersService } from './users.service';

export interface UsersModuleDependencies {
  config: Config;
  prisma: PrismaClient;
  logger: Logger;
  storage: StorageProvider;
  images: ImageProcessor;
  avatarUrl: AvatarUrlResolver;
  authenticate: RequestHandler;
}

export interface UsersRouterDependencies extends UsersModuleDependencies {
  optionalAuth: RequestHandler;
  upload: ImageUpload;
}

function createUsersModule(deps: UsersModuleDependencies) {
  const inputs = createUsersInputs(deps.config.pagination);
  const controller = createUsersController(
    createUsersService({
      repository: createUsersRepository(deps.prisma),
      avatarUrl: deps.avatarUrl,
      storage: deps.storage,
      images: deps.images,
      logger: deps.logger,
    }),
    inputs,
  );
  return { inputs, controller };
}

/** /api/users: public profiles, search and the signed-in user's own profile and photo. */
export function createUsersRouter(deps: UsersRouterDependencies): Router {
  const { inputs, controller } = createUsersModule(deps);

  const router = Router();
  // Fixed paths go before /:username so they are not read as usernames.
  router.get('/search', validate(inputs.search), controller.search);
  router.patch('/me', deps.authenticate, validate(inputs.updateMe), controller.updateMe);
  router.patch(
    '/me/avatar',
    deps.authenticate,
    deps.upload.file('avatar'),
    controller.updateAvatar,
  );
  router.get('/:username', deps.optionalAuth, validate(inputs.profile), controller.getProfile);
  return router;
}

/** /api/admin/users: user management for ADMINs. */
export function createAdminUsersRouter(deps: UsersModuleDependencies): Router {
  const { inputs, controller } = createUsersModule(deps);

  const router = Router();
  router.use(deps.authenticate, requireRole('ADMIN'));
  router.get('/', validate(inputs.adminList), controller.adminList);
  router.patch('/:id/status', validate(inputs.adminStatus), controller.adminSetStatus);
  router.patch('/:id/role', validate(inputs.adminRole), controller.adminSetRole);
  return router;
}
