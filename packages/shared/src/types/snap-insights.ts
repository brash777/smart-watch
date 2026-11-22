import type { z } from 'zod';
import type {
  contentSnapInsightSchema,
  issueSeveritySchema,
  snapAnalysisStateSchema,
  snapInsightDataSchemas,
  snapInsightSchema,
  spaceAnalysisStatusSchema,
  studyContentTypeSchema,
  studySnapInsightSchema,
  updateSnapInsightBodySchemas,
  workSnapInsightSchema,
} from '../schemas/snap-insights';
import type { SpaceMode } from './enums';

export type StudyContentType = z.infer<typeof studyContentTypeSchema>;
export type IssueSeverity = z.infer<typeof issueSeveritySchema>;
export type StudySnapInsight = z.infer<typeof studySnapInsightSchema>;
export type WorkSnapInsight = z.infer<typeof workSnapInsightSchema>;
export type ContentSnapInsight = z.infer<typeof contentSnapInsightSchema>;
/** The SnapInsight content of each Space mode. */
export type SnapInsightDataByMode = {
  [M in SpaceMode]: z.infer<(typeof snapInsightDataSchemas)[M]>;
};
/** A SnapInsight as the API returns it. */
export type SnapInsight = z.infer<typeof snapInsightSchema>;
/** The body of PATCH /api/snaps/:id/insight for each Space mode. */
export type UpdateSnapInsightBodyByMode = {
  [M in SpaceMode]: z.infer<(typeof updateSnapInsightBodySchemas)[M]>;
};
export type SpaceAnalysisStatus = z.infer<typeof spaceAnalysisStatusSchema>;
export type SnapAnalysisState = z.infer<typeof snapAnalysisStateSchema>;
