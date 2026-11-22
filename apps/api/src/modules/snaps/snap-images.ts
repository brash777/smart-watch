import type { StorageProvider } from '../../lib/storage';
import type { SnapVisibility } from './snap-visibility';

export interface SnapFiles {
  id: string;
  storageKey: string;
  thumbnailKey: string;
}

export interface SnapImageUrls {
  imageUrl: string;
  thumbnailUrl: string;
}

export type SnapImageUrlMap = ReadonlyMap<string, SnapImageUrls>;

/**
 * The only place where snap photos get URLs: signed URLs (valid for SIGNED_URL_TTL_SECONDS) for
 * the snaps the viewer can view (canViewSnap), and none for the others.
 */
export function createSnapImages({
  storage,
  visibility,
}: {
  storage: StorageProvider;
  visibility: SnapVisibility;
}) {
  return {
    async signedUrls(
      viewerId: string | undefined,
      snaps: readonly SnapFiles[],
    ): Promise<Map<string, SnapImageUrls>> {
      const visible = await visibility.visibleSnapIds(viewerId, [
        ...new Set(snaps.map(({ id }) => id)),
      ]);
      const signed = await Promise.all(
        snaps
          .filter(({ id }) => visible.has(id))
          .map(
            async ({ id, storageKey, thumbnailKey }) =>
              [
                id,
                {
                  imageUrl: await storage.getSignedUrl(storageKey),
                  thumbnailUrl: await storage.getSignedUrl(thumbnailKey),
                },
              ] as const,
          ),
      );
      return new Map(signed);
    },
  };
}

export type SnapImages = ReturnType<typeof createSnapImages>;
