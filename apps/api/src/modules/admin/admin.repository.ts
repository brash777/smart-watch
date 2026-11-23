import type { SpaceMode } from '@snapia/shared';
import type { PrismaClient } from '../../lib/prisma';

/** Reads for the admin panel: every setting and the counts of the app. */
export function createAdminRepository(prisma: PrismaClient) {
  return {
    listSettings: () =>
      prisma.appSetting.findMany({
        orderBy: { key: 'asc' },
        select: { key: true, valueType: true, value: true, description: true, updatedAt: true },
      }),

    async stats() {
      const [users, activeUsers, snaps, documents, runs, failed, cost] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.space.findMany({ select: { mode: true, _count: { select: { snaps: true } } } }),
        prisma.document.count(),
        prisma.aiRun.count(),
        prisma.aiRun.count({ where: { status: 'FAILED' } }),
        prisma.aiRun.aggregate({ _sum: { estimatedCost: true } }),
      ]);
      const snapsByMode: Record<SpaceMode, number> = { STUDY: 0, WORK: 0, CONTENT: 0 };
      for (const space of snaps) snapsByMode[space.mode] += space._count.snaps;
      return {
        users: { total: users, active: activeUsers },
        snapsByMode,
        documents,
        ai: { runs, failed, estimatedCostUsd: Number(cost._sum.estimatedCost ?? 0) },
      };
    },
  };
}

export type AdminRepository = ReturnType<typeof createAdminRepository>;
