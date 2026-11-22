import { type RequestHandler, Router } from 'express';
import type { RequireSpaceRole } from '../../middlewares/require-space-role';
import { validate } from '../../middlewares/validate';
import { createSnapInsightsController } from './snap-insights.controller';
import { snapInsightsInputs } from './snap-insights.schemas';
import type { SnapInsightsService } from './snap-insights.service';

export interface SnapInsightsRouterDependencies {
  service: SnapInsightsService;
  authenticate: RequestHandler;
  optionalAuth: RequestHandler;
  requireSpaceRole: RequireSpaceRole;
}

/** Mounted on /api/snaps: the SnapInsight of a snap and a new analysis. */
export function createSnapInsightsRouter(deps: SnapInsightsRouterDependencies): Router {
  const controller = createSnapInsightsController(deps.service);
  const router = Router();
  router.get('/:id/insight', deps.optionalAuth, validate(snapInsightsInputs.snap), controller.get);
  router.patch(
    '/:id/insight',
    deps.authenticate,
    validate(snapInsightsInputs.update),
    controller.update,
  );
  router.post(
    '/:id/reanalyze',
    deps.authenticate,
    validate(snapInsightsInputs.snap),
    controller.reanalyze,
  );
  return router;
}

/** Mounted on /api/spaces: how the analysis of the snaps of a Space is going. */
export function createSpaceAnalysisRouter(deps: SnapInsightsRouterDependencies): Router {
  const controller = createSnapInsightsController(deps.service);
  const router = Router();
  router.get(
    '/:spaceId/analysis-status',
    deps.optionalAuth,
    deps.requireSpaceRole('VIEWER'),
    controller.spaceStatus,
  );
  return router;
}
