import {
  snapInsightDataSchemas,
  updateSnapInsightBodySchemas,
  type AnalysisStatus,
  type SnapAnalysisState,
  type SnapInsight,
  type SpaceAnalysisStatus,
} from '@snapia/shared';
import { z } from 'zod';
import { AppError } from '../../lib/app-error';
import type { SpaceAccess } from '../../middlewares/require-space-role';
import type { AiQueue } from '../ai/ai-queue';
import type { SettingsService } from '../settings/settings.service';
import type { SnapPermissions } from '../snaps/snap-permissions';
import { toSnapInsight } from './snap-insights.mappers';
import type { SnapInsightsRepository } from './snap-insights.repository';

export interface SnapInsightsServiceDependencies {
  repository: SnapInsightsRepository;
  permissions: SnapPermissions;
  settings: SettingsService;
  queue: Pick<AiQueue, 'enqueueSnapAnalysis'>;
}

function insightNotFound(analysisStatus: AnalysisStatus): AppError {
  return new AppError('INSIGHT_NOT_FOUND', 'This snap has no insight yet', 404, {
    analysisStatus,
  });
}

function analysisInProgress(): AppError {
  return new AppError('ANALYSIS_IN_PROGRESS', 'The AI is analyzing this snap right now', 409);
}

function isAnalyzing(status: AnalysisStatus): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}

export function createSnapInsightsService({
  repository,
  permissions,
  settings,
  queue,
}: SnapInsightsServiceDependencies) {
  return {
    /** The insight of a snap, for anyone who can see the snap. */
    async get(snapId: string, userId: string | undefined): Promise<SnapInsight> {
      const { snap } = await permissions.findSnapForUser(snapId, userId);
      const insight = await repository.findInsight(snap.id);
      if (insight === null) throw insightNotFound(snap.analysisStatus);
      return toSnapInsight(insight);
    },

    /**
     * The person reviews the AI result: the fields sent replace the stored ones, checked against
     * the mode of the insight. Same permission as changing the snap.
     */
    async update(snapId: string, userId: string, body: unknown): Promise<SnapInsight> {
      const { snap, memberRole } = await permissions.findSnapForUser(snapId, userId);
      permissions.assertCanModify(snap, userId, memberRole);
      // A running analysis would overwrite the changes when it ends.
      if (isAnalyzing(snap.analysisStatus)) throw analysisInProgress();
      const current = await repository.findInsight(snap.id);
      if (current === null) throw insightNotFound(snap.analysisStatus);

      const { mode, data } = toSnapInsight(current);
      // Parsed under "body" so validation errors point at body.<field>, like validate() does.
      const changes = z.object({ body: updateSnapInsightBodySchemas[mode] }).parse({ body }).body;
      const content = snapInsightDataSchemas[mode].parse({ ...data, ...changes });
      return toSnapInsight(await repository.updateInsight(snap.id, content));
    },

    /**
     * Analyzes a DONE or FAILED snap again (same permission as changing the snap). The current
     * insight stays until the new one replaces it, so a failed retry loses nothing.
     */
    async reanalyze(snapId: string, userId: string): Promise<SnapAnalysisState> {
      const { snap, memberRole } = await permissions.findSnapForUser(snapId, userId);
      permissions.assertCanModify(snap, userId, memberRole);
      if (!(await repository.requestNewAnalysis(snap.id))) throw analysisInProgress();
      queue.enqueueSnapAnalysis(snap.id, userId);
      return { snapId: snap.id, analysisStatus: 'PENDING' };
    },

    /** How many snaps of the Space are in each analysis status, and when to ask again. */
    async spaceStatus(access: SpaceAccess): Promise<SpaceAnalysisStatus> {
      const counts = await repository.countByStatus(access.spaceId);
      return {
        spaceId: access.spaceId,
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        counts,
        pollIntervalMs: await settings.getSetting('analysis_poll_interval_ms'),
      };
    },
  };
}

export type SnapInsightsService = ReturnType<typeof createSnapInsightsService>;
