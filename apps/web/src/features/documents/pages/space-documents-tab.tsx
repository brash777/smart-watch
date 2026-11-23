import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadMore } from '../../../components/load-more';
import { Skeleton } from '../../../components/skeleton';
import { EmptyState, ErrorState } from '../../../components/state-message';
import { formatDate } from '../../../lib/format';
import { useSpaceOutlet } from '../../spaces/hooks/use-space-outlet';
import { useSpaceDocuments } from '../hooks/use-documents';

export function SpaceDocumentsTab() {
  const { t } = useTranslation();
  const space = useSpaceOutlet();
  const documents = useSpaceDocuments(space.id);
  const items = documents.data?.pages.flatMap((page) => page.items) ?? [];

  if (documents.isPending) return <Skeleton className="h-16 rounded-control" />;
  if (documents.isError) {
    return (
      <ErrorState
        message={t('documents.error')}
        onRetry={() => {
          void documents.refetch();
        }}
      />
    );
  }
  if (items.length === 0) {
    return <EmptyState title={t('documents.empty.title')}>{t('documents.empty.text')}</EmptyState>;
  }
  return (
    <>
      <ul aria-label={t('documents.listLabel')} className="flex flex-col divide-y divide-line">
        {items.map((document) => (
          <li key={document.id} className="flex items-start gap-3 py-3">
            <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{document.title}</span>
              <span className="flex flex-wrap gap-x-3 text-sm text-muted">
                <span>{t(`documents.types.${document.type}`)}</span>
                <span>{t(`documents.status.${document.status}`)}</span>
                <span>{t('documents.updated', { date: formatDate(document.updatedAt) })}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={documents.hasNextPage}
        loading={documents.isFetchingNextPage}
        onLoad={() => {
          void documents.fetchNextPage();
        }}
      />
    </>
  );
}
