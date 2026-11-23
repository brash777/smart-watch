import { Router } from 'express';
import { createAppConfigController } from './app-config.controller';
import { createAppConfigService, type AppConfigServiceDependencies } from './app-config.service';

/** Public: GET /api/app-config, the settings the web app reads before it creates or uploads. */
export function createAppConfigRouter(deps: AppConfigServiceDependencies): Router {
  const controller = createAppConfigController(createAppConfigService(deps));
  const router = Router();
  router.get('/', controller.get);
  return router;
}
