import { createSpaceBodySchema, spaceModeSchema, updateSpaceBodySchema } from '@snapia/shared';
import type { Config } from '../../config/env';
import { createPaginationQuerySchema } from '../../lib/pagination';
import { booleanQueryParam } from '../../lib/query-params';
import type { RequestSchemas } from '../../middlewares/validate';

/** Request schemas of the spaces routes (the page size limits come from the config). */
export function createSpacesInputs(pagination: Config['pagination']) {
  return {
    create: { body: createSpaceBodySchema },
    list: {
      query: createPaginationQuerySchema(pagination).extend({
        mode: spaceModeSchema.optional(),
        archived: booleanQueryParam.optional(),
      }),
    },
    update: { body: updateSpaceBodySchema },
  } satisfies Record<string, RequestSchemas>;
}

export type SpacesInputs = ReturnType<typeof createSpacesInputs>;
