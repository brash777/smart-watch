import type { SharedImage } from '@snapia/shared';
import type { StorageProvider } from '../../lib/storage';

export interface SnapImageRecord {
  id: string;
  storageKey: string;
  thumbnailKey: string;
  width: number;
  height: number;
}

/** The photo of a shared snap with signed URLs (valid for SIGNED_URL_TTL_SECONDS). */
export async function toSharedImage(
  snap: SnapImageRecord,
  storage: StorageProvider,
): Promise<SharedImage> {
  return {
    snapId: snap.id,
    imageUrl: await storage.getSignedUrl(snap.storageKey),
    thumbnailUrl: await storage.getSignedUrl(snap.thumbnailKey),
    width: snap.width,
    height: snap.height,
  };
}
