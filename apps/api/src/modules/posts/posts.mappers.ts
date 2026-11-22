import type { Post } from '@snapia/shared';
import type { SnapImageUrlMap } from '../snaps/snap-images';
import { toSharedImage } from '../social/shared-images';
import type { AvatarUrlResolver } from '../users/avatars';
import { toUserSummary } from '../users/users.mappers';
import type { PostRecord } from './posts.repository';

/** A Post for the viewer. A photo the viewer cannot view (canViewSnap) is left out. */
export async function toPost(
  post: PostRecord,
  urls: SnapImageUrlMap,
  avatarUrl: AvatarUrlResolver,
): Promise<Post> {
  return {
    id: post.id,
    author: await toUserSummary(post.author, avatarUrl),
    caption: post.caption,
    hashtags: post.hashtags,
    visibility: post.visibility,
    media: post.media.flatMap(({ snap, altText, order }) => {
      const image = toSharedImage(snap, urls);
      return image === null ? [] : [{ ...image, altText, order }];
    }),
    likesCount: post._count.likes,
    commentsCount: post._count.comments,
    likedByMe: post.likes.length > 0,
    publishedAt: post.publishedAt.toISOString(),
  };
}
