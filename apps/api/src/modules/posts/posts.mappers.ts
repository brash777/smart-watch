import type { Post } from '@snapia/shared';
import type { StorageProvider } from '../../lib/storage';
import { toSharedImage } from '../social/shared-images';
import type { AvatarUrlResolver } from '../users/avatars';
import { toUserSummary } from '../users/users.mappers';
import type { PostRecord } from './posts.repository';

export async function toPost(
  post: PostRecord,
  storage: StorageProvider,
  avatarUrl: AvatarUrlResolver,
): Promise<Post> {
  return {
    id: post.id,
    author: await toUserSummary(post.author, avatarUrl),
    caption: post.caption,
    hashtags: post.hashtags,
    visibility: post.visibility,
    media: await Promise.all(
      post.media.map(async ({ snap, altText, order }) => ({
        ...(await toSharedImage(snap, storage)),
        altText,
        order,
      })),
    ),
    likesCount: post._count.likes,
    commentsCount: post._count.comments,
    likedByMe: post.likes.length > 0,
    publishedAt: post.publishedAt.toISOString(),
  };
}
