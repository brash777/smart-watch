import type { SpaceMetadata, SpaceMode, Visibility } from '@snapia/shared';
import { pageArgs } from '../../lib/pagination';
import type { PrismaClient } from '../../lib/prisma';
import type { SpaceAccessRecord } from '../../middlewares/require-space-role';
import { userSummarySelect } from '../users/users.repository';

/** Everything the API returns about a Space. */
export const spaceDetailSelect = {
  id: true,
  name: true,
  description: true,
  mode: true,
  color: true,
  visibility: true,
  metadata: true,
  coverSnapId: true,
  archivedAt: true,
  createdAt: true,
  owner: { select: userSummarySelect },
  _count: { select: { snaps: true, members: true } },
} as const;

export interface SpaceListQuery {
  mode?: SpaceMode | undefined;
  archived?: boolean | undefined;
  cursor?: string | undefined;
  limit: number;
}

export interface NewSpace {
  ownerId: string;
  name: string;
  description: string | null;
  mode: SpaceMode;
  color: string;
  visibility?: Visibility | undefined;
  metadata: SpaceMetadata;
}

export interface SpaceChanges {
  name?: string | undefined;
  description?: string | null | undefined;
  color?: string | undefined;
  visibility?: Visibility | undefined;
  metadata?: SpaceMetadata | undefined;
}

export function createSpacesRepository(prisma: PrismaClient) {
  return {
    /** What requireSpaceRole needs: the Space and the caller's membership, if any. */
    async findAccess(
      spaceId: string,
      userId: string | undefined,
    ): Promise<SpaceAccessRecord | null> {
      const space = await prisma.space.findUnique({
        where: { id: spaceId },
        select: { id: true, visibility: true, archivedAt: true },
      });
      if (space === null) return null;
      const member =
        userId === undefined
          ? null
          : await prisma.spaceMember.findUnique({
              where: { spaceId_userId: { spaceId, userId } },
              select: { role: true },
            });
      return { ...space, memberRole: member?.role ?? null };
    },

    /** Creates the Space and makes its creator an OWNER member, in one write. */
    createWithOwner({ ownerId, ...space }: NewSpace) {
      return prisma.space.create({
        data: { ...space, ownerId, members: { create: { userId: ownerId, role: 'OWNER' } } },
        select: spaceDetailSelect,
      });
    },

    findDetail(spaceId: string) {
      return prisma.space.findUnique({ where: { id: spaceId }, select: spaceDetailSelect });
    },

    /** The Spaces where the user is a member (owned or joined), newest first, with their role. */
    listForMember(userId: string, { mode, archived, ...page }: SpaceListQuery) {
      return prisma.space.findMany({
        where: {
          members: { some: { userId } },
          archivedAt: archived === true ? { not: null } : null,
          ...(mode === undefined ? {} : { mode }),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { ...spaceDetailSelect, members: { where: { userId }, select: { role: true } } },
        ...pageArgs(page),
      });
    },

    update(spaceId: string, changes: SpaceChanges) {
      return prisma.space.update({
        where: { id: spaceId },
        data: changes,
        select: spaceDetailSelect,
      });
    },

    /** Members that are not OWNERs (a PRIVATE Space can only have OWNERs). */
    countNonOwnerMembers(spaceId: string) {
      return prisma.spaceMember.count({ where: { spaceId, role: { not: 'OWNER' } } });
    },

    setArchivedAt(spaceId: string, archivedAt: Date | null) {
      return prisma.space.update({
        where: { id: spaceId },
        data: { archivedAt },
        select: spaceDetailSelect,
      });
    },
  };
}

export type SpacesRepository = ReturnType<typeof createSpacesRepository>;
export type SpaceDetailRecord = NonNullable<Awaited<ReturnType<SpacesRepository['findDetail']>>>;
