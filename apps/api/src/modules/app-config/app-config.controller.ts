import type { RequestHandler } from 'express';
import type { AppConfigService } from './app-config.service';

export function createAppConfigController(service: AppConfigService) {
  const get: RequestHandler = async (_req, res) => {
    res.json({ data: await service.get() });
  };

  return { get };
}
