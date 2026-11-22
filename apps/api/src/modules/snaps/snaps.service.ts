import type { Snap, SnapDetail, SpaceRole, UpdateSnapBody } from '@snapia/shared';
import type { Logger } from 'pino';
import { AppError } from '../../lib/app-error';
import type { EventBus } from '../../lib/events';
import { PROCESSED_IMAGE_MIME_TYPE, type ImageProcessor } from '../../lib/images/image-processor';
import { toPage, type Page } from '../../lib/pagination';
import type { StorageProvider } from '../../lib/storage';
import {
  effectiveSpaceRole,
  hasSpaceRole,
  type SpaceAccess,
} from '../../middlewares/require-space-role';
import type { SettingsService } from '../settings/settings.service';
import type { SpacesRepository } from '../spaces/spaces.repository';
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
}

export interface SnapUploadFields {
  note?: string | null | undefined;
  tags?: string[] | undefined;
}

export function createSnapsService(deps: SnapsServiceDependencies) {
  const { repository, storage } = deps;

  /** Deletes storage objects; a failure only leaves an orphan file, so it is logged, not thrown. */
  async function deleteObjects(keys: readonly string[]): Promise<void> {
    const results = await Promise.allSettled(keys.map((key) => storage.delete(key)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        deps.logger.warn(
          { err: result.reason, key: keys[index] },
          'Could not delete a stored file',
        );
      }
    });
  }

  /** The snap and the caller's role in its Space, checked like requireSpaceRole('VIEWER'). */
  async function findSnapForUser(snapId: string, userId: string | undefined) {
    const snap = await repository.findById(snapId);
    if (snap === null) throw new AppError('SNAP_NOT_FOUND', 'Snap not found', 404);
    const access = await deps.spaces.findAccess(snap.spaceId, userId);
    const role = access === null ? null : effectiveSpaceRole(access.visibility, access.memberRole);
    if (role === null && userId === undefined) {
      throw new AppError('UNAUTHENTICATED', 'Sign in to continue', 401);
    }
    if (role === null) throw new AppError('FORBIDDEN', 'You are not a member of this Space', 403);
    return { snap, memberRole: access?.memberRole ?? null };
  }

  /** Only the author (while EDITOR or OWNER) or an OWNER of the Space changes or deletes a snap. */
  function assertCanModify(snap: SnapRecord, userId: string, memberRole: SpaceRole | null): void {
    const isOwner = memberRole === 'OWNER';
    const isActiveAuthor =
      snap.authorId === userId && memberRole !== null && hasSpaceRole(memberRole, 'EDITOR');
    if (!isOwner && !isActiveAuthor) {
      throw new AppError(
        'FORBIDDEN',
        'Only the author or an OWNER of the Space can change this snap',
        403,
      );
    }
  }

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
      return Promise.all(created.map((snap) => toSnap(snap, storage)));
    },

    async list(access: SpaceAccess, filters: SnapFilters): Promise<Page<Snap>> {
      const rows = await repository.listInSpace(access.spaceId, filters);
      const { items, nextCursor } = toPage(rows, filters.limit, ({ id }) => id);
      return { items: await Promise.all(items.map((snap) => toSnap(snap, storage))), nextCursor };
    },

    async get(snapId: string, userId: string | undefined): Promise<SnapDetail> {
      const { snap } = await findSnapForUser(snapId, userId);
      return toSnapDetail(snap, storage);
    },

    async update(snapId: string, userId: string, body: UpdateSnapBody): Promise<Snap> {
      const { snap, memberRole } = await findSnapForUser(snapId, userId);
      assertCanModify(snap, userId, memberRole);
      return toSnap(await repository.update(snap.id, body), storage);
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
