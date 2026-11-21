import type { z } from 'zod';
import type {
  contentSpaceMetadataSchema,
  spaceMetadataByModeSchema,
  studySpaceMetadataSchema,
  workSpaceMetadataSchema,
} from '../schemas/space-metadata';

export type StudySpaceMetadata = z.infer<typeof studySpaceMetadataSchema>;
export type WorkSpaceMetadata = z.infer<typeof workSpaceMetadataSchema>;
export type ContentSpaceMetadata = z.infer<typeof contentSpaceMetadataSchema>;
export type SpaceMetadataByMode = z.infer<typeof spaceMetadataByModeSchema>;
export type SpaceMetadata = SpaceMetadataByMode['metadata'];
