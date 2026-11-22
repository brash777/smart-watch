import { randomUUID } from 'node:crypto';

/**
 * Storage keys of a new snap: spaces/<spaceId>/snaps/<uuid>.webp and its thumbnail.
 * Only random ids, never names, emails or other personal data.
 */
export function newSnapStorageKeys(spaceId: string): { imageKey: string; thumbnailKey: string } {
  const base = `spaces/${spaceId}/snaps/${randomUUID()}`;
  return { imageKey: `${base}.webp`, thumbnailKey: `${base}-thumb.webp` };
}
