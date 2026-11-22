import type { LikeState } from '@snapia/shared';
import type { PostAccess } from '../social/post-access';
import type { LikesRepository } from './likes.repository';

export function createLikesService({
  repository,
  posts,
}: {
  repository: LikesRepository;
  posts: PostAccess;
}) {
  return {
    /** Likes the post, or takes the like back (double tap). */
    async toggle(postId: string, userId: string): Promise<LikeState> {
      const post = await posts.findForViewer(postId, userId);
      const liked = await repository.toggle(post.id, userId);
      return { liked, likesCount: await repository.countForPost(post.id) };
    },
  };
}

export type LikesService = ReturnType<typeof createLikesService>;
