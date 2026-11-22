import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { getValidatedInput } from '../../middlewares/validate';
import type { UsersInputs } from './users.schemas';
import type { UsersService } from './users.service';

export function createUsersController(service: UsersService, inputs: UsersInputs) {
  const getProfile: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.profile);
    res.json({ data: await service.getPublicProfile(params.username, req.auth?.userId) });
  };

  const updateMe: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, inputs.updateMe);
    res.json({ data: await service.updateMe(requireAuth(req).userId, body) });
  };

  /** multipart/form-data with one image in the "avatar" field. */
  const updateAvatar: RequestHandler = async (req, res) => {
    res.json({ data: await service.setAvatar(requireAuth(req).userId, req.file?.buffer) });
  };

  const search: RequestHandler = async (_req, res) => {
    const { query } = getValidatedInput(res, inputs.search);
    const { q, ...page } = query;
    const { items, nextCursor } = await service.search(q, page);
    res.json({ data: items, meta: { nextCursor } });
  };

  const adminList: RequestHandler = async (_req, res) => {
    const { query } = getValidatedInput(res, inputs.adminList);
    const { items, nextCursor } = await service.listForAdmin(query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const adminSetStatus: RequestHandler = async (req, res) => {
    const { params, body } = getValidatedInput(res, inputs.adminStatus);
    res.json({ data: await service.setActive(requireAuth(req).userId, params.id, body.isActive) });
  };

  const adminSetRole: RequestHandler = async (req, res) => {
    const { params, body } = getValidatedInput(res, inputs.adminRole);
    res.json({ data: await service.setRole(requireAuth(req).userId, params.id, body.role) });
  };

  return { getProfile, updateMe, updateAvatar, search, adminList, adminSetStatus, adminSetRole };
}
