import type { Comment, CreateCommentBody } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { mapPage, toPage, type Page } from '../../lib/pagination';
import type { SettingsService } from '../settings/settings.service';
import type { PostAccess } from '../social/post-access';
import type { AvatarUrlResolver } from '../users/avatars';
import { toUserSummary } from '../users/users.mappers';
import type { CommentRecord, CommentsRepository } from './comments.repository';

export interface CommentsServiceDependencies {
  repository: CommentsRepository;
  posts: PostAccess;
  settings: SettingsService;
  avatarUrl: AvatarUrlResolver;
}

export function createCommentsService({
  repository,
  posts,
  settings,
  avatarUrl,
}: CommentsServiceDependencies) {
  async function present(comment: CommentRecord): Promise<Comment> {
    return {
      id: comment.id,
      postId: comment.postId,
      author: await toUserSummary(comment.user, avatarUrl),
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  return {
    /** Comments on a post the user can see, in at most comment_max_length characters. */
    async create(postId: string, userId: string, { body }: CreateCommentBody): Promise<Comment> {
      const post = await posts.findForViewer(postId, userId);
      const maxLength = await settings.getSetting('comment_max_length');
      if (body.length > maxLength) {
        throw new AppError(
          'COMMENT_TOO_LONG',
          `A comment has at most ${String(maxLength)} characters`,
          400,
          { maxLength },
        );
      }
      return present(await repository.create({ postId: post.id, userId, body }));
    },

    /** The comments of a post the viewer can see, the oldest first. */
    async list(
      postId: string,
      viewerId: string | undefined,
      page: { cursor?: string | undefined; limit: number },
    ): Promise<Page<Comment>> {
      const post = await posts.findForViewer(postId, viewerId);
      const rows = await repository.listForPost(post.id, page);
      return mapPage(
        toPage(rows, page.limit, ({ id }) => id),
        present,
      );
    },

    /** The author of the comment or the author of the post deletes it. */
    async remove(commentId: string, userId: string): Promise<void> {
      const comment = await repository.findWithPostAuthor(commentId);
      if (comment === null) throw new AppError('COMMENT_NOT_FOUND', 'Comment not found', 404);
      if (comment.userId !== userId && comment.post.authorId !== userId) {
        throw new AppError(
          'FORBIDDEN',
          'Only the author of the comment or of the post can delete it',
          403,
        );
      }
      await repository.delete(comment.id);
    },
  };
}

export type CommentsService = ReturnType<typeof createCommentsService>;
