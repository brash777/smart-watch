import { snapInsightDataSchemas } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import type { AnalyzedSnap } from '../ai/snap-context';
import type { SettingsService } from '../settings/settings.service';
import type { SnapInsightsRepository, SnapWithInsightRecord } from './snap-insights.repository';

export interface SnapSelectionDependencies {
  repository: SnapInsightsRepository;
  settings: SettingsService;
}

/** A stored snap and its insight, as AI tasks read them. */
export function toAnalyzedSnap(snap: SnapWithInsightRecord): AnalyzedSnap {
  const parsed =
    snap.insight === null
      ? null
      : snapInsightDataSchemas[snap.insight.mode].safeParse(snap.insight.data);
  if (parsed === null || !parsed.success) {
    throw new AppError('INSIGHT_INVALID', 'The stored insight of a snap is not valid', 500);
  }
  return {
    id: snap.id,
    authorId: snap.authorId,
    takenAt: snap.takenAt,
    note: snap.note,
    tags: snap.tags,
    insight: parsed.data,
  };
}

/** The snaps a person selects for Compose, flashcards or a quiz. */
export function createSnapSelection({ repository, settings }: SnapSelectionDependencies) {
  return {
    /**
     * The selected snaps of a Space, the first taken first: at most max_snaps_per_compose, all
     * of them in the Space and analyzed (DONE).
     */
    async select(spaceId: string, snapIds: readonly string[]): Promise<AnalyzedSnap[]> {
      const limit = await settings.getSetting('max_snaps_per_compose');
      if (snapIds.length > limit) {
        throw new AppError('TOO_MANY_SNAPS', `Select at most ${String(limit)} snaps`, 400, {
          limit,
        });
      }
      const snaps = await repository.findSnapsWithInsight(spaceId, snapIds);
      const found = new Set(snaps.map(({ id }) => id));
      const missing = snapIds.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new AppError('SNAP_NOT_FOUND', 'Some snaps are not in this Space', 404, {
          snapIds: missing,
        });
      }
      const notAnalyzed = snaps
        .filter((snap) => snap.analysisStatus !== 'DONE' || snap.insight === null)
        .map(({ id }) => id);
      if (notAnalyzed.length > 0) {
        throw new AppError('SNAPS_NOT_ANALYZED', 'Some snaps are not analyzed yet', 409, {
          snapIds: notAnalyzed,
        });
      }
      return snaps.map(toAnalyzedSnap);
    },
  };
}

export type SnapSelection = ReturnType<typeof createSnapSelection>;
