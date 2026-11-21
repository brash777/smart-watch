import type { Config } from '../../config/env';
import { createPaginationQuerySchema } from '../../lib/pagination';
import type { RequestSchemas } from '../../middlewares/validate';
import { usernameParamsSchema } from '../users/users.schemas';

/** Request schemas of the follows routes (the page size limits come from the config). */
export function createFollowsInputs(pagination: Config['pagination']) {
  return {
    target: { params: usernameParamsSchema },
    list: { params: usernameParamsSchema, query: createPaginationQuerySchema(pagination) },
  } satisfies Record<string, RequestSchemas>;
}

export type FollowsInputs = ReturnType<typeof createFollowsInputs>;
