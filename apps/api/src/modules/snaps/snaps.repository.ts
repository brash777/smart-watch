import type { AnalysisStatus } from '@snapia/shared';
import { pageArgs } from '../../lib/pagination';
import type { PrismaClient } from '../../lib/prisma';
import { userSummarySelect } from '../users/users.repository';

const snapSelect = {
  id: true,
  spaceId: true,
  authorId: true,
  note: true,
  tags: true,
  takenAt: true,
  width: true,
  height: true,
  sizeBytes: true,
  mimeType: true,
  analysisStatus: true,
  storageKey: true,
  thumbnailKey: true,
  createdAt: true,
  author: { select: userSummarySelect },
} as const;

export interface NewSnap {
  spaceId: string;
  authorId: string;
  storageKey: string;
  thumbnailKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  note: string | null;
  tags: string[];
  takenAt: Date;
}

export interface SnapFilters {
  tag?: string | undefined;
  authorId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  analysisStatus?: AnalysisStatus | undefined;
  cursor?: string | undefined;
  limit: number;
}

export function createSnapsRepository(prisma: PrismaClient) {
  return {
    countInSpace(spaceId: string) {
      return prisma.snap.count({ where: { spaceId } });
    },

    /** Creates every snap of one upload in a single transaction. */
    createMany(snaps: NewSnap[]) {
      return prisma.$transaction(
        snaps.map((data) => prisma.snap.create({ data, select: snapSelect })),
      );
    },

    /** Snaps of a Space, most recently taken first, with optional filters. */
    listInSpace(
      spaceId: string,
      { tag, authorId, from, to, analysisStatus, ...page }: SnapFilters,
    ) {
      return prisma.snap.findMany({
        where: {
          spaceId,
          ...(tag === undefined ? {} : { tags: { has: tag } }),
          ...(authorId === undefined ? {} : { authorId }),
          ...(analysisStatus === undefined ? {} : { analysisStatus }),
          ...(from === undefined && to === undefined ? {} : { takenAt: { gte: from, lte: to } }),
        },
        orderBy: [{ takenAt: 'desc' }, { id: 'desc' }],
        select: snapSelect,
        ...pageArgs(page),
      });
    },

    findById(id: string) {
      return prisma.snap.findUnique({ where: { id }, select: snapSelect });
    },

    update(id: string, changes: { note?: string | null | undefined; tags?: string[] | undefined }) {
      return prisma.snap.update({ where: { id }, data: changes, select: snapSelect });
    },

    async delete(id: string): Promise<void> {
      await prisma.snap.delete({ where: { id } });
    },
  };
}

export type SnapsRepository = ReturnType<typeof createSnapsRepository>;
export type SnapRecord = NonNullable<Awaited<ReturnType<SnapsRepository['findById']>>>;
