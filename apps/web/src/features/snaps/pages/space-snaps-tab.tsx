import type { Snap } from '@snapia/shared';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { buttonClassName } from '../../../components/button-styles';
import { LoadMore } from '../../../components/load-more';
import { Skeleton } from '../../../components/skeleton';
import { EmptyState, ErrorState } from '../../../components/state-message';
import { useSpaceOutlet } from '../../spaces/hooks/use-space-outlet';
import { canUploadSnaps } from '../../spaces/space-permissions';
import { SnapTile } from '../components/snap-tile';
import { useAnalysisPolling, useSpaceSnaps } from '../hooks/use-snaps';

const SKELETON_TILES = ['a', 'b', 'c', 'd', 'e', 'f'];

export function SpaceSnapsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const space = useSpaceOutlet();
  const snaps = useSpaceSnaps(space.id);
  useAnalysisPolling(space.id);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const items = snaps.data?.pages.flatMap((page) => page.items) ?? [];
  const canUpload = canUploadSnaps(space);

  if (snaps.isPending) {
    return (
      <div aria-busy className="-mx-4 grid grid-cols-3 gap-0.5">
        {SKELETON_TILES.map((key) => (
          <Skeleton key={key} className="aspect-square" />
        ))}
      </div>
    );
  }
  if (snaps.isError) {
    return (
      <ErrorState
        message={t('spaces.snaps.error')}
        onRetry={() => {
          void snaps.refetch();
        }}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title={t('spaces.snaps.empty.title')}
        action={
          canUpload ? (
            <Link to={paths.captureIn(space.id)} className={buttonClassName({ fullWidth: false })}>
              {t('spaces.snaps.empty.action')}
            </Link>
          ) : undefined
        }
      >
        {canUpload ? t('spaces.snaps.empty.text') : t('spaces.snaps.empty.textReadOnly')}
      </EmptyState>
    );
  }

  function toggle(snap: Snap) {
    setSelected((ids) =>
      ids.includes(snap.id) ? ids.filter((id) => id !== snap.id) : [...ids, snap.id],
    );
  }

  return (
    <>
      {canUpload ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {selecting ? t('compose.selectHint') : t('compose.intro')}
          </p>
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
          >
            {selecting ? t('compose.cancelSelect') : t('compose.select')}
          </Button>
        </div>
      ) : null}
      <ul aria-label={t('spaces.snaps.gridLabel')} className="-mx-4 grid grid-cols-3 gap-0.5">
        {items.map((snap) => (
          <li key={snap.id}>
            {selecting ? (
              <button
                type="button"
                aria-pressed={selected.includes(snap.id)}
                disabled={snap.analysisStatus !== 'DONE'}
                onClick={() => {
                  toggle(snap);
                }}
                className="relative block w-full disabled:opacity-40"
              >
                <SnapTile snap={snap} />
                {selected.includes(snap.id) ? (
                  <span className="absolute inset-0 grid place-items-center bg-stage/40 text-on-stage">
                    <Check aria-hidden className="size-8" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            ) : (
              <Link to={paths.snap(space.id, snap.id)} className="block">
                <SnapTile snap={snap} />
              </Link>
            )}
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={snaps.hasNextPage}
        loading={snaps.isFetchingNextPage}
        onLoad={() => {
          void snaps.fetchNextPage();
        }}
      />
      {selecting ? (
        <div className="sticky bottom-safe-nav -mx-4 border-t border-line bg-surface px-4 py-3">
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              void navigate(paths.compose(space.id), { state: { snapIds: selected } });
            }}
          >
            {t('compose.create', { count: selected.length })}
          </Button>
        </div>
      ) : null}
    </>
  );
}
