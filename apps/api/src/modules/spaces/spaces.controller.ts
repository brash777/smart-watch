import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { requireSpaceAccess } from '../../middlewares/require-space-role';
import { getValidatedInput } from '../../middlewares/validate';
import type { SpacesInputs } from './spaces.schemas';
import type { SpacesService } from './spaces.service';

export function createSpacesController(service: SpacesService, inputs: SpacesInputs) {
  const create: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, inputs.create);
    res.status(201).json({ data: await service.create(requireAuth(req).userId, body) });
  };

  const listMine: RequestHandler = async (req, res) => {
    const { query } = getValidatedInput(res, inputs.list);
    const { items, nextCursor } = await service.listMine(requireAuth(req).userId, query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const get: RequestHandler = async (req, res) => {
    res.json({ data: await service.get(requireSpaceAccess(req)) });
  };

  const update: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, inputs.update);
    res.json({ data: await service.update(requireSpaceAccess(req), body) });
  };

  const archive: RequestHandler = async (req, res) => {
    res.json({ data: await service.setArchived(requireSpaceAccess(req), true) });
  };

  const unarchive: RequestHandler = async (req, res) => {
    res.json({ data: await service.setArchived(requireSpaceAccess(req), false) });
  };

  return { create, listMine, get, update, archive, unarchive };
}
