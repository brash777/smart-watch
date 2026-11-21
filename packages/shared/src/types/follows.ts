import type { z } from 'zod';
import type { followStateSchema } from '../schemas/follows';

export type FollowState = z.infer<typeof followStateSchema>;
