import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { requireSpaceAccess } from '../../middlewares/require-space-role';
import { getValidatedInput } from '../../middlewares/validate';
import type { SpaceMembersInputs } from './space-members.schemas';
import type { SpaceMembersService } from './space-members.service';

export function createSpaceMembersController(
  service: SpaceMembersService,
  inputs: SpaceMembersInputs,
) {
  const list: RequestHandler = async (req, res) => {
    const { query } = getValidatedInput(res, inputs.list);
    const { items, nextCursor } = await service.list(requireSpaceAccess(req), query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const changeRole: RequestHandler = async (req, res) => {
    const { params, body } = getValidatedInput(res, inputs.changeRole);
    res.json({ data: await service.changeRole(requireSpaceAccess(req), params.userId, body.role) });
  };

  const remove: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.remove);
    await service.remove(requireSpaceAccess(req), params.userId);
    res.status(204).end();
  };

  const leave: RequestHandler = async (req, res) => {
    await service.leave(requireSpaceAccess(req), requireAuth(req).userId);
    res.status(204).end();
  };

  return { list, changeRole, remove, leave };
}
