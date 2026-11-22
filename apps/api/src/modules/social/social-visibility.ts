import type { Prisma } from '../../generated/prisma/client';

/*
 * Who sees what in the social layer (docs/PRODUCT.md, "Social layer"), as Prisma filters for the
 * repositories. Posts hidden by an ADMIN and the content of deactivated users are never shown.
 */

/** The viewer follows the author. */
function followedBy(viewerId: string) {
  return { followers: { some: { followerId: viewerId } } };
}

/**
 * Posts the viewer may see: PUBLIC ones, FOLLOWERS ones when the viewer follows the author, and
 * the viewer's own.
 */
export function visiblePostsWhere(viewerId: string | undefined): Prisma.PostWhereInput {
  return {
    hiddenAt: null,
    author: { isActive: true },
    OR:
      viewerId === undefined
        ? [{ visibility: 'PUBLIC' }]
        : [
            { visibility: 'PUBLIC' },
            { authorId: viewerId },
            { visibility: 'FOLLOWERS', author: followedBy(viewerId) },
          ],
  };
}

/**
 * Moments the viewer may see before they expire: PUBLIC ones, FOLLOWERS ones when the viewer
 * follows the author, SPACE_MEMBERS ones when the viewer is a member of the Space, and the
 * viewer's own.
 */
export function visibleMomentsWhere(
  viewerId: string | undefined,
  now: Date,
): Prisma.MomentWhereInput {
  return {
    expiresAt: { gt: now },
    author: { isActive: true },
    OR:
      viewerId === undefined
        ? [{ audience: 'PUBLIC' }]
        : [
            { audience: 'PUBLIC' },
            { authorId: viewerId },
            { audience: 'FOLLOWERS', author: followedBy(viewerId) },
            { audience: 'SPACE_MEMBERS', space: { members: { some: { userId: viewerId } } } },
          ],
  };
}

/** Content of the viewer and of the people the viewer follows (the feeds). */
export function fromViewerOrFollowed(viewerId: string) {
  return { OR: [{ authorId: viewerId }, { author: followedBy(viewerId) }] };
}
