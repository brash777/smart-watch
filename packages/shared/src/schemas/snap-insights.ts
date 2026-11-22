import { z } from 'zod';
import type { SpaceMode } from '../types/enums';
import { analysisStatusSchema, spaceModeSchema } from './enums';
import { tagsSchema } from './snaps';

/*
 * SnapInsight content: what the AI writes about one snap, by Space mode (docs/PRODUCT.md,
 * "Space modes"). The AI answers with these shapes and the person can edit them afterwards,
 * so the same rules apply to both. The prompts in apps/api/src/modules/ai/prompts explain
 * every field to the model.
 */

/** A text written by the AI or by the person: trimmed and never empty. */
const insightText = z.string().trim().min(1);
const insightTextList = z.array(insightText);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/**
 * A hashtag as Snapia stores it: lowercase, without the leading #, made of letters, digits
 * and _ ("#Repostería" becomes "repostería").
 */
export const hashtagSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^#+/, '').toLowerCase())
  .pipe(z.string().regex(/^[\p{Ll}\p{Nd}_]+$/u, 'expected letters, digits or _ without spaces'));

/** What a STUDY snap shows. */
export const studyContentTypeSchema = z.enum([
  'WHITEBOARD',
  'SLIDE',
  'NOTEBOOK',
  'BOOK_PAGE',
  'HANDOUT',
  'SCREEN',
  'OTHER',
]);

/** How serious a problem seen in a WORK snap is. */
export const issueSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

/** Fields of every SnapInsight, whatever the mode. */
const insightBaseShape = {
  /** One or two sentences about what the snap shows. */
  summary: insightText,
  /** Tags the author may add to the snap (normalized like snap tags). */
  suggestedTags: tagsSchema,
};

/** STUDY: the text read in the photo, its topics and its key concepts. */
export const studySnapInsightSchema = z.object({
  ...insightBaseShape,
  contentType: studyContentTypeSchema,
  /** Every readable text of the photo as Markdown, in its original language; empty when none. */
  extractedText: z.string().trim(),
  topics: insightTextList,
  keyConcepts: z.array(z.object({ term: insightText, definition: insightText })),
  /** What limits the use of the snap: illegible or cut-off parts, glare, blur… */
  warnings: insightTextList,
});

/** WORK: a factual description of the work shown, its state and its visible issues. */
export const workSnapInsightSchema = z.object({
  ...insightBaseShape,
  activity: insightText,
  objectsDetected: insightTextList,
  progressNote: insightText,
  issues: z.array(z.object({ description: insightText, severity: issueSeveritySchema })),
  safetyObservations: insightTextList,
});

/** CONTENT: photo quality feedback plus a caption, hashtags and alt text ready to publish. */
export const contentSnapInsightSchema = z.object({
  ...insightBaseShape,
  description: insightText,
  /** A score from 0 (unusable) to 100 (ready to publish): the scale is part of the contract. */
  qualityScore: z.number().int().min(0).max(100),
  qualityTips: insightTextList,
  suggestedCaption: insightText,
  hashtags: z.array(hashtagSchema).transform(unique),
  altText: insightText,
});

/** The SnapInsight content schema of each Space mode. */
export const snapInsightDataSchemas = {
  STUDY: studySnapInsightSchema,
  WORK: workSnapInsightSchema,
  CONTENT: contentSnapInsightSchema,
} as const satisfies Record<SpaceMode, z.ZodType>;

/** Fields of every SnapInsight the API returns, whatever the mode. */
const snapInsightResponseShape = {
  id: z.uuid(),
  snapId: z.uuid(),
  /** Prompt file that produced the AI result, e.g. snap-analysis.study.v1. */
  promptVersion: z.string(),
  /** True once the person edited the AI result. */
  editedByUser: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

/** GET /api/snaps/:id/insight: `data` has the shape of the insight's mode. */
export const snapInsightSchema = z.discriminatedUnion('mode', [
  z.object({
    ...snapInsightResponseShape,
    mode: z.literal(spaceModeSchema.enum.STUDY),
    data: studySnapInsightSchema,
  }),
  z.object({
    ...snapInsightResponseShape,
    mode: z.literal(spaceModeSchema.enum.WORK),
    data: workSnapInsightSchema,
  }),
  z.object({
    ...snapInsightResponseShape,
    mode: z.literal(spaceModeSchema.enum.CONTENT),
    data: contentSnapInsightSchema,
  }),
]);

/** Some fields of a mode; the ones left out keep their value. Unknown fields are rejected. */
function editableFields<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  return z
    .strictObject(schema.shape)
    .partial()
    .refine((body) => Object.keys(body).length > 0, 'send at least one field to change');
}

/** PATCH /api/snaps/:id/insight: the body is checked against the mode of the insight. */
export const updateSnapInsightBodySchemas = {
  STUDY: editableFields(studySnapInsightSchema),
  WORK: editableFields(workSnapInsightSchema),
  CONTENT: editableFields(contentSnapInsightSchema),
} as const satisfies Record<SpaceMode, z.ZodType>;

const snapCount = z.number().int().nonnegative();

/** GET /api/spaces/:spaceId/analysis-status: how the analysis of the Space's snaps is going. */
export const spaceAnalysisStatusSchema = z.object({
  spaceId: z.uuid(),
  total: snapCount,
  /** Snaps of the Space in each analysis status. */
  counts: z.record(analysisStatusSchema, snapCount),
  /** How often to ask again while snaps are PENDING or PROCESSING (analysis_poll_interval_ms). */
  pollIntervalMs: z.number().int().positive(),
});

/** POST /api/snaps/:id/reanalyze */
export const snapAnalysisStateSchema = z.object({
  snapId: z.uuid(),
  analysisStatus: analysisStatusSchema,
});
