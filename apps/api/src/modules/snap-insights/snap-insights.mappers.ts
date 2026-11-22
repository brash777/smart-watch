import { snapInsightSchema, type SnapInsight } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import type { SnapInsightRecord } from './snap-insights.repository';

/** A stored SnapInsight as the API returns it. Its content is checked against its mode. */
export function toSnapInsight(insight: SnapInsightRecord): SnapInsight {
  const parsed = snapInsightSchema.safeParse({
    id: insight.id,
    snapId: insight.snapId,
    mode: insight.mode,
    data: insight.data,
    promptVersion: insight.promptVersion,
    editedByUser: insight.editedByUser,
    createdAt: insight.createdAt.toISOString(),
    updatedAt: insight.updatedAt.toISOString(),
  });
  if (!parsed.success) {
    throw new AppError('INSIGHT_INVALID', 'The stored insight of this snap is not valid', 500);
  }
  return parsed.data;
}
