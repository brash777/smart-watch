import type { z } from 'zod';
import type {
  createMomentBodySchema,
  createPostBodySchema,
  momentGroupSchema,
  momentSchema,
  postDraftBodySchema,
  postDraftSchema,
  postSchema,
  sharedImageSchema,
  trendingHashtagSchema,
} from '../schemas/social';

export type SharedImage = z.infer<typeof sharedImageSchema>;
export type CreateMomentBody = z.infer<typeof createMomentBodySchema>;
export type Moment = z.infer<typeof momentSchema>;
export type MomentGroup = z.infer<typeof momentGroupSchema>;
export type CreatePostBody = z.infer<typeof createPostBodySchema>;
export type PostDraftBody = z.infer<typeof postDraftBodySchema>;
export type PostDraft = z.infer<typeof postDraftSchema>;
export type Post = z.infer<typeof postSchema>;
export type TrendingHashtag = z.infer<typeof trendingHashtagSchema>;
