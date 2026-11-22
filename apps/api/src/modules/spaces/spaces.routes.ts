import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import type { RequireSpaceRole } from '../../middlewares/require-space-role';
import { validate } from '../../middlewares/validate';
import type { SettingsService } from '../settings/settings.service';
import { createSpacesController } from './spaces.controller';
import type { SpacesRepository } from './spaces.repository';
import { createSpacesInputs } from './spaces.schemas';
import { createSpacesService } from './spaces.service';

export interface SpacesRouterDependencies {
  config: Config;
  repository: SpacesRepository;
  settings: SettingsService;
  authenticate: RequestHandler;
  optionalAuth: RequestHandler;
  requireSpaceRole: RequireSpaceRole;
}

/** /api/spaces: create, list, read, change and archive Spaces. */
export function createSpacesRouter(deps: SpacesRouterDependencies): Router {
  const { authenticate, optionalAuth, requireSpaceRole } = deps;
  const inputs = createSpacesInputs(deps.config.pagination);
  const controller = createSpacesController(
    createSpacesService({ repository: deps.repository, settings: deps.settings }),
    inputs,
  );

  const router = Router();
  router.post('/', authenticate, validate(inputs.create), controller.create);
  router.get('/', authenticate, validate(inputs.list), controller.listMine);
  router.get('/:spaceId', optionalAuth, requireSpaceRole('VIEWER'), controller.get);
  router.patch(
    '/:spaceId',
    authenticate,
    requireSpaceRole('OWNER'),
    validate(inputs.update),
    controller.update,
  );
  router.post('/:spaceId/archive', authenticate, requireSpaceRole('OWNER'), controller.archive);
  router.post('/:spaceId/unarchive', authenticate, requireSpaceRole('OWNER'), controller.unarchive);
  return router;
}
