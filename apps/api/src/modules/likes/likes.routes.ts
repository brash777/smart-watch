import { type RequestHandler, Router } from 'express';
import { validate } from '../../middlewares/validate';
import { createLikesController } from './likes.controller';
import { likesInputs } from './likes.schemas';
import type { LikesService } from './likes.service';

export interface LikesRouterDependencies {
  service: LikesService;
  authenticate: RequestHandler;
}

/** Mounted on /api/posts: like a Post, or take the like back. */
export function createLikesRouter({ service, authenticate }: LikesRouterDependencies): Router {
  const controller = createLikesController(service);
  const router = Router();
  router.post('/:id/like', authenticate, validate(likesInputs.toggle), controller.toggle);
  return router;
}
