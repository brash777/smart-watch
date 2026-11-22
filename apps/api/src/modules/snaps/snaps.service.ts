import type { Snap, SnapDetail, UpdateSnapBody } from '@snapia/shared';
import type { Logger } from 'pino';
import { AppError } from '../../lib/app-error';
import type { EventBus } from '../../lib/events';
import { PROCESSED_IMAGE_MIME_TYPE, type ImageProcessor } from '../../lib/images/image-processor';
import { toPage, type Page } from '../../lib/pagination';
import { deleteStoredObjects, type StorageProvider } from '../../lib/storage';
import type { SpaceAccess } from '../../middlewares/require-space-role';
import type { SettingsService } from '../settings/settings.service';
import type { SpacesRepository } from '../spaces/spaces.repository';
import type { AvatarUrlResolver } from '../users/avatars';
import type { SnapImages } from './snap-images';
import { createSnapPermissions } from './snap-permissions';
import { newSnapStorageKeys } from './snap-storage-keys';
import { toSnap, toSnapDetail } from './snaps.mappers';
import type { NewSnap, SnapFilters, SnapRecord, SnapsRepository } from './snaps.repository';

export interface SnapsServiceDependencies {
  repository: SnapsRepository;
  spaces: SpacesRepository;
  storage: StorageProvider;
  images: ImageProcessor;
  settings: SettingsService;
  events: EventBus;
  logger: Logger;
  avatarUrl: AvatarUrlResolver;
  /** Signs the photo URLs of the snaps the viewer can view (canViewSnap). */
  snapImages: SnapImages;
}

export interface SnapUploadFields {
  note?: string | null | undefined;
  tags?: string[] | undefined;
}

export function createSnapsService(deps: SnapsServiceDependencies) {
  const { repository, storage, avatarUrl, snapImages } = deps;

  function deleteObjects(keys: readonly string[]): Promise<void> {
    return deleteStoredObjects(storage, keys, deps.logger);
  }

  /** The snaps with the photo URLs the viewer may get. */
  async function present(viewerId: string | undefined, snaps: SnapRecord[]): Promise<Snap[]> {
    const urls = await snapImages.signedUrls(viewerId, snaps);
    return Promise.all(snaps.map((snap) => toSnap(snap, urls, avatarUrl)));
  }

  const { findSnapForUser, assertCanModify } = createSnapPermissions({
    snaps: repository,
    spaces: deps.spaces,
  });

  return {
    /**
     * Uploads photos to a Space (EDITOR or OWNER). Every photo is checked and cleaned first,
     * so one bad file stores nothing. Each new snap is PENDING and emits snap.created.
     */
    async upload(
      access: SpaceAccess,
      authorId: string,
      files: readonly Buffer[],
      fields: SnapUploadFields,
    ): Promise<Snap[]> {
      if (files.length === 0) throw new AppError('NO_FILES', 'Send at least one photo', 400);
      if (access.archived) {
        throw new AppError('SPACE_ARCHIVED', 'This Space is archived and accepts no snaps', 409);
      }
      const limit = await deps.settings.getSetting('max_snaps_per_space');
      const current = await repository.countInSpace(access.spaceId);
      if (current + files.length > limit) {
        throw new AppError(
          'SNAP_LIMIT_REACHED',
          `A Space can have at most ${String(limit)} snaps`,
          409,
          {
            limit,
            current,
          },
        );
      }

      const photos = await Promise.all(files.map((file) => deps.images.processPhoto(file)));
      const uploadedAt = new Date();
      const storedKeys: string[] = [];
      let created: SnapRecord[];
      try {
        const newSnaps: NewSnap[] = [];
        for (const photo of photos) {
          const { imageKey, thumbnailKey } = newSnapStorageKeys(access.spaceId);
          await storage.put(imageKey, photo.image.buffer, PROCESSED_IMAGE_MIME_TYPE);
          storedKeys.push(imageKey);
          await storage.put(thumbnailKey, photo.thumbnail.buffer, PROCESSED_IMAGE_MIME_TYPE);
          storedKeys.push(thumbnailKey);
          newSnaps.push({
            spaceId: access.spaceId,
            authorId,
            storageKey: imageKey,
            thumbnailKey,
            width: photo.image.width,
            height: photo.image.height,
            sizeBytes: photo.image.sizeBytes,
            mimeType: PROCESSED_IMAGE_MIME_TYPE,
            note: fields.note ?? null,
            tags: fields.tags ?? [],
            takenAt: photo.takenAt ?? uploadedAt,
          });
        }
        created = await repository.createMany(newSnaps);
      } catch (error) {
        await deleteObjects(storedKeys);
        throw error;
      }

      for (const snap of created) deps.events.emit('snap.created', { snapId: snap.id });
      return present(authorId, created);
    },

    async list(
      access: SpaceAccess,
      viewerId: string | undefined,
      filters: SnapFilters,
    ): Promise<Page<Snap>> {
      const rows = await repository.listInSpace(access.spaceId, filters);
      const page = toPage(rows, filters.limit, ({ id }) => id);
      return { items: await present(viewerId, page.items), nextCursor: page.nextCursor };
    },

    async get(snapId: string, userId: string | undefined): Promise<SnapDetail> {
      const { snap } = await findSnapForUser(snapId, userId);
      return toSnapDetail(snap, await snapImages.signedUrls(userId, [snap]), avatarUrl);
    },

    async update(snapId: string, userId: string, body: UpdateSnapBody): Promise<Snap> {
      const { snap, memberRole } = await findSnapForUser(snapId, userId);
      assertCanModify(snap, userId, memberRole);
      const [updated] = await present(userId, [await repository.update(snap.id, body)]);
      if (updated === undefined) throw new Error('The updated snap is missing');
      return updated;
    },

    /** Deletes the snap from the database, then its files from storage. */
    async remove(snapId: string, userId: string): Promise<void> {
      const { snap, memberRole } = await findSnapForUser(snapId, userId);
      assertCanModify(snap, userId, memberRole);
      await repository.delete(snap.id);
      await deleteObjects([snap.storageKey, snap.thumbnailKey]);
    },
  };
}

export type SnapsService = ReturnType<typeof createSnapsService>;
