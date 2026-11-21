import type { RequestHandler } from 'express';
import type { Config } from '../../config/env';
import { getHealthStatus } from './health.service';

export interface HealthController {
  getHealth: RequestHandler;
}

export function createHealthController(config: Config): HealthController {
  return {
    getHealth: (_req, res) => {
      res.json({ data: getHealthStatus(config.app.name) });
    },
  };
}
