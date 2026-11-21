import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { getValidatedInput } from '../../middlewares/validate';
import type { FollowsInputs } from './follows.schemas';
import type { FollowsService } from './follows.service';

export function createFollowsController(service: FollowsService, inputs: FollowsInputs) {
  const follow: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.target);
    res.json({ data: await service.follow(requireAuth(req).userId, params.username) });
  };

  const unfollow: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.target);
    res.json({ data: await service.unfollow(requireAuth(req).userId, params.username) });
  };

  const followers: RequestHandler = async (_req, res) => {
    const { params, query } = getValidatedInput(res, inputs.list);
    const { items, nextCursor } = await service.listFollowers(params.username, query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const following: RequestHandler = async (_req, res) => {
    const { params, query } = getValidatedInput(res, inputs.list);
    const { items, nextCursor } = await service.listFollowing(params.username, query);
    res.json({ data: items, meta: { nextCursor } });
  };

  return { follow, unfollow, followers, following };
}
