import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import type { PrismaClient } from '../../lib/prisma';
import type { RequireSpaceRole } from '../../middlewares/require-space-role';
import { validate } from '../../middlewares/validate';
import type { AvatarUrlResolver } from '../users/avatars';
import { createSpaceMembersController } from './space-members.controller';
import { createSpaceMembersRepository } from './space-members.repository';
import { createSpaceMembersInputs } from './space-members.schemas';
import { createSpaceMembersService } from './space-members.service';

export interface SpaceMembersRouterDependencies {
  config: Config;
  prisma: PrismaClient;
  authenticate: RequestHandler;
  optionalAuth: RequestHandler;
  requireSpaceRole: RequireSpaceRole;
  avatarUrl: AvatarUrlResolver;
}

/** Mounted on /api/spaces: list, change and remove members, and leave a Space. */
export function createSpaceMembersRouter(deps: SpaceMembersRouterDependencies): Router {
  const { authenticate, optionalAuth, requireSpaceRole } = deps;
  const inputs = createSpaceMembersInputs(deps.config.pagination);
  const controller = createSpaceMembersController(
    createSpaceMembersService({
      repository: createSpaceMembersRepository(deps.prisma),
      avatarUrl: deps.avatarUrl,
    }),
    inputs,
  );

  const router = Router();
  router.get(
    '/:spaceId/members',
    optionalAuth,
    requireSpaceRole('VIEWER'),
    validate(inputs.list),
    controller.list,
  );
  router.patch(
    '/:spaceId/members/:userId',
    authenticate,
    requireSpaceRole('OWNER'),
    validate(inputs.changeRole),
    controller.changeRole,
  );
  router.delete(
    '/:spaceId/members/:userId',
    authenticate,
    requireSpaceRole('OWNER'),
    validate(inputs.remove),
    controller.remove,
  );
  router.post('/:spaceId/leave', authenticate, requireSpaceRole('VIEWER'), controller.leave);
  return router;
}
