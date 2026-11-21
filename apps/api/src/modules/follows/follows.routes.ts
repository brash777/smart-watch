import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import type { PrismaClient } from '../../lib/prisma';
import { validate } from '../../middlewares/validate';
import { createFollowsController } from './follows.controller';
import { createFollowsRepository } from './follows.repository';
import { createFollowsInputs } from './follows.schemas';
import { createFollowsService } from './follows.service';

export interface FollowsRouterDependencies {
  config: Config;
  prisma: PrismaClient;
  authenticate: RequestHandler;
}

/** Mounted on /api/users: follow, unfollow and the followers and following lists. */
export function createFollowsRouter({
  config,
  prisma,
  authenticate,
}: FollowsRouterDependencies): Router {
  const inputs = createFollowsInputs(config.pagination);
  const controller = createFollowsController(
    createFollowsService(createFollowsRepository(prisma)),
    inputs,
  );

  const router = Router();
  router.post('/:username/follow', authenticate, validate(inputs.target), controller.follow);
  router.delete('/:username/follow', authenticate, validate(inputs.target), controller.unfollow);
  router.get('/:username/followers', validate(inputs.list), controller.followers);
  router.get('/:username/following', validate(inputs.list), controller.following);
  return router;
}
