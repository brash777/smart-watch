import {
  composeDocumentBodySchema,
  documentTypeSchema,
  updateDocumentBodySchema,
} from '@snapia/shared';
import { z } from 'zod';
import type { Config } from '../../config/env';
import { createPaginationQuerySchema } from '../../lib/pagination';
import type { RequestSchemas } from '../../middlewares/validate';

/** Request schemas of the documents routes (the page size limits come from the config). */
export function createDocumentsInputs(pagination: Config['pagination']) {
  const documentParams = z.object({ id: z.uuid() });
  return {
    compose: { body: composeDocumentBodySchema },
    list: {
      query: createPaginationQuerySchema(pagination).extend({
        type: documentTypeSchema.optional(),
      }),
    },
    document: { params: documentParams },
    update: { params: documentParams, body: updateDocumentBodySchema },
  } satisfies Record<string, RequestSchemas>;
}

export type DocumentsInputs = ReturnType<typeof createDocumentsInputs>;
