import type { Moment, MomentGroup } from '@snapia/shared';
import type { SnapImageUrlMap } from '../snaps/snap-images';
import { toSharedImage } from '../social/shared-images';
import type { AvatarUrlResolver } from '../users/avatars';
import { toUserSummary } from '../users/users.mappers';
import type { MomentRecord } from './moments.repository';

/**
 * A Moment for the viewer, or null when the viewer cannot view its snap (canViewSnap). Your own
 * Moments count as seen and show their views.
 */
export async function toMoment(
  moment: MomentRecord,
  viewerId: string,
  urls: SnapImageUrlMap,
  avatarUrl: AvatarUrlResolver,
): Promise<Moment | null> {
  const image = toSharedImage(moment.snap, urls);
  if (image === null) return null;
  const isMine = moment.authorId === viewerId;
  return {
    id: moment.id,
    author: await toUserSummary(moment.author, avatarUrl),
    audience: moment.audience,
    image,
    expiresAt: moment.expiresAt.toISOString(),
    createdAt: moment.createdAt.toISOString(),
    viewedByMe: isMine || moment.views.length > 0,
    viewsCount: isMine ? moment._count.views : null,
  };
}

/**
 * The Moments grouped by author, each group the oldest first. Your own group goes first, then
 * the groups with something unseen, then the most recent.
 */
export function groupByAuthor(moments: readonly Moment[], viewerId: string): MomentGroup[] {
  const groups = new Map<string, MomentGroup>();
  for (const moment of moments) {
    const group = groups.get(moment.author.id) ?? {
      author: moment.author,
      moments: [],
      hasUnseen: false,
    };
    group.moments.push(moment);
    group.hasUnseen ||= !moment.viewedByMe;
    groups.set(moment.author.id, group);
  }
  const latest = (group: MomentGroup) => group.moments.at(-1)?.createdAt ?? '';
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.author.id === viewerId) - Number(a.author.id === viewerId) ||
      Number(b.hasUnseen) - Number(a.hasUnseen) ||
      latest(b).localeCompare(latest(a)),
  );
}
