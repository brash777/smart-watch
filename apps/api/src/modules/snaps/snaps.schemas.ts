import { analysisStatusSchema, tagSchema, tagsSchema, updateSnapBodySchema } from '@snapia/shared';
import { z } from 'zod';
import type { Config } from '../../config/env';
import { createPaginationQuerySchema } from '../../lib/pagination';
import type { RequestSchemas } from '../../middlewares/validate';

/** Multipart tags: one comma-separated field, or the same field repeated. */
const multipartTags = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : [value])
      .flatMap((part) => part.split(','))
      .filter((tag) => tag.trim() !== ''),
  )
  .pipe(tagsSchema);

/** Multipart note: an empty note is no note. */
const multipartNote = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value));

/** Request schemas of the snaps routes (the page size limits come from the config). */
export function createSnapsInputs(pagination: Config['pagination']) {
  const snapParams = z.object({ id: z.uuid() });
  return {
    upload: { body: z.object({ note: multipartNote.optional(), tags: multipartTags.optional() }) },
    list: {
      query: createPaginationQuerySchema(pagination).extend({
        tag: tagSchema.optional(),
        authorId: z.uuid().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        analysisStatus: analysisStatusSchema.optional(),
      }),
    },
    snap: { params: snapParams },
    update: { params: snapParams, body: updateSnapBodySchema },
  } satisfies Record<string, RequestSchemas>;
}

export type SnapsInputs = ReturnType<typeof createSnapsInputs>;
