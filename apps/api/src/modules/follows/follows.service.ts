import type { FollowState, UserSummary } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { toPage, type Page } from '../../lib/pagination';
import { toUserSummary } from '../users/users.mappers';
import type { UserPageQuery } from '../users/users.repository';
import type { FollowsRepository } from './follows.repository';

export function createFollowsService(repository: FollowsRepository) {
  /** The active user behind a username (404 otherwise). */
  async function findUserId(username: string): Promise<string> {
    const user = await repository.findActiveUserId(username);
    if (user === null) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    return user.id;
  }

  async function followState(
    username: string,
    userId: string,
    isFollowedByMe: boolean,
  ): Promise<FollowState> {
    return { username, isFollowedByMe, followersCount: await repository.countFollowers(userId) };
  }

  return {
    async follow(followerId: string, username: string): Promise<FollowState> {
      const userId = await findUserId(username);
      if (userId === followerId) {
        throw new AppError('CANNOT_FOLLOW_YOURSELF', 'You cannot follow yourself', 400);
      }
      await repository.follow(followerId, userId);
      return followState(username, userId, true);
    },

    async unfollow(followerId: string, username: string): Promise<FollowState> {
      const userId = await findUserId(username);
      await repository.unfollow(followerId, userId);
      return followState(username, userId, false);
    },

    async listFollowers(username: string, page: UserPageQuery): Promise<Page<UserSummary>> {
      const rows = await repository.listFollowers(await findUserId(username), page);
      const { items, nextCursor } = toPage(rows, page.limit, ({ id }) => id);
      return { items: items.map(({ follower }) => toUserSummary(follower)), nextCursor };
    },

    async listFollowing(username: string, page: UserPageQuery): Promise<Page<UserSummary>> {
      const rows = await repository.listFollowing(await findUserId(username), page);
      const { items, nextCursor } = toPage(rows, page.limit, ({ id }) => id);
      return { items: items.map(({ following }) => toUserSummary(following)), nextCursor };
    },
  };
}

export type FollowsService = ReturnType<typeof createFollowsService>;
