import { updateSettingBodySchema } from '@snapia/shared';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middlewares/require-role';
import { getValidatedInput, validate } from '../../middlewares/validate';
import type { PrismaClient } from '../../lib/prisma';
import type { SettingsService } from '../settings/settings.service';
import { createAdminRepository } from './admin.repository';
import { createAdminService } from './admin.service';

const updateSettingInput = {
  params: z.object({ key: z.string().min(1) }),
  body: updateSettingBodySchema,
};

/** /api/admin: settings and the numbers of the app, for ADMINs only. */
export function createAdminRouter(deps: {
  prisma: PrismaClient;
  settings: SettingsService;
  authenticate: RequestHandler;
}): Router {
  const service = createAdminService({
    repository: createAdminRepository(deps.prisma),
    settings: deps.settings,
  });
  const router = Router();
  router.use(deps.authenticate, requireRole('ADMIN'));
  router.get('/settings', async (_req, res) => {
    res.json({ data: await service.listSettings() });
  });
  router.patch('/settings/:key', validate(updateSettingInput), async (_req, res) => {
    const { params, body } = getValidatedInput(res, updateSettingInput);
    res.json({ data: await service.updateSetting(params.key, body.value) });
  });
  router.get('/stats', async (_req, res) => {
    res.json({ data: await service.stats() });
  });
  return router;
}
