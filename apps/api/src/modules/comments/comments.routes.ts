import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import { validate } from '../../middlewares/validate';
import { createCommentsController } from './comments.controller';
import { createCommentsInputs } from './comments.schemas';
import type { CommentsService } from './comments.service';

export interface CommentsRouterDependencies {
  config: Config;
  service: CommentsService;
  authenticate: RequestHandler;
  optionalAuth: RequestHandler;
}

function createCommentsModule({ config, service }: CommentsRouterDependencies) {
  const inputs = createCommentsInputs(config.pagination);
  return { inputs, controller: createCommentsController(service, inputs) };
}

/** Mounted on /api/posts: the comments of a Post. */
export function createPostCommentsRouter(deps: CommentsRouterDependencies): Router {
  const { inputs, controller } = createCommentsModule(deps);
  const router = Router();
  router.post('/:id/comments', deps.authenticate, validate(inputs.create), controller.create);
  router.get('/:id/comments', deps.optionalAuth, validate(inputs.list), controller.list);
  return router;
}

/** /api/comments: delete a Comment. */
export function createCommentsRouter(deps: CommentsRouterDependencies): Router {
  const { inputs, controller } = createCommentsModule(deps);
  const router = Router();
  router.delete('/:id', deps.authenticate, validate(inputs.comment), controller.remove);
  return router;
}
