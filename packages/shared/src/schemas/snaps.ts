import { z } from 'zod';
import { userSummarySchema } from './auth';
import { analysisStatusSchema } from './enums';

/** A tag of a snap: trimmed and lowercased. */
export const tagSchema = z.string().trim().toLowerCase().min(1);

/** Tags without duplicates (after normalizing them). */
export const tagsSchema = z.array(tagSchema).transform((tags) => [...new Set(tags)]);

/** Text that can be cleared: an empty string becomes null. */
const clearableText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** PATCH /api/snaps/:id */
export const updateSnapBodySchema = z
  .object({
    note: clearableText.optional(),
    tags: tagsSchema.optional(),
  })
  .refine(
    (body) => body.note !== undefined || body.tags !== undefined,
    'send note or tags (or both)',
  );

/** A snap in lists, with a temporary (signed) URL of its thumbnail. */
export const snapSchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  author: userSummarySchema,
  note: z.string().nullable(),
  tags: z.array(z.string()),
  /** When the photo was taken (EXIF), or when it was uploaded if the photo did not say. */
  takenAt: z.iso.datetime(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string(),
  analysisStatus: analysisStatusSchema,
  thumbnailUrl: z.string(),
  createdAt: z.iso.datetime(),
});

/** One snap, with a temporary (signed) URL of the full image as well. */
export const snapDetailSchema = snapSchema.extend({ imageUrl: z.string() });
