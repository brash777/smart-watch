import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { buttonClassName } from '../../../components/button-styles';
import { LoadMore } from '../../../components/load-more';
import { Skeleton } from '../../../components/skeleton';
import { EmptyState, ErrorState } from '../../../components/state-message';
import { pageParams } from '../../../lib/pagination';
import { getFeed, socialKeys } from '../../social/api';
import { MomentsBar } from '../../social/components/moments-bar';
import { PostCard } from '../../social/components/post-card';

/** Home: the Moments of the people you follow, then their Posts and yours. */
export function HomePage() {
  const { t } = useTranslation();
  const feed = useInfiniteQuery({
    queryKey: socialKeys.feed,
    queryFn: ({ pageParam, signal }) => getFeed(pageParam, signal),
    ...pageParams,
  });
  const posts = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <h1 className="sr-only">{t('home.title')}</h1>
      <MomentsBar />
      {feed.isPending ? <Skeleton className="aspect-square rounded-card" /> : null}
      {feed.isError ? (
        <ErrorState
          message={t('home.error')}
          onRetry={() => {
            void feed.refetch();
          }}
        />
      ) : null}
      {feed.isSuccess && posts.length === 0 ? (
        <EmptyState
          title={t('home.empty.title')}
          action={
            <Link to={paths.explore} className={buttonClassName({ fullWidth: false })}>
              {t('home.empty.action')}
            </Link>
          }
        >
          {t('home.empty.text')}
        </EmptyState>
      ) : null}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <LoadMore
        hasMore={feed.hasNextPage}
        loading={feed.isFetchingNextPage}
        onLoad={() => {
          void feed.fetchNextPage();
        }}
      />
    </>
  );
}
