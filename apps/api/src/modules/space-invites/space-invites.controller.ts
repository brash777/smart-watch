import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { requireSpaceAccess } from '../../middlewares/require-space-role';
import { getValidatedInput } from '../../middlewares/validate';
import { createInviteInput, joinSpaceInput, revokeInviteInput } from './space-invites.schemas';
import type { SpaceInvitesService } from './space-invites.service';

export function createSpaceInvitesController(service: SpaceInvitesService) {
  const create: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, createInviteInput);
    const invite = await service.create(requireSpaceAccess(req), requireAuth(req).userId, body);
    res.status(201).json({ data: invite });
  };

  const list: RequestHandler = async (req, res) => {
    res.json({ data: await service.list(requireSpaceAccess(req)) });
  };

  const revoke: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, revokeInviteInput);
    await service.revoke(requireSpaceAccess(req), params.inviteId);
    res.status(204).end();
  };

  const join: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, joinSpaceInput);
    res.json({ data: await service.join(requireAuth(req).userId, body.code) });
  };

  return { create, list, revoke, join };
}
