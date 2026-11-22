import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { getValidatedInput } from '../../middlewares/validate';
import type { CommentsInputs } from './comments.schemas';
import type { CommentsService } from './comments.service';

export function createCommentsController(service: CommentsService, inputs: CommentsInputs) {
  const create: RequestHandler = async (req, res) => {
    const { params, body } = getValidatedInput(res, inputs.create);
    res.status(201).json({ data: await service.create(params.id, requireAuth(req).userId, body) });
  };

  const list: RequestHandler = async (req, res) => {
    const { params, query } = getValidatedInput(res, inputs.list);
    const { items, nextCursor } = await service.list(params.id, req.auth?.userId, query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const remove: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.comment);
    await service.remove(params.id, requireAuth(req).userId);
    res.status(204).end();
  };

  return { create, list, remove };
}
