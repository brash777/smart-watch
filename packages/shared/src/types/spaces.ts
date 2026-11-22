import type { z } from 'zod';
import type { createSpaceBodySchema, spaceSchema, updateSpaceBodySchema } from '../schemas/spaces';

export type CreateSpaceBody = z.infer<typeof createSpaceBodySchema>;
export type UpdateSpaceBody = z.infer<typeof updateSpaceBodySchema>;
export type Space = z.infer<typeof spaceSchema>;
