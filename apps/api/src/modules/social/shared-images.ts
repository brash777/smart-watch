import type { SharedImage } from '@snapia/shared';
import type { SnapImageUrlMap } from '../snaps/snap-images';

export interface SnapImageRecord {
  id: string;
  width: number;
  height: number;
}

/**
 * The photo of a shared snap with its signed URLs, or null when the viewer cannot view the snap
 * (snap-images.ts signs only the snaps that canViewSnap allows).
 */
export function toSharedImage(snap: SnapImageRecord, urls: SnapImageUrlMap): SharedImage | null {
  const signed = urls.get(snap.id);
  if (signed === undefined) return null;
  return { snapId: snap.id, ...signed, width: snap.width, height: snap.height };
}
