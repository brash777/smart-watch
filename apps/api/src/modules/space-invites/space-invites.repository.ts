import type { SpaceRole } from '@snapia/shared';
import type { PrismaClient } from '../../lib/prisma';

const inviteSelect = {
  id: true,
  code: true,
  role: true,
  expiresAt: true,
  maxUses: true,
  uses: true,
  revokedAt: true,
  createdAt: true,
} as const;

export interface NewInvite {
  spaceId: string;
  code: string;
  role: SpaceRole;
  expiresAt: Date;
  maxUses: number;
  createdById: string;
}

export type RedeemResult =
  | { status: 'JOINED'; role: SpaceRole }
  | { status: 'ALREADY_MEMBER'; role: SpaceRole }
  | { status: 'UNAVAILABLE' };

export function createSpaceInvitesRepository(prisma: PrismaClient) {
  return {
    /** Creates the invite. With shareSpace, a PRIVATE Space becomes MEMBERS in the same write. */
    createInvite(invite: NewInvite, { shareSpace }: { shareSpace: boolean }) {
      return prisma.$transaction(async (tx) => {
        if (shareSpace) {
          await tx.space.updateMany({
            where: { id: invite.spaceId, visibility: 'PRIVATE' },
            data: { visibility: 'MEMBERS' },
          });
        }
        return tx.spaceInvite.create({ data: invite, select: inviteSelect });
      });
    },

    listForSpace(spaceId: string) {
      return prisma.spaceInvite.findMany({
        where: { spaceId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: inviteSelect,
      });
    },

    findInSpace(spaceId: string, inviteId: string) {
      return prisma.spaceInvite.findFirst({
        where: { id: inviteId, spaceId },
        select: inviteSelect,
      });
    },

    async revoke(inviteId: string, now: Date): Promise<void> {
      await prisma.spaceInvite.updateMany({
        where: { id: inviteId, revokedAt: null },
        data: { revokedAt: now },
      });
    },

    findByCode(code: string) {
      return prisma.spaceInvite.findUnique({
        where: { code },
        select: {
          ...inviteSelect,
          spaceId: true,
          space: { select: { visibility: true, archivedAt: true } },
        },
      });
    },

    findMemberRole(spaceId: string, userId: string) {
      return prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId } },
        select: { role: true },
      });
    },

    /**
     * Adds the member and spends one use in a single transaction. The use is only spent while
     * the invite is still valid, so two people can never take its last use.
     */
    redeem(inviteId: string, spaceId: string, userId: string, now: Date): Promise<RedeemResult> {
      return prisma.$transaction(async (tx): Promise<RedeemResult> => {
        const member = await tx.spaceMember.findUnique({
          where: { spaceId_userId: { spaceId, userId } },
          select: { role: true },
        });
        if (member !== null) return { status: 'ALREADY_MEMBER', role: member.role };

        const spent = await tx.spaceInvite.updateMany({
          where: {
            id: inviteId,
            revokedAt: null,
            expiresAt: { gt: now },
            uses: { lt: tx.spaceInvite.fields.maxUses },
          },
          data: { uses: { increment: 1 } },
        });
        if (spent.count === 0) return { status: 'UNAVAILABLE' };

        const invite = await tx.spaceInvite.findUniqueOrThrow({
          where: { id: inviteId },
          select: { role: true },
        });
        await tx.spaceMember.create({ data: { spaceId, userId, role: invite.role } });
        return { status: 'JOINED', role: invite.role };
      });
    },
  };
}

export type SpaceInvitesRepository = ReturnType<typeof createSpaceInvitesRepository>;
export type InviteRecord = Awaited<ReturnType<SpaceInvitesRepository['listForSpace']>>[number];
