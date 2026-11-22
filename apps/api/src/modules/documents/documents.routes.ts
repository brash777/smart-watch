import { type RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import type { RequireSpaceRole } from '../../middlewares/require-space-role';
import { validate } from '../../middlewares/validate';
import { createDocumentsController } from './documents.controller';
import { createDocumentsInputs } from './documents.schemas';
import type { DocumentsService } from './documents.service';

export interface DocumentsRouterDependencies {
  config: Config;
  service: DocumentsService;
  authenticate: RequestHandler;
  optionalAuth: RequestHandler;
  requireSpaceRole: RequireSpaceRole;
}

function createDocumentsModule({ config, service }: DocumentsRouterDependencies) {
  const inputs = createDocumentsInputs(config.pagination);
  return { inputs, controller: createDocumentsController(service, inputs) };
}

/** Mounted on /api/spaces: Compose and the Documents of a Space. */
export function createSpaceDocumentsRouter(deps: DocumentsRouterDependencies): Router {
  const { inputs, controller } = createDocumentsModule(deps);
  const router = Router();
  router.post(
    '/:spaceId/documents',
    deps.authenticate,
    deps.requireSpaceRole('EDITOR'),
    validate(inputs.compose),
    controller.compose,
  );
  router.get(
    '/:spaceId/documents',
    deps.optionalAuth,
    deps.requireSpaceRole('VIEWER'),
    validate(inputs.list),
    controller.list,
  );
  return router;
}

/** /api/documents: read, export, edit and delete one Document. */
export function createDocumentsRouter(deps: DocumentsRouterDependencies): Router {
  const { inputs, controller } = createDocumentsModule(deps);
  const router = Router();
  router.get('/:id', deps.optionalAuth, validate(inputs.document), controller.get);
  router.get('/:id/export', deps.optionalAuth, validate(inputs.export), controller.exportFile);
  router.patch('/:id', deps.authenticate, validate(inputs.update), controller.update);
  router.delete('/:id', deps.authenticate, validate(inputs.document), controller.remove);
  return router;
}
