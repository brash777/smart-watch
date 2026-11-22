import type { Snap, SnapDetail } from '@snapia/shared';
import type { StorageProvider } from '../../lib/storage';
import { toUserSummary } from '../users/users.mappers';
import type { SnapRecord } from './snaps.repository';

/** A snap with a signed URL of its thumbnail (valid for SIGNED_URL_TTL_SECONDS). */
export async function toSnap(snap: SnapRecord, storage: StorageProvider): Promise<Snap> {
  return {
    id: snap.id,
    spaceId: snap.spaceId,
    author: toUserSummary(snap.author),
    note: snap.note,
    tags: snap.tags,
    takenAt: snap.takenAt.toISOString(),
    width: snap.width,
    height: snap.height,
    sizeBytes: snap.sizeBytes,
    mimeType: snap.mimeType,
    analysisStatus: snap.analysisStatus,
    thumbnailUrl: await storage.getSignedUrl(snap.thumbnailKey),
    createdAt: snap.createdAt.toISOString(),
  };
}

/** A snap with signed URLs of its thumbnail and of the full image. */
export async function toSnapDetail(
  snap: SnapRecord,
  storage: StorageProvider,
): Promise<SnapDetail> {
  return {
    ...(await toSnap(snap, storage)),
    imageUrl: await storage.getSignedUrl(snap.storageKey),
  };
}
