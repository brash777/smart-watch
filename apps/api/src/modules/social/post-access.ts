import { AppError } from '../../lib/app-error';
import type { PostAccessRepository } from './post-access.repository';

/** Who may see a Post, for the routes under /api/posts/:id (likes and comments). */
export function createPostAccess(repository: PostAccessRepository) {
  return {
    /**
     * The Post, when the viewer may see it: 404 when it does not exist or is hidden, 401
     * without a session and 403 for a FOLLOWERS post of someone the viewer does not follow.
     */
    async findForViewer(postId: string, viewerId: string | undefined) {
      const post = await repository.findShown(postId);
      if (post === null) throw new AppError('POST_NOT_FOUND', 'Post not found', 404);
      if (!(await repository.isVisible(post.id, viewerId))) {
        if (viewerId === undefined)
          throw new AppError('UNAUTHENTICATED', 'Sign in to continue', 401);
        throw new AppError('FORBIDDEN', 'This post is only for the followers of its author', 403);
      }
      return post;
    },
  };
}

export type PostAccess = ReturnType<typeof createPostAccess>;
