import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { buttonClassName } from '../../../components/button-styles';
import { LoadMore } from '../../../components/load-more';
import { PageHeader } from '../../../components/page-header';
import { EmptyState, ErrorState } from '../../../components/state-message';
import { SpaceRow, SpaceRowSkeleton } from '../components/space-row';
import { useMySpaces } from '../hooks/use-spaces';

const SKELETON_ROWS = ['a', 'b', 'c'];

export function SpacesPage() {
  const { t } = useTranslation();
  const spaces = useMySpaces();
  const items = spaces.data?.pages.flatMap((page) => page.items) ?? [];

  function content() {
    if (spaces.isPending) {
      return (
        <div aria-busy className="flex flex-col divide-y divide-line border-y border-line">
          {SKELETON_ROWS.map((key) => (
            <SpaceRowSkeleton key={key} />
          ))}
        </div>
      );
    }
    if (spaces.isError) {
      return (
        <ErrorState
          message={t('spaces.error')}
          onRetry={() => {
            void spaces.refetch();
          }}
        />
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title={t('spaces.empty.title')}
          action={
            <Link to={paths.newSpace} className={buttonClassName({ fullWidth: false })}>
              {t('spaces.empty.action')}
            </Link>
          }
        >
          {t('spaces.empty.text')}
        </EmptyState>
      );
    }
    return (
      <>
        <ul
          aria-label={t('spaces.listLabel')}
          className="flex flex-col divide-y divide-line border-y border-line"
        >
          {items.map((space) => (
            <li key={space.id}>
              <SpaceRow space={space} />
            </li>
          ))}
        </ul>
        <LoadMore
          hasMore={spaces.hasNextPage}
          loading={spaces.isFetchingNextPage}
          onLoad={() => {
            void spaces.fetchNextPage();
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <PageHeader title={t('spaces.title')} />
        {items.length > 0 ? (
          <Link to={paths.newSpace} className={buttonClassName({ fullWidth: false })}>
            <Plus aria-hidden className="size-5" />
            {t('spaces.create')}
          </Link>
        ) : null}
      </div>
      {content()}
      <p className="text-sm text-muted">
        {t('spaces.joinPrompt')}{' '}
        <Link to={paths.join()} className="font-semibold text-ink underline underline-offset-4">
          {t('spaces.joinLink')}
        </Link>
      </p>
    </>
  );
}
