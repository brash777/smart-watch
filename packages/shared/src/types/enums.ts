import type { z } from 'zod';
import type {
  aiTaskSchema,
  analysisStatusSchema,
  documentStatusSchema,
  documentTypeSchema,
  momentAudienceSchema,
  postVisibilitySchema,
  spaceModeSchema,
  spaceRoleSchema,
  userRoleSchema,
  visibilitySchema,
} from '../schemas/enums';

export type UserRole = z.infer<typeof userRoleSchema>;
export type SpaceMode = z.infer<typeof spaceModeSchema>;
export type SpaceRole = z.infer<typeof spaceRoleSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type AiTask = z.infer<typeof aiTaskSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type MomentAudience = z.infer<typeof momentAudienceSchema>;
export type PostVisibility = z.infer<typeof postVisibilitySchema>;
