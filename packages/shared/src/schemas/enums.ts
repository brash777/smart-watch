import { z } from 'zod';

/** Space mode: decides what the AI does with the snaps of a Space (docs/PRODUCT.md, "Space modes"). */
export const spaceModeSchema = z.enum(['STUDY', 'WORK', 'CONTENT']);

/** Role of a SpaceMember inside a Space, from most to least powerful. */
export const spaceRoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);

/** Who can see a Space and its snaps. Spaces are PRIVATE by default. */
export const visibilitySchema = z.enum(['PRIVATE', 'MEMBERS', 'PUBLIC']);
