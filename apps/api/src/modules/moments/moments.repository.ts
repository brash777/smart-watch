import type { MomentAudience } from '@snapia/shared';
import type { PrismaClient } from '../../lib/prisma';
import { fromViewerOrFollowed, visibleMomentsWhere } from '../social/social-visibility';
import { userSummarySelect } from '../users/users.repository';

/** A Moment as the viewer sees it: whether they saw it, and its views when it is theirs. */
function momentSelect(viewerId: string) {
  return {
    id: true,
    authorId: true,
    audience: true,
    expiresAt: true,
    createdAt: true,
    author: { select: userSummarySelect },
    snap: { select: { id: true, storageKey: true, thumbnailKey: true, width: true, height: true } },
    views: { where: { userId: viewerId }, select: { id: true }, take: 1 },
    _count: { select: { views: true } },
  } as const;
}

export interface NewMoment {
  authorId: string;
  snapId: string;
  /** The Space whose members see it (audience SPACE_MEMBERS). */
  spaceId: string | null;
  audience: MomentAudience;
  expiresAt: Date;
}

export function createMomentsRepository(prisma: PrismaClient) {
  return {
    create(moment: NewMoment) {
      return prisma.moment.create({ data: moment, select: momentSelect(moment.authorId) });
    },

    /** Moments of the viewer and of the people they follow that are active and visible to them. */
    listFeed(viewerId: string, now: Date) {
      return prisma.moment.findMany({
        where: { AND: [visibleMomentsWhere(viewerId, now), fromViewerOrFollowed(viewerId)] },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: momentSelect(viewerId),
      });
    },

    /** A Moment that has not expired, whoever may see it. */
    findActive(id: string, now: Date) {
      return prisma.moment.findFirst({
        where: { id, expiresAt: { gt: now } },
        select: { id: true, authorId: true },
      });
    },

    async isVisible(id: string, viewerId: string, now: Date): Promise<boolean> {
      return (
        (await prisma.moment.count({ where: { id, ...visibleMomentsWhere(viewerId, now) } })) > 0
      );
    },

    /** Records a view once per person. */
    async addView(momentId: string, userId: string): Promise<void> {
      await prisma.momentView.createMany({ data: [{ momentId, userId }], skipDuplicates: true });
    },
  };
}

export type MomentsRepository = ReturnType<typeof createMomentsRepository>;
export type MomentRecord = Awaited<ReturnType<MomentsRepository['create']>>;
