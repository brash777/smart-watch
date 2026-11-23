import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
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
  const space = useSpaceOutlet();
  const snaps = useSpaceSnaps(space.id);
  useAnalysisPolling(space.id);
  const items = snaps.data?.pages.flatMap((page) => page.items) ?? [];

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
    const canUpload = canUploadSnaps(space);
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
  return (
    <>
      <ul aria-label={t('spaces.snaps.gridLabel')} className="-mx-4 grid grid-cols-3 gap-0.5">
        {items.map((snap) => (
          <li key={snap.id}>
            <Link to={paths.snap(space.id, snap.id)} className="block">
              <SnapTile snap={snap} />
            </Link>
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
    </>
  );
}
