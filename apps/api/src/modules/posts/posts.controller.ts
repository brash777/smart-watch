import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { getValidatedInput } from '../../middlewares/validate';
import type { PostsInputs } from './posts.schemas';
import type { PostsService } from './posts.service';

export function createPostsController(service: PostsService, inputs: PostsInputs) {
  const create: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, inputs.create);
    res.status(201).json({ data: await service.create(requireAuth(req).userId, body) });
  };

  const draft: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, inputs.draft);
    res.json({ data: await service.draft(requireAuth(req).userId, body) });
  };

  const remove: RequestHandler = async (req, res) => {
    const { params } = getValidatedInput(res, inputs.post);
    await service.remove(params.id, requireAuth(req).userId);
    res.status(204).end();
  };

  const feed: RequestHandler = async (req, res) => {
    const { query } = getValidatedInput(res, inputs.feed);
    const { items, nextCursor } = await service.feed(requireAuth(req).userId, query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const portfolio: RequestHandler = async (req, res) => {
    const { params, query } = getValidatedInput(res, inputs.portfolio);
    const { items, nextCursor } = await service.portfolio(params.username, req.auth?.userId, query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const explore: RequestHandler = async (req, res) => {
    const { query } = getValidatedInput(res, inputs.explore);
    const { items, nextCursor } = await service.explore(query.hashtag, req.auth?.userId, query);
    res.json({ data: items, meta: { nextCursor } });
  };

  const trending: RequestHandler = async (_req, res) => {
    const { query } = getValidatedInput(res, inputs.trending);
    res.json({ data: await service.trending(query.limit) });
  };

  return { create, draft, remove, feed, portfolio, explore, trending };
}
