import type { z } from 'zod';
import type { snapDetailSchema, snapSchema, updateSnapBodySchema } from '../schemas/snaps';

export type UpdateSnapBody = z.infer<typeof updateSnapBodySchema>;
export type Snap = z.infer<typeof snapSchema>;
export type SnapDetail = z.infer<typeof snapDetailSchema>;
