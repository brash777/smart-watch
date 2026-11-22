import { updateMemberRoleBodySchema } from '@snapia/shared';
import { z } from 'zod';
import type { Config } from '../../config/env';
import { createPaginationQuerySchema } from '../../lib/pagination';
import type { RequestSchemas } from '../../middlewares/validate';

/** Request schemas of the members routes (the page size limits come from the config). */
export function createSpaceMembersInputs(pagination: Config['pagination']) {
  const memberParams = z.object({ spaceId: z.uuid(), userId: z.uuid() });
  return {
    list: { query: createPaginationQuerySchema(pagination) },
    changeRole: { params: memberParams, body: updateMemberRoleBodySchema },
    remove: { params: memberParams },
  } satisfies Record<string, RequestSchemas>;
}

export type SpaceMembersInputs = ReturnType<typeof createSpaceMembersInputs>;
