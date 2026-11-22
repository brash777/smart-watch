import type { z } from 'zod';
import type {
  contentSnapInsightSchema,
  issueSeveritySchema,
  snapInsightDataSchemas,
  studyContentTypeSchema,
  studySnapInsightSchema,
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
