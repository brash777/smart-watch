import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { requireSpaceAccess } from '../../middlewares/require-space-role';
import { getValidatedInput } from '../../middlewares/validate';
import { snapInsightsInputs } from './snap-insights.schemas';
import type { SnapInsightsService } from './snap-insights.service';

export function createSnapInsightsController(service: SnapInsightsService) {
  const get: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, snapInsightsInputs.snap);
    res.json({ data: await service.get(params.id, req.auth?.userId) });
  };

  const update: RequestHandler = async (req, res) => {
    const { params, body } = getValidatedInput(res, snapInsightsInputs.update);
    res.json({ data: await service.update(params.id, requireAuth(req).userId, body) });
  };

  /** 202: the analysis runs in the background; follow it with the snap's analysisStatus. */
  const reanalyze: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, snapInsightsInputs.snap);
    res.status(202).json({ data: await service.reanalyze(params.id, requireAuth(req).userId) });
  };

  const spaceStatus: RequestHandler = async (req, res) => {
    res.json({ data: await service.spaceStatus(requireSpaceAccess(req)) });
  };

  return { get, update, reanalyze, spaceStatus };
}
