import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import { validate } from '../../middlewares/validate';
import { createPostsController } from './posts.controller';
import { createPostsInputs } from './posts.schemas';
import type { PostsService } from './posts.service';

export interface PostsRouterDependencies {
  config: Config;
  service: PostsService;
  authenticate: RequestHandler;
  optionalAuth: RequestHandler;
}

function createPostsModule({ config, service }: PostsRouterDependencies) {
  const inputs = createPostsInputs(config.pagination);
  return { inputs, controller: createPostsController(service, inputs) };
}

/** /api/posts: publish, draft and delete Posts. */
export function createPostsRouter(deps: PostsRouterDependencies): Router {
  const { inputs, controller } = createPostsModule(deps);
  const router = Router();
  router.post('/', deps.authenticate, validate(inputs.create), controller.create);
  router.post('/draft', deps.authenticate, validate(inputs.draft), controller.draft);
  router.delete('/:id', deps.authenticate, validate(inputs.post), controller.remove);
  return router;
}

/** /api/feed: the posts of the people you follow and your own. */
export function createFeedRouter(deps: PostsRouterDependencies): Router {
  const { inputs, controller } = createPostsModule(deps);
  const router = Router();
  router.get('/', deps.authenticate, validate(inputs.feed), controller.feed);
  return router;
}

/** Mounted on /api/users: a user's portfolio. */
export function createPortfolioRouter(deps: PostsRouterDependencies): Router {
  const { inputs, controller } = createPostsModule(deps);
  const router = Router();
  router.get(
    '/:username/posts',
    deps.optionalAuth,
    validate(inputs.portfolio),
    controller.portfolio,
  );
  return router;
}

/** /api/explore: public posts by hashtag and the trending hashtags. */
export function createExploreRouter(deps: PostsRouterDependencies): Router {
  const { inputs, controller } = createPostsModule(deps);
  const router = Router();
  router.get('/', deps.optionalAuth, validate(inputs.explore), controller.explore);
  router.get('/trending', validate(inputs.trending), controller.trending);
  return router;
}
