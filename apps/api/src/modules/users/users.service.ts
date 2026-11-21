import type {
  AdminUser,
  MeUser,
  PublicUserProfile,
  UpdateMeBody,
  UserRole,
  UserSummary,
} from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { toPage, type Page } from '../../lib/pagination';
import { toMeUser } from '../auth/auth.service';
import { toAdminUser, toUserSummary } from './users.mappers';
import type { AdminUserFilters, UserPageQuery, UsersRepository } from './users.repository';

const userNotFound = () => new AppError('USER_NOT_FOUND', 'User not found', 404);

export function createUsersService(repository: UsersRepository) {
  /** ADMINs cannot change their own role or status, so the app never loses its last ADMIN by mistake. */
  async function findOtherUser(actorId: string, targetId: string) {
    if (actorId === targetId) {
      throw new AppError('CANNOT_MODIFY_YOURSELF', 'You cannot change your own account here', 400);
    }
    const target = await repository.findForAdmin(targetId);
    if (target === null) throw userNotFound();
    return target;
  }

  return {
    /** Public profile; isFollowedByMe is true when the viewer follows this user. */
    async getPublicProfile(username: string, viewerId?: string): Promise<PublicUserProfile> {
      const user = await repository.findActiveProfile(username);
      if (user === null) throw userNotFound();
      const isFollowedByMe =
        viewerId !== undefined &&
        viewerId !== user.id &&
        (await repository.isFollowing(viewerId, user.id));
      return {
        ...toUserSummary(user),
        bio: user.bio,
        counts: {
          posts: user._count.posts,
          followers: user._count.followers,
          following: user._count.following,
        },
        isFollowedByMe,
      };
    },

    async updateMe(userId: string, body: UpdateMeBody): Promise<MeUser> {
      return toMeUser(await repository.updateMe(userId, body));
    },

    async search(q: string, page: UserPageQuery): Promise<Page<UserSummary>> {
      const rows = await repository.searchActive(q, page);
      return toPage(rows.map(toUserSummary), page.limit, ({ id }) => id);
    },

    async listForAdmin(filters: AdminUserFilters): Promise<Page<AdminUser>> {
      const rows = await repository.listForAdmin(filters);
      return toPage(rows.map(toAdminUser), filters.limit, ({ id }) => id);
    },

    /** Deactivated users cannot sign in and lose every session at once. */
    async setActive(actorId: string, targetId: string, isActive: boolean): Promise<AdminUser> {
      await findOtherUser(actorId, targetId);
      return toAdminUser(await repository.setActive(targetId, isActive));
    },

    async setRole(actorId: string, targetId: string, role: UserRole): Promise<AdminUser> {
      await findOtherUser(actorId, targetId);
      return toAdminUser(await repository.setRole(targetId, role));
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
