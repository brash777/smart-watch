import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { requireSpaceAccess } from '../../middlewares/require-space-role';
import { getValidatedInput } from '../../middlewares/validate';
import type { SnapsInputs } from './snaps.schemas';
import type { SnapsService } from './snaps.service';

export function createSnapsController(service: SnapsService, inputs: SnapsInputs) {
  const upload: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, inputs.upload);
    const files = Array.isArray(req.files) ? req.files.map((file) => file.buffer) : [];
    const snaps = await service.upload(
      requireSpaceAccess(req),
      requireAuth(req).userId,
      files,
      body,
    );
    res.status(201).json({ data: snaps });
  };

  const list: RequestHandler = async (req, res) => {
    const { query } = getValidatedInput(res, inputs.list);
    const { items, nextCursor } = await service.list(
      requireSpaceAccess(req),
      req.auth?.userId,
      query,
    );
    res.json({ data: items, meta: { nextCursor } });
  };

  const get: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.snap);
    res.json({ data: await service.get(params.id, req.auth?.userId) });
  };

  const update: RequestHandler = async (req, res) => {
    const { params, body } = getValidatedInput(res, inputs.update);
    res.json({ data: await service.update(params.id, requireAuth(req).userId, body) });
  };

  const remove: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.snap);
    await service.remove(params.id, requireAuth(req).userId);
    res.status(204).end();
  };

  return { upload, list, get, update, remove };
}
