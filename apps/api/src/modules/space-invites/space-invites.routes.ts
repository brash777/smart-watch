import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import type { PrismaClient } from '../../lib/prisma';
import { createRateLimiter } from '../../middlewares/rate-limit';
import type { RequireSpaceRole } from '../../middlewares/require-space-role';
import { validate } from '../../middlewares/validate';
import type { SettingsService } from '../settings/settings.service';
import type { SpacesRepository } from '../spaces/spaces.repository';
import type { AvatarUrlResolver } from '../users/avatars';
import { createSpaceInvitesController } from './space-invites.controller';
import { createSpaceInvitesRepository } from './space-invites.repository';
import { createInviteInput, joinSpaceInput, revokeInviteInput } from './space-invites.schemas';
import { createSpaceInvitesService } from './space-invites.service';

export interface SpaceInvitesRouterDependencies {
  config: Config;
  prisma: PrismaClient;
  spaces: SpacesRepository;
  settings: SettingsService;
  authenticate: RequestHandler;
  requireSpaceRole: RequireSpaceRole;
  avatarUrl: AvatarUrlResolver;
}

/** Mounted on /api/spaces: invite codes of a Space and joining with a code. */
export function createSpaceInvitesRouter(deps: SpaceInvitesRouterDependencies): Router {
  const { authenticate, requireSpaceRole } = deps;
  const controller = createSpaceInvitesController(
    createSpaceInvitesService({
      repository: createSpaceInvitesRepository(deps.prisma),
      spaces: deps.spaces,
      settings: deps.settings,
      avatarUrl: deps.avatarUrl,
    }),
  );
  // Joining tries a secret code, so it shares the stricter AUTH_RATE_LIMIT_MAX limit.
  const joinRateLimiter = createRateLimiter({
    windowMs: deps.config.rateLimit.windowMs,
    limit: deps.config.rateLimit.authMax,
  });

  const router = Router();
  router.post('/join', authenticate, joinRateLimiter, validate(joinSpaceInput), controller.join);
  router.post(
    '/:spaceId/invites',
    authenticate,
    requireSpaceRole('OWNER'),
    validate(createInviteInput),
    controller.create,
  );
  router.get('/:spaceId/invites', authenticate, requireSpaceRole('OWNER'), controller.list);
  router.delete(
    '/:spaceId/invites/:inviteId',
    authenticate,
    requireSpaceRole('OWNER'),
    validate(revokeInviteInput),
    controller.revoke,
  );
  return router;
}
