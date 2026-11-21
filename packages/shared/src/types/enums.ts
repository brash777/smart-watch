import type { z } from 'zod';
import type {
  spaceModeSchema,
  spaceRoleSchema,
  userRoleSchema,
  visibilitySchema,
} from '../schemas/enums';

export type UserRole = z.infer<typeof userRoleSchema>;
export type SpaceMode = z.infer<typeof spaceModeSchema>;
export type SpaceRole = z.infer<typeof spaceRoleSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
