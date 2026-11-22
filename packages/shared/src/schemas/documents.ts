import { z } from 'zod';
import type { DocumentType, SpaceMode } from '../types/enums';
import { userSummarySchema } from './auth';
import { documentStatusSchema, documentTypeSchema } from './enums';

/** The Document types that Compose offers in each Space mode (docs/PRODUCT.md, "Space modes"). */
export const documentTypesByMode = {
  STUDY: ['STUDY_NOTES', 'STUDY_SUMMARY', 'ASSIGNMENT_GUIDE'],
  WORK: ['WORK_DAILY_REPORT', 'WORK_PROGRESS_REPORT'],
  CONTENT: ['CONTENT_POST', 'CONTENT_CAROUSEL'],
} as const satisfies Record<SpaceMode, readonly DocumentType[]>;

/**
 * Snaps selected for an AI task: at least one, without repeats. The maximum is the
 * max_snaps_per_compose setting, checked by the API.
 */
export const snapSelectionSchema = z
  .array(z.uuid())
  .min(1)
  .transform((ids) => [...new Set(ids)]);

const documentText = z.string().trim().min(1);

/** POST /api/spaces/:spaceId/documents */
export const composeDocumentBodySchema = z.object({
  type: documentTypeSchema,
  snapIds: snapSelectionSchema,
  /** Extra instructions for the AI; for ASSIGNMENT_GUIDE, the assignment statement (required). */
  instructions: documentText.optional(),
});

/** What the AI writes for Compose: Markdown that cites the snaps as [Snap N]. */
export const documentDraftSchema = z.object({
  title: documentText,
  contentMarkdown: documentText,
});

/** PATCH /api/documents/:id */
export const updateDocumentBodySchema = z
  .object({
    title: documentText.optional(),
    contentMarkdown: documentText.optional(),
    status: documentStatusSchema.optional(),
  })
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    'send at least one field to change',
  );

/** A Document in lists. */
export const documentSummarySchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  author: userSummarySchema,
  type: documentTypeSchema,
  title: z.string(),
  status: documentStatusSchema,
  /** Starts at 1 and grows with every edit. */
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** One Document with its Markdown. The N-th source is the snap the text cites as [Snap N]. */
export const documentSchema = documentSummarySchema.extend({
  instructions: z.string().nullable(),
  contentMarkdown: z.string(),
  /** Prompt file that produced the first draft, e.g. compose.study-notes.v1. */
  promptVersion: z.string(),
  sources: z.array(z.object({ snapId: z.uuid(), order: z.number().int().positive() })),
});

/** GET /api/documents/:id/export?format= */
export const documentExportFormatSchema = z.enum(['md', 'pdf']);
