import {
  contentSnapInsightSchema,
  type ContentSnapInsight,
  type CreatePostBody,
  type Post,
  type PostDraft,
  type PostDraftBody,
  type TrendingHashtag,
} from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { mapPage, toPage, type Page } from '../../lib/pagination';
import type { StorageProvider } from '../../lib/storage';
import type { SnapInsightData } from '../ai/snap-context';
import type { PostDraftTask } from '../ai/tasks/post-draft';
import type { SettingsService } from '../settings/settings.service';
import { toAnalyzedSnap } from '../snap-insights/snap-selection';
import type { SnapSharing } from '../social/snap-sharing';
import type { SnapToShare } from '../social/snap-sharing.repository';
import type { AvatarUrlResolver } from '../users/avatars';
import { toPost } from './posts.mappers';
import type { PostPage, PostsRepository } from './posts.repository';

const MS_PER_DAY = 86_400_000;

export interface PostsServiceDependencies {
  repository: PostsRepository;
  sharing: SnapSharing;
  draftTask: PostDraftTask;
  settings: SettingsService;
  storage: StorageProvider;
  avatarUrl: AvatarUrlResolver;
}

/** The alt text the AI wrote for a snap of a CONTENT Space. */
function contentAltText(snap: SnapToShare): string | null {
  if (snap.insight?.mode !== 'CONTENT') return null;
  const parsed = contentSnapInsightSchema.safeParse(snap.insight.data);
  return parsed.success ? parsed.data.altText : null;
}

function isContentInsight(insight: SnapInsightData): insight is ContentSnapInsight {
  return 'suggestedCaption' in insight;
}

/** The Space of the snaps when they all come from one. */
function commonSpaceId(snaps: readonly SnapToShare[]): string | null {
  const spaceIds = new Set(snaps.map(({ spaceId }) => spaceId));
  return spaceIds.size === 1 ? (snaps[0]?.spaceId ?? null) : null;
}

export function createPostsService({
  repository,
  sharing,
  draftTask,
  settings,
  storage,
  avatarUrl,
}: PostsServiceDependencies) {
  /** The author's own snaps, at most max_snaps_per_post, in the given order. */
  async function snapsForPost(userId: string, snapIds: readonly string[]): Promise<SnapToShare[]> {
    const limit = await settings.getSetting('max_snaps_per_post');
    if (snapIds.length > limit) {
      throw new AppError('TOO_MANY_SNAPS', `A post has at most ${String(limit)} snaps`, 400, {
        limit,
      });
    }
    return sharing.snapsToShare(userId, snapIds);
  }

  function present(posts: Page<Parameters<typeof toPost>[0]>): Promise<Page<Post>> {
    return mapPage(posts, (post) => toPost(post, storage, avatarUrl));
  }

  return {
    /** Publishes the author's snaps as a Post (alt texts come from CONTENT insights). */
    async create(userId: string, body: CreatePostBody): Promise<Post> {
      const snaps = await snapsForPost(userId, body.snapIds);
      const post = await repository.create({
        authorId: userId,
        spaceId: commonSpaceId(snaps),
        caption: body.caption,
        hashtags: body.hashtags,
        visibility: body.visibility,
        media: snaps.map((snap) => ({ snapId: snap.id, altText: contentAltText(snap) })),
      });
      return toPost(post, storage, avatarUrl);
    },

    /**
     * A suggested caption and hashtags. Snaps of CONTENT Spaces already have them in their
     * insights; for the others, a short AI call writes them. The snaps must be analyzed.
     */
    async draft(userId: string, { snapIds }: PostDraftBody): Promise<PostDraft> {
      const snaps = await snapsForPost(userId, snapIds);
      const notAnalyzed = snaps
        .filter((snap) => snap.analysisStatus !== 'DONE' || snap.insight === null)
        .map(({ id }) => id);
      if (notAnalyzed.length > 0) {
        throw new AppError('SNAPS_NOT_ANALYZED', 'Some snaps are not analyzed yet', 409, {
          snapIds: notAnalyzed,
        });
      }
      const analyzed = snaps.map(toAnalyzedSnap);
      const contentInsights = analyzed.map(({ insight }) => insight).filter(isContentInsight);
      const [first] = contentInsights;
      if (first !== undefined && contentInsights.length === analyzed.length) {
        const defaultHashtags = await settings.getSetting('default_hashtags');
        return {
          caption: first.suggestedCaption,
          hashtags: [
            ...new Set([
              ...defaultHashtags,
              ...contentInsights.flatMap(({ hashtags }) => hashtags),
            ]),
          ],
        };
      }
      return draftTask.draft({ snaps: analyzed, userId, spaceId: commonSpaceId(snaps) });
    },

    /** The posts of the people the user follows and the user's own. */
    async feed(userId: string, page: PostPage): Promise<Page<Post>> {
      const rows = await repository.feed(userId, page);
      return present(toPage(rows, page.limit, ({ id }) => id));
    },

    /** A user's posts that the viewer may see: the public ones, or all of them for followers. */
    async portfolio(
      username: string,
      viewerId: string | undefined,
      page: PostPage,
    ): Promise<Page<Post>> {
      const authorId = await repository.findActiveUserId(username);
      if (authorId === null) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      const rows = await repository.byAuthor(authorId, viewerId, page);
      return present(toPage(rows, page.limit, ({ id }) => id));
    },

    /** PUBLIC posts, newest first, optionally with one hashtag. */
    async explore(
      hashtag: string | undefined,
      viewerId: string | undefined,
      page: PostPage,
    ): Promise<Page<Post>> {
      const rows = await repository.explore(hashtag, viewerId, page);
      return present(toPage(rows, page.limit, ({ id }) => id));
    },

    /** The hashtags of the most PUBLIC posts of the last trending_hashtags_days days. */
    async trending(limit: number): Promise<TrendingHashtag[]> {
      const days = await settings.getSetting('trending_hashtags_days');
      return repository.trendingHashtags(new Date(Date.now() - days * MS_PER_DAY), limit);
    },

    /** Only the author deletes a Post (ADMIN moderation comes with the admin panel). */
    async remove(postId: string, userId: string): Promise<void> {
      const post = await repository.findById(postId);
      if (post === null) throw new AppError('POST_NOT_FOUND', 'Post not found', 404);
      if (post.authorId !== userId) {
        throw new AppError('FORBIDDEN', 'Only the author can delete this post', 403);
      }
      await repository.delete(post.id);
    },
  };
}

export type PostsService = ReturnType<typeof createPostsService>;
