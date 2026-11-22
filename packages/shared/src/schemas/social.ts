import { z } from 'zod';
import { userSummarySchema } from './auth';
import { snapSelectionSchema } from './documents';
import { momentAudienceSchema, postVisibilitySchema } from './enums';
import { hashtagSchema } from './snap-insights';

/*
 * The social layer (docs/PRODUCT.md, "Social layer"): Moments, Posts, the feed and Explore.
 * A snap leaves its Space only when its author shares it as a Moment or a Post.
 */

const count = z.number().int().nonnegative();

/** Hashtags in lowercase, without # and without repeats. */
export const hashtagListSchema = z.array(hashtagSchema).transform((tags) => [...new Set(tags)]);

/** The photo of a snap shown outside its Space, with temporary (signed) URLs. */
export const sharedImageSchema = z.object({
  snapId: z.uuid(),
  imageUrl: z.string(),
  thumbnailUrl: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/** POST /api/moments */
export const createMomentBodySchema = z.object({
  snapId: z.uuid(),
  audience: momentAudienceSchema,
});

/** A Moment: a snap shared until expiresAt (moment_ttl_hours after it was shared). */
export const momentSchema = z.object({
  id: z.uuid(),
  author: userSummarySchema,
  audience: momentAudienceSchema,
  image: sharedImageSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  viewedByMe: z.boolean(),
  /** How many people saw it: only for your own Moments, null for the others. */
  viewsCount: count.nullable(),
});

/** GET /api/moments/feed: the Moments of one author, the oldest first. */
export const momentGroupSchema = z.object({
  author: userSummarySchema,
  moments: z.array(momentSchema),
  /** True when one of them is still unseen. */
  hasUnseen: z.boolean(),
});

/** POST /api/posts */
export const createPostBodySchema = z.object({
  /** In the order they are shown; at most max_snaps_per_post. */
  snapIds: snapSelectionSchema,
  caption: z.string().trim(),
  hashtags: hashtagListSchema.default([]),
  visibility: postVisibilitySchema.default('PUBLIC'),
});

/** POST /api/posts/draft */
export const postDraftBodySchema = z.object({ snapIds: snapSelectionSchema });

/** A suggested caption and hashtags for a Post (also what the AI writes for POST_DRAFT). */
export const postDraftSchema = z.object({
  caption: z.string().trim().min(1),
  hashtags: hashtagListSchema,
});

/** A Post. */
export const postSchema = z.object({
  id: z.uuid(),
  author: userSummarySchema,
  caption: z.string(),
  hashtags: z.array(z.string()),
  visibility: postVisibilitySchema,
  media: z.array(
    sharedImageSchema.extend({
      altText: z.string().nullable(),
      order: z.number().int().positive(),
    }),
  ),
  likesCount: count,
  commentsCount: count,
  likedByMe: z.boolean(),
  publishedAt: z.iso.datetime(),
});

/** GET /api/explore/trending */
export const trendingHashtagSchema = z.object({
  hashtag: z.string(),
  postsCount: z.number().int().positive(),
});

/** POST /api/posts/:id/like: the like after the toggle. */
export const likeStateSchema = z.object({ liked: z.boolean(), likesCount: count });

/** POST /api/posts/:id/comments (the maximum length is the comment_max_length setting). */
export const createCommentBodySchema = z.object({ body: z.string().trim().min(1) });

/** A Comment on a Post. */
export const commentSchema = z.object({
  id: z.uuid(),
  postId: z.uuid(),
  author: userSummarySchema,
  body: z.string(),
  createdAt: z.iso.datetime(),
});
