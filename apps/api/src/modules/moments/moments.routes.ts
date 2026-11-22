import { type RequestHandler, Router } from 'express';
import { validate } from '../../middlewares/validate';
import { createMomentsController } from './moments.controller';
import { momentsInputs } from './moments.schemas';
import type { MomentsService } from './moments.service';

export interface MomentsRouterDependencies {
  service: MomentsService;
  authenticate: RequestHandler;
}

/** /api/moments: share a snap for a while, the Moments feed and views. */
export function createMomentsRouter({ service, authenticate }: MomentsRouterDependencies): Router {
  const controller = createMomentsController(service);
  const router = Router();
  router.post('/', authenticate, validate(momentsInputs.create), controller.create);
  router.get('/feed', authenticate, controller.feed);
  router.post('/:id/view', authenticate, validate(momentsInputs.moment), controller.view);
  return router;
}
