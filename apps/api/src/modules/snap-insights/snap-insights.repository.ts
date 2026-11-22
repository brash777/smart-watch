import { analysisStatusSchema, type AnalysisStatus } from '@snapia/shared';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../lib/prisma';
import type { SnapAnalysisStore } from '../ai/ai-queue';
import type { SnapInsightData } from '../ai/tasks/snap-analysis';

const insightSelect = {
  id: true,
  snapId: true,
  mode: true,
  data: true,
  promptVersion: true,
  editedByUser: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The columns that mirror the content: summary, and the text read in STUDY snaps. */
function contentColumns(data: SnapInsightData) {
  return {
    summary: data.summary,
    extractedText: 'extractedText' in data && data.extractedText !== '' ? data.extractedText : null,
    data: data as Prisma.InputJsonObject,
  };
}

export function createSnapInsightsRepository(prisma: PrismaClient) {
  const analysisStore: SnapAnalysisStore = {
    async claim(snapId) {
      const { count } = await prisma.snap.updateMany({
        where: { id: snapId, analysisStatus: 'PENDING' },
        data: { analysisStatus: 'PROCESSING' },
      });
      return count === 1;
    },

    findForAnalysis(snapId) {
      return prisma.snap.findUnique({
        where: { id: snapId },
        select: {
          id: true,
          spaceId: true,
          authorId: true,
          storageKey: true,
          note: true,
          tags: true,
          takenAt: true,
          space: { select: { mode: true, metadata: true } },
        },
      });
    },

    async saveInsight(snapId, { mode, data, aiRunId, promptVersion }) {
      const insight = {
        mode,
        ...contentColumns(data),
        aiRunId,
        promptVersion,
        editedByUser: false,
      };
      await prisma.$transaction([
        prisma.snapInsight.upsert({
          where: { snapId },
          create: { snapId, ...insight },
          update: insight,
        }),
        prisma.snap.update({ where: { id: snapId }, data: { analysisStatus: 'DONE' } }),
      ]);
    },

    async markFailed(snapId) {
      await prisma.snap.updateMany({
        where: { id: snapId, analysisStatus: 'PROCESSING' },
        data: { analysisStatus: 'FAILED' },
      });
    },

    async resetInterrupted() {
      const { count } = await prisma.snap.updateMany({
        where: { analysisStatus: 'PROCESSING' },
        data: { analysisStatus: 'PENDING' },
      });
      return count;
    },

    async listPendingIds() {
      const snaps = await prisma.snap.findMany({
        where: { analysisStatus: 'PENDING' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      return snaps.map(({ id }) => id);
    },
  };

  return {
    ...analysisStore,

    findInsight(snapId: string) {
      return prisma.snapInsight.findUnique({ where: { snapId }, select: insightSelect });
    },

    /** Saves the person's changes. */
    updateInsight(snapId: string, data: SnapInsightData) {
      return prisma.snapInsight.update({
        where: { snapId },
        data: { ...contentColumns(data), editedByUser: true },
        select: insightSelect,
      });
    },

    /** DONE or FAILED → PENDING. False when the snap is gone or is already being analyzed. */
    async requestNewAnalysis(snapId: string): Promise<boolean> {
      const { count } = await prisma.snap.updateMany({
        where: { id: snapId, analysisStatus: { in: ['DONE', 'FAILED'] } },
        data: { analysisStatus: 'PENDING' },
      });
      return count === 1;
    },

    /** How many snaps of the Space are in each analysis status. */
    async countByStatus(spaceId: string): Promise<Record<AnalysisStatus, number>> {
      const groups = await prisma.snap.groupBy({
        by: ['analysisStatus'],
        where: { spaceId },
        _count: { _all: true },
      });
      const counts = Object.fromEntries(
        analysisStatusSchema.options.map((status) => [status, 0]),
      ) as Record<AnalysisStatus, number>;
      for (const group of groups) counts[group.analysisStatus] = group._count._all;
      return counts;
    },
  };
}

export type SnapInsightsRepository = ReturnType<typeof createSnapInsightsRepository>;
export type SnapInsightRecord = NonNullable<
  Awaited<ReturnType<SnapInsightsRepository['findInsight']>>
>;
