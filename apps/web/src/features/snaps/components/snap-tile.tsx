import type { Snap } from '@snapia/shared';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../lib/format';

/** A square thumbnail with a badge while the AI has not analyzed it. */
export function SnapTile({ snap }: { snap: Snap }) {
  const { t } = useTranslation();
  const analyzing = snap.analysisStatus === 'PENDING' || snap.analysisStatus === 'PROCESSING';
  return (
    <span className="relative block aspect-square overflow-hidden bg-line">
      <img
        src={snap.thumbnailUrl}
        alt={t('spaces.snaps.tile', {
          date: formatDate(snap.takenAt),
          status: t(`analysis.${snap.analysisStatus}`),
        })}
        loading="lazy"
        className="size-full object-cover"
      />
      {analyzing || snap.analysisStatus === 'FAILED' ? (
        <span className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-stage/60 text-on-stage">
          {analyzing ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <AlertTriangle aria-hidden className="size-4" />
          )}
        </span>
      ) : null}
    </span>
  );
}
