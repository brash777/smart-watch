import { z } from 'zod';
import { userSummarySchema } from './auth';
import { spaceModeSchema, spaceRoleSchema, visibilitySchema } from './enums';
import { spaceMetadataByModeSchema } from './space-metadata';

/** A color such as #4F46E5, normalized to uppercase. It must be in space_color_palette. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'expected a hex color such as #1A2B3C')
  .toUpperCase();

const spaceNameSchema = z.string().trim().min(1, 'is required');

/** Text that can be cleared: an empty string becomes null. */
const clearableText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** POST /api/spaces. Without visibility the Space is PRIVATE. */
export const createSpaceBodySchema = z
  .object({
    name: spaceNameSchema,
    description: clearableText.optional(),
    color: hexColorSchema,
    visibility: visibilitySchema.optional(),
  })
  .and(spaceMetadataByModeSchema);

/** PATCH /api/spaces/:spaceId. The mode never changes; metadata is checked against it. */
export const updateSpaceBodySchema = z
  .object({
    name: spaceNameSchema.optional(),
    description: clearableText.optional(),
    color: hexColorSchema.optional(),
    visibility: visibilitySchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    'send at least one field to change',
  );

/** A Space as the API returns it. */
export const spaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  mode: spaceModeSchema,
  color: z.string(),
  visibility: visibilitySchema,
  metadata: z.record(z.string(), z.string()),
  coverSnapId: z.uuid().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  owner: userSummarySchema,
  counts: z.object({
    snaps: z.number().int().nonnegative(),
    members: z.number().int().nonnegative(),
  }),
  /** Your role in the Space; null when you see a PUBLIC Space without being a member. */
  myRole: spaceRoleSchema.nullable(),
});
