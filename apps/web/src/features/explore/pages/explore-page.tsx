import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { LoadMore } from '../../../components/load-more';
import { PageHeader } from '../../../components/page-header';
import { Skeleton } from '../../../components/skeleton';
import { EmptyState, ErrorState } from '../../../components/state-message';
import { pageParams } from '../../../lib/pagination';
import { getExplore, getTrending, socialKeys } from '../../social/api';
import { PostCard } from '../../social/components/post-card';

/** Public Posts, newest first, filtered by hashtag. */
export function ExplorePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const hashtag = (searchParams.get('hashtag') ?? '').replace(/^#+/, '').toLowerCase();
  const [text, setText] = useState(hashtag);
  const trending = useQuery({
    queryKey: socialKeys.trending,
    queryFn: ({ signal }) => getTrending(signal),
  });
  const posts = useInfiniteQuery({
    queryKey: socialKeys.explore(hashtag),
    queryFn: ({ pageParam, signal }) => getExplore(hashtag, pageParam, signal),
    ...pageParams,
  });
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    const tag = text.trim().replace(/^#+/, '').toLowerCase();
    setSearchParams(tag === '' ? {} : { hashtag: tag });
  }

  return (
    <>
      <PageHeader title={t('explore.title')} />
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t('explore.searchLabel')}</span>
          <input
            value={text}
            placeholder={t('explore.searchPlaceholder')}
            autoCapitalize="none"
            onChange={(event) => {
              setText(event.target.value);
            }}
            className="min-h-12 w-full rounded-control border border-field-border bg-surface px-3"
          />
        </label>
        <Button type="submit" fullWidth={false} aria-label={t('explore.search')}>
          <Search aria-hidden className="size-5" />
        </Button>
      </form>
      {(trending.data ?? []).length > 0 ? (
        <section aria-label={t('explore.trending')} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">{t('explore.trending')}</h2>
          <ul className="flex flex-wrap gap-2">
            {(trending.data ?? []).map((item) => (
              <li key={item.hashtag}>
                <Link
                  to={paths.exploreTag(item.hashtag)}
                  onClick={() => {
                    setText(item.hashtag);
                  }}
                  aria-current={item.hashtag === hashtag ? 'true' : undefined}
                  className="flex min-h-11 items-center rounded-full border border-line px-3 text-sm aria-[current]:border-ink aria-[current]:font-semibold"
                >
                  #{item.hashtag}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {posts.isPending ? <Skeleton className="aspect-square rounded-card" /> : null}
      {posts.isError ? (
        <ErrorState
          message={t('explore.error')}
          onRetry={() => {
            void posts.refetch();
          }}
        />
      ) : null}
      {posts.isSuccess && items.length === 0 ? <EmptyState title={t('explore.empty')} /> : null}
      {items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <LoadMore
        hasMore={posts.hasNextPage}
        loading={posts.isFetchingNextPage}
        onLoad={() => {
          void posts.fetchNextPage();
        }}
      />
    </>
  );
}
