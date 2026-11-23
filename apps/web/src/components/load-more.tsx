import { useTranslation } from 'react-i18next';
import { Button } from './button';

/** The next page of a list, on request. */
export function LoadMore({
  hasMore,
  loading,
  onLoad,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoad: () => void;
}) {
  const { t } = useTranslation();
  if (!hasMore) return null;
  return (
    <Button variant="secondary" disabled={loading} onClick={onLoad}>
      {loading ? t('common.loadingMore') : t('common.loadMore')}
    </Button>
  );
}
