import { z } from 'zod';

/** Global role of a User. */
export const userRoleSchema = z.enum(['USER', 'ADMIN']);

/** Space mode: decides what the AI does with the snaps of a Space (docs/PRODUCT.md, "Space modes"). */
export const spaceModeSchema = z.enum(['STUDY', 'WORK', 'CONTENT']);

/** Role of a SpaceMember inside a Space, from most to least powerful. */
export const spaceRoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);

/** Who can see a Space and its snaps. Spaces are PRIVATE by default. */
export const visibilitySchema = z.enum(['PRIVATE', 'MEMBERS', 'PUBLIC']);

/** Where the AI analysis of a snap is. New snaps start PENDING. */
export const analysisStatusSchema = z.enum(['PENDING', 'PROCESSING', 'DONE', 'FAILED']);

/** What an AiRun did (docs/PRODUCT.md, "Enumerated values"). */
export const aiTaskSchema = z.enum([
  'SNAP_ANALYSIS',
  'COMPOSE_DOCUMENT',
  'STUDY_FLASHCARDS',
  'STUDY_QUIZ',
  'ASK_SPACE',
  'POST_DRAFT',
]);
