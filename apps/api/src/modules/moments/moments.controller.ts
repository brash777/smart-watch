import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { getValidatedInput } from '../../middlewares/validate';
import { momentsInputs } from './moments.schemas';
import type { MomentsService } from './moments.service';

export function createMomentsController(service: MomentsService) {
  const create: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, momentsInputs.create);
    res.status(201).json({ data: await service.create(requireAuth(req).userId, body) });
  };

  const feed: RequestHandler = async (req, res) => {
    res.json({ data: await service.feed(requireAuth(req).userId) });
  };

  const view: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, momentsInputs.moment);
    await service.view(params.id, requireAuth(req).userId);
    res.status(204).end();
  };

  return { create, feed, view };
}
