import type { Snap, SnapDetail } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import type { AvatarUrlResolver } from '../users/avatars';
import { toUserSummary } from '../users/users.mappers';
import type { SnapImageUrlMap, SnapImageUrls } from './snap-images';
import type { SnapRecord } from './snaps.repository';

/** The signed URLs of a snap (see snap-images.ts): a snap without them is never shown. */
function urlsOf(snap: SnapRecord, urls: SnapImageUrlMap): SnapImageUrls {
  const signed = urls.get(snap.id);
  if (signed === undefined) throw new AppError('FORBIDDEN', 'You cannot view this snap', 403);
  return signed;
}

/** A snap with a signed URL of its thumbnail. */
export async function toSnap(
  snap: SnapRecord,
  urls: SnapImageUrlMap,
  avatarUrl: AvatarUrlResolver,
): Promise<Snap> {
  return {
    id: snap.id,
    spaceId: snap.spaceId,
    author: await toUserSummary(snap.author, avatarUrl),
    note: snap.note,
    tags: snap.tags,
    takenAt: snap.takenAt.toISOString(),
    width: snap.width,
    height: snap.height,
    sizeBytes: snap.sizeBytes,
    mimeType: snap.mimeType,
    analysisStatus: snap.analysisStatus,
    thumbnailUrl: urlsOf(snap, urls).thumbnailUrl,
    createdAt: snap.createdAt.toISOString(),
  };
}

/** A snap with signed URLs of its thumbnail and of the full image. */
export async function toSnapDetail(
  snap: SnapRecord,
  urls: SnapImageUrlMap,
  avatarUrl: AvatarUrlResolver,
): Promise<SnapDetail> {
  return { ...(await toSnap(snap, urls, avatarUrl)), imageUrl: urlsOf(snap, urls).imageUrl };
}
