import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { getValidatedInput } from '../../middlewares/validate';
import { likesInputs } from './likes.schemas';
import type { LikesService } from './likes.service';

export function createLikesController(service: LikesService) {
  const toggle: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, likesInputs.toggle);
    res.json({ data: await service.toggle(params.id, requireAuth(req).userId) });
  };

  return { toggle };
}
