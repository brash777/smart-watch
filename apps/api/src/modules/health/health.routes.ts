import { Router } from 'express';
import type { Config } from '../../config/env';
import { createHealthController } from './health.controller';

/** Public liveness check: GET /api/health. */
export function createHealthRouter(config: Config): Router {
  const router = Router();
  const controller = createHealthController(config);

  router.get('/', controller.getHealth);

  return router;
}
