import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import type { RequireSpaceRole } from '../../middlewares/require-space-role';
import type { ImageUpload } from '../../middlewares/upload';
import { validate } from '../../middlewares/validate';
import { createSnapsController } from './snaps.controller';
import { createSnapsInputs } from './snaps.schemas';
import type { SnapsService } from './snaps.service';

export interface SnapsRouterDependencies {
  config: Config;
  service: SnapsService;
  upload: ImageUpload;
  authenticate: RequestHandler;
  optionalAuth: RequestHandler;
  requireSpaceRole: RequireSpaceRole;
}

/** Field of the multipart form that carries the photos. */
const PHOTOS_FIELD = 'files';

function createSnapsModule({ config, service }: SnapsRouterDependencies) {
  const inputs = createSnapsInputs(config.pagination);
  return { inputs, controller: createSnapsController(service, inputs) };
}

/** Mounted on /api/spaces: upload and list the snaps of a Space. */
export function createSpaceSnapsRouter(deps: SnapsRouterDependencies): Router {
  const { inputs, controller } = createSnapsModule(deps);
  const router = Router();
  router.post(
    '/:spaceId/snaps',
    deps.authenticate,
    deps.requireSpaceRole('EDITOR'),
    deps.upload.files(PHOTOS_FIELD),
    validate(inputs.upload),
    controller.upload,
  );
  router.get(
    '/:spaceId/snaps',
    deps.optionalAuth,
    deps.requireSpaceRole('VIEWER'),
    validate(inputs.list),
    controller.list,
  );
  return router;
}

/** /api/snaps: read, change and delete one snap. */
export function createSnapsRouter(deps: SnapsRouterDependencies): Router {
  const { inputs, controller } = createSnapsModule(deps);
  const router = Router();
  router.get('/:id', deps.optionalAuth, validate(inputs.snap), controller.get);
  router.patch('/:id', deps.authenticate, validate(inputs.update), controller.update);
  router.delete('/:id', deps.authenticate, validate(inputs.snap), controller.remove);
  return router;
}
