import { type RequestHandler, Router } from 'express';
import type { RequireSpaceRole } from '../../middlewares/require-space-role';
import { validate } from '../../middlewares/validate';
import { createAskController } from './ask.controller';
import { askInputs } from './ask.schemas';
import type { AskService } from './ask.service';

export interface AskRouterDependencies {
  service: AskService;
  authenticate: RequestHandler;
  requireSpaceRole: RequireSpaceRole;
}

/** Mounted on /api/spaces: the "Ask your Space" chat. */
export function createAskRouter(deps: AskRouterDependencies): Router {
  const controller = createAskController(deps.service);
  const router = Router();
  router.post(
    '/:spaceId/ask',
    deps.authenticate,
    deps.requireSpaceRole('EDITOR'),
    validate(askInputs.ask),
    controller.ask,
  );
  return router;
}
