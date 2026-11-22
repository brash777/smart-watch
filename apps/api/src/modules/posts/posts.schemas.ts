import { createPostBodySchema, hashtagSchema, postDraftBodySchema } from '@snapia/shared';
import { z } from 'zod';
import type { Config } from '../../config/env';
import { createPaginationQuerySchema } from '../../lib/pagination';
import type { RequestSchemas } from '../../middlewares/validate';
import { usernameParamsSchema } from '../users/users.schemas';

/** Request schemas of the posts, feed, portfolio and explore routes. */
export function createPostsInputs(pagination: Config['pagination']) {
  const page = createPaginationQuerySchema(pagination);
  return {
    create: { body: createPostBodySchema },
    draft: { body: postDraftBodySchema },
    post: { params: z.object({ id: z.uuid() }) },
    feed: { query: page },
    portfolio: { params: usernameParamsSchema, query: page },
    explore: { query: page.extend({ hashtag: hashtagSchema.optional() }) },
    trending: { query: page.pick({ limit: true }) },
  } satisfies Record<string, RequestSchemas>;
}

export type PostsInputs = ReturnType<typeof createPostsInputs>;
