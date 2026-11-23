import type { Space } from '@snapia/shared';

/*
 * What the signed-in user may do in a Space (docs/PRODUCT.md, "Space roles"). The API checks
 * every action again; these only decide which buttons to show.
 */

/** OWNERs and EDITORs upload snaps, while the Space is not archived. */
export function canUploadSnaps(space: Space): boolean {
  return space.archivedAt === null && (space.myRole === 'OWNER' || space.myRole === 'EDITOR');
}

/** Only OWNERs manage invites, and an archived Space accepts none. */
export function canInvite(space: Space): boolean {
  return space.archivedAt === null && space.myRole === 'OWNER';
}
