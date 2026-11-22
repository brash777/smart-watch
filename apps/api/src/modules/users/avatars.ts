import { randomUUID } from 'node:crypto';
import type { StorageProvider } from '../../lib/storage';

/**
 * Storage keys of a new profile photo: users/<userId>/avatars/<uuid>.webp and its square
 * thumbnail. Only random ids, never names, emails or other personal data.
 */
export function newAvatarKeys(userId: string): { imageKey: string; thumbnailKey: string } {
  const base = `users/${userId}/avatars/${randomUUID()}`;
  return { imageKey: `${base}.webp`, thumbnailKey: `${base}-thumb.webp` };
}

/** User.avatarKey stores the full image; its square thumbnail sits next to it. */
export function avatarThumbnailKey(avatarKey: string): string {
  return avatarKey.replace(/\.webp$/, '-thumb.webp');
}

/** Turns a User.avatarKey into a signed URL of the square avatar, or null without a photo. */
export type AvatarUrlResolver = (avatarKey: string | null) => Promise<string | null>;

export function createAvatarUrlResolver(storage: StorageProvider): AvatarUrlResolver {
  return (avatarKey) =>
    avatarKey === null
      ? Promise.resolve(null)
      : storage.getSignedUrl(avatarThumbnailKey(avatarKey));
}
