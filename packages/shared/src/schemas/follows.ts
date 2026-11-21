import { z } from 'zod';

/** Answer of POST and DELETE /api/users/:username/follow. */
export const followStateSchema = z.object({
  username: z.string(),
  isFollowedByMe: z.boolean(),
  /** Followers of that user after the change. */
  followersCount: z.number().int().nonnegative(),
});
