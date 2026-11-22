import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { requireSpaceAccess } from '../../middlewares/require-space-role';
import { getValidatedInput } from '../../middlewares/validate';
import type { DocumentsInputs } from './documents.schemas';
import type { DocumentsService } from './documents.service';

export function createDocumentsController(service: DocumentsService, inputs: DocumentsInputs) {
  const compose: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, inputs.compose);
    const document = await service.compose(requireSpaceAccess(req), requireAuth(req).userId, body);
    res.status(201).json({ data: document });
  };

  const list: RequestHandler = async (req, res) => {
    const { query } = getValidatedInput(res, inputs.list);
    const { items, nextCursor } = await service.list(requireSpaceAccess(req), query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const get: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.document);
    res.json({ data: await service.get(params.id, req.auth?.userId) });
  };

  const update: RequestHandler = async (req, res) => {
    const { params, body } = getValidatedInput(res, inputs.update);
    res.json({ data: await service.update(params.id, requireAuth(req).userId, body) });
  };

  const remove: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.document);
    await service.remove(params.id, requireAuth(req).userId);
    res.status(204).end();
  };

  return { compose, list, get, update, remove };
}
