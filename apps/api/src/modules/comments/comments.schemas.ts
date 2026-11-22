import { createCommentBodySchema } from '@snapia/shared';
import { z } from 'zod';
import type { Config } from '../../config/env';
import { createPaginationQuerySchema } from '../../lib/pagination';
import type { RequestSchemas } from '../../middlewares/validate';

/** Request schemas of the comments routes (the page size limits come from the config). */
export function createCommentsInputs(pagination: Config['pagination']) {
  const postParams = z.object({ id: z.uuid() });
  return {
    create: { params: postParams, body: createCommentBodySchema },
    list: { params: postParams, query: createPaginationQuerySchema(pagination) },
    comment: { params: z.object({ id: z.uuid() }) },
  } satisfies Record<string, RequestSchemas>;
}

export type CommentsInputs = ReturnType<typeof createCommentsInputs>;
