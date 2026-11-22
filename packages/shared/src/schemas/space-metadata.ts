import { z } from 'zod';
import { spaceModeSchema } from './enums';

const optionalText = z.string().trim().min(1).optional();

/** STUDY Space: the course the snaps belong to. */
export const studySpaceMetadataSchema = z.strictObject({
  subject: optionalText,
  professor: optionalText,
  semester: optionalText,
});

/** WORK Space: the job the evidence belongs to. */
export const workSpaceMetadataSchema = z.strictObject({
  project: optionalText,
  client: optionalText,
  siteLabel: optionalText,
});

/** CONTENT Space: the niche of the portfolio. */
export const contentSpaceMetadataSchema = z.strictObject({
  niche: optionalText,
});

/**
 * A Space mode together with its metadata. The shape of the metadata depends on the mode,
 * and fields of another mode are rejected. Every field is optional, so it defaults to {}.
 */
export const spaceMetadataByModeSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal(spaceModeSchema.enum.STUDY),
    metadata: studySpaceMetadataSchema.default({}),
  }),
  z.object({
    mode: z.literal(spaceModeSchema.enum.WORK),
    metadata: workSpaceMetadataSchema.default({}),
  }),
  z.object({
    mode: z.literal(spaceModeSchema.enum.CONTENT),
    metadata: contentSpaceMetadataSchema.default({}),
  }),
]);
