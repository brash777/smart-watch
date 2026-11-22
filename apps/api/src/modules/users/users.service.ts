import type {
  AdminUser,
  MeUser,
  PublicUserProfile,
  UpdateMeBody,
  UserRole,
  UserSummary,
} from '@snapia/shared';
import type { Logger } from 'pino';
import { AppError } from '../../lib/app-error';
import {
  PROCESSED_IMAGE_MIME_TYPE,
  type ImageProcessor,
  type ProcessedImage,
} from '../../lib/images/image-processor';
import { mapPage, toPage, type Page } from '../../lib/pagination';
import { deleteStoredObjects, type StorageProvider } from '../../lib/storage';
import { toMeUser } from '../auth/auth.service';
import { avatarThumbnailKey, newAvatarKeys, type AvatarUrlResolver } from './avatars';
import { toAdminUser, toUserSummary } from './users.mappers';
import type { AdminUserFilters, UserPageQuery, UsersRepository } from './users.repository';

export interface UsersServiceDependencies {
  repository: UsersRepository;
  avatarUrl: AvatarUrlResolver;
  /** Where profile photos are stored. */
  storage: StorageProvider;
  images: ImageProcessor;
  logger: Logger;
}

const userNotFound = () => new AppError('USER_NOT_FOUND', 'User not found', 404);

export function createUsersService({
  repository,
  avatarUrl,
  storage,
  images,
  logger,
}: UsersServiceDependencies) {
  /** ADMINs cannot change their own role or status, so the app never loses its last ADMIN by mistake. */
  async function findOtherUser(actorId: string, targetId: string) {
    if (actorId === targetId) {
      throw new AppError('CANNOT_MODIFY_YOURSELF', 'You cannot change your own account here', 400);
    }
    const target = await repository.findForAdmin(targetId);
    if (target === null) throw userNotFound();
    return target;
  }

  /** Stores the photo and points the user at it. On failure, deletes the files it stored. */
  async function storeAvatar(userId: string, { image, thumbnail }: ProcessedImage) {
    const { imageKey, thumbnailKey } = newAvatarKeys(userId);
    const storedKeys: string[] = [];
    try {
      await storage.put(imageKey, image.buffer, PROCESSED_IMAGE_MIME_TYPE);
      storedKeys.push(imageKey);
      await storage.put(thumbnailKey, thumbnail.buffer, PROCESSED_IMAGE_MIME_TYPE);
      storedKeys.push(thumbnailKey);
      return await repository.replaceAvatarKey(userId, imageKey);
    } catch (error) {
      await deleteStoredObjects(storage, storedKeys, logger);
      throw error;
    }
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
        ...(await toUserSummary(user, avatarUrl)),
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
      return toMeUser(await repository.updateMe(userId, body), avatarUrl);
    },

    /**
     * Sets the signed-in user's profile photo. It is processed like a snap (rotated, without
     * EXIF or GPS, resized, WebP) with a square thumbnail, and the previous photo is deleted.
     */
    async setAvatar(userId: string, file: Buffer | undefined): Promise<MeUser> {
      if (file === undefined) {
        throw new AppError('NO_FILES', 'Send a photo in the avatar field', 400);
      }
      const { user, previousAvatarKey } = await storeAvatar(
        userId,
        await images.processAvatar(file),
      );
      if (previousAvatarKey !== null) {
        await deleteStoredObjects(
          storage,
          [previousAvatarKey, avatarThumbnailKey(previousAvatarKey)],
          logger,
        );
      }
      return toMeUser(user, avatarUrl);
    },

    async search(q: string, page: UserPageQuery): Promise<Page<UserSummary>> {
      const rows = await repository.searchActive(q, page);
      return mapPage(
        toPage(rows, page.limit, ({ id }) => id),
        (user) => toUserSummary(user, avatarUrl),
      );
    },

    async listForAdmin(filters: AdminUserFilters): Promise<Page<AdminUser>> {
      const rows = await repository.listForAdmin(filters);
      return mapPage(
        toPage(rows, filters.limit, ({ id }) => id),
        (user) => toAdminUser(user, avatarUrl),
      );
    },

    /** Deactivated users cannot sign in and lose every session at once. */
    async setActive(actorId: string, targetId: string, isActive: boolean): Promise<AdminUser> {
      await findOtherUser(actorId, targetId);
      return toAdminUser(await repository.setActive(targetId, isActive), avatarUrl);
    },

    async setRole(actorId: string, targetId: string, role: UserRole): Promise<AdminUser> {
      await findOtherUser(actorId, targetId);
      return toAdminUser(await repository.setRole(targetId, role), avatarUrl);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
