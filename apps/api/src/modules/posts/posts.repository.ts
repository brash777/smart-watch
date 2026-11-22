import type { PostVisibility } from '@snapia/shared';
import { pageArgs } from '../../lib/pagination';
import type { PrismaClient } from '../../lib/prisma';
import { fromViewerOrFollowed, visiblePostsWhere } from '../social/social-visibility';
import { userSummarySelect } from '../users/users.repository';

/** A Post with its counts and whether the viewer liked it. */
function postSelect(viewerId: string | undefined) {
  return {
    id: true,
    authorId: true,
    caption: true,
    hashtags: true,
    visibility: true,
    publishedAt: true,
    author: { select: userSummarySelect },
    media: {
      orderBy: { order: 'asc' },
      select: {
        order: true,
        altText: true,
        snap: {
          select: { id: true, storageKey: true, thumbnailKey: true, width: true, height: true },
        },
      },
    },
    _count: { select: { likes: true, comments: { where: { hiddenAt: null } } } },
    likes: {
      where: { userId: { in: viewerId === undefined ? [] : [viewerId] } },
      select: { id: true },
      take: 1,
    },
  } as const;
}

const newestFirst = [{ publishedAt: 'desc' as const }, { id: 'desc' as const }];

export interface NewPost {
  authorId: string;
  /** The Space of the snaps when they all come from one. */
  spaceId: string | null;
  caption: string;
  hashtags: string[];
  visibility: PostVisibility;
  /** In the order they are shown. */
  media: { snapId: string; altText: string | null }[];
}

export interface PostPage {
  cursor?: string | undefined;
  limit: number;
}

export function createPostsRepository(prisma: PrismaClient) {
  return {
    create({ media, ...post }: NewPost) {
      return prisma.post.create({
        data: {
          ...post,
          media: { create: media.map((item, index) => ({ ...item, order: index + 1 })) },
        },
        select: postSelect(post.authorId),
      });
    },

    /** The posts of the viewer and of the people they follow, newest first. */
    feed(viewerId: string, page: PostPage) {
      return prisma.post.findMany({
        where: { AND: [visiblePostsWhere(viewerId), fromViewerOrFollowed(viewerId)] },
        orderBy: newestFirst,
        select: postSelect(viewerId),
        ...pageArgs(page),
      });
    },

    /** The posts of one author that the viewer may see (the portfolio), newest first. */
    byAuthor(authorId: string, viewerId: string | undefined, page: PostPage) {
      return prisma.post.findMany({
        where: { AND: [visiblePostsWhere(viewerId), { authorId }] },
        orderBy: newestFirst,
        select: postSelect(viewerId),
        ...pageArgs(page),
      });
    },

    /** PUBLIC posts, optionally with a hashtag, newest first. */
    explore(hashtag: string | undefined, viewerId: string | undefined, page: PostPage) {
      return prisma.post.findMany({
        where: {
          AND: [
            visiblePostsWhere(undefined),
            hashtag === undefined ? {} : { hashtags: { has: hashtag } },
          ],
        },
        orderBy: newestFirst,
        select: postSelect(viewerId),
        ...pageArgs(page),
      });
    },

    /** The hashtags of the most PUBLIC posts published since the given date. */
    trendingHashtags(since: Date, limit: number) {
      return prisma.$queryRaw<{ hashtag: string; postsCount: number }[]>`
        SELECT tag AS hashtag, count(*)::int AS "postsCount"
        FROM posts p
        JOIN users u ON u.id = p.author_id
        CROSS JOIN LATERAL unnest(p.hashtags) AS tag
        WHERE p.visibility = 'PUBLIC'
          AND p.hidden_at IS NULL
          AND u.is_active
          AND p.published_at >= ${since}
        GROUP BY tag
        ORDER BY "postsCount" DESC, tag ASC
        LIMIT ${limit}`;
    },

    findById(id: string) {
      return prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
    },

    async delete(id: string): Promise<void> {
      await prisma.post.delete({ where: { id } });
    },

    /** The id of an active user, by username. */
    async findActiveUserId(username: string): Promise<string | null> {
      const user = await prisma.user.findFirst({
        where: { username, isActive: true },
        select: { id: true },
      });
      return user?.id ?? null;
    },
  };
}

export type PostsRepository = ReturnType<typeof createPostsRepository>;
export type PostRecord = Awaited<ReturnType<PostsRepository['create']>>;
