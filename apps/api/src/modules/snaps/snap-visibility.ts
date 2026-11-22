import type { SnapVisibilityRepository } from './snap-visibility.repository';

/**
 * The privacy rule of snaps (docs/PRODUCT.md, "Snaps outside their Space"): a user can view a
 * snap when they can see its Space (they are a member, or the Space is PUBLIC), or when the snap
 * is in a Post or an active Moment they may see. Every snap image URL goes through it
 * (snap-images.ts).
 */
export function createSnapVisibility(repository: SnapVisibilityRepository) {
  async function visibleSnapIds(
    viewerId: string | undefined,
    snapIds: readonly string[],
  ): Promise<Set<string>> {
    if (snapIds.length === 0) return new Set();
    return new Set(await repository.findVisibleIds(viewerId, snapIds, new Date()));
  }

  return {
    /** canViewSnap(user, snapId). viewerId is undefined for people without a session. */
    async canViewSnap(viewerId: string | undefined, snapId: string): Promise<boolean> {
      return (await visibleSnapIds(viewerId, [snapId])).has(snapId);
    },

    /** The same rule for many snaps at once. */
    visibleSnapIds,
  };
}

export type SnapVisibility = ReturnType<typeof createSnapVisibility>;
