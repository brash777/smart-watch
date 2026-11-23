import { z } from 'zod';

/**
 * GET /api/app-config: what the web app needs before it creates a Space or uploads photos.
 * The values come from AppSettings and from the API environment, never from code.
 */
export const appConfigSchema = z.object({
  spaces: z.object({
    /** Colors a Space can have (space_color_palette). */
    colorPalette: z.array(z.string()).min(1),
  }),
  compose: z.object({
    /** Snaps one Compose, FlashcardDeck or Quiz can use (max_snaps_per_compose). */
    maxSnaps: z.number().int().positive(),
    /** Shown with every ASSIGNMENT_GUIDE (assignment_guide_notice). */
    assignmentGuideNotice: z.string(),
  }),
  uploads: z.object({
    /** Photos in one upload request (UPLOAD_MAX_FILES). */
    maxFiles: z.number().int().positive(),
    /** Size of one photo, in bytes (UPLOAD_MAX_MB). */
    maxFileSizeBytes: z.number().int().positive(),
    /** Accepted photo types (UPLOAD_ALLOWED_MIME). */
    allowedMimeTypes: z.array(z.string()).min(1),
    /** Longest side of a stored photo (IMAGE_MAX_SIDE_PX): bigger photos are scaled down. */
    imageMaxSidePx: z.number().int().positive(),
  }),
});
