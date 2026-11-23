import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { buttonClassName } from '../../../components/button-styles';
import { FormAlert } from '../../../components/form-alert';
import { LoadMore } from '../../../components/load-more';
import { Skeleton } from '../../../components/skeleton';
import { ErrorState } from '../../../components/state-message';
import { errorKey } from '../../../i18n/error-key';
import { pageParams } from '../../../lib/pagination';
import { useAuth } from '../../auth/hooks/use-auth';
import { getProfile, getUserPosts, setFollow, socialKeys } from '../api';
import { PostCard } from './post-card';

/** A public profile (the portfolio): photo, bio, counts, follow button and grid of Posts. */
export function UserProfile({ username }: { username: string }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: socialKeys.profile(username),
    queryFn: ({ signal }) => getProfile(username, signal),
  });
  const posts = useInfiniteQuery({
    queryKey: socialKeys.userPosts(username),
    queryFn: ({ pageParam, signal }) => getUserPosts(username, pageParam, signal),
    ...pageParams,
  });
  const follow = useMutation({
    mutationFn: (value: boolean) => setFollow(username, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.profile(username) });
      void queryClient.invalidateQueries({ queryKey: socialKeys.feed });
    },
  });
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];
  const openPost = items.find((post) => post.id === openPostId);

  if (profile.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (profile.isError) return <ErrorState message={t(errorKey(profile.error))} />;
  const user = profile.data;
  const isMe = auth.status === 'authenticated' && auth.user.id === user.id;

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          {user.avatarUrl === null ? (
            <span
              aria-hidden
              className="grid size-20 shrink-0 place-items-center rounded-full bg-line font-display text-3xl font-bold uppercase"
            >
              {user.name.charAt(0)}
            </span>
          ) : (
            <img
              src={user.avatarUrl}
              alt=""
              className="size-20 shrink-0 rounded-full object-cover"
            />
          )}
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight">{user.name}</h1>
            <p className="text-muted">{t('common.username', { username: user.username })}</p>
          </div>
        </div>
        <dl className="flex gap-6 text-sm">
          {(['posts', 'followers', 'following'] as const).map((key) => (
            <div key={key} className="flex flex-col">
              <dt className="text-muted">{t(`profile.counts.${key}`)}</dt>
              <dd className="font-semibold">{user.counts[key]}</dd>
            </div>
          ))}
        </dl>
        {user.bio === null ? null : <p className="whitespace-pre-line">{user.bio}</p>}
        {auth.status === 'authenticated' && !isMe ? (
          <Button
            variant={user.isFollowedByMe ? 'secondary' : 'primary'}
            disabled={follow.isPending}
            onClick={() => {
              follow.mutate(!user.isFollowedByMe);
            }}
          >
            {user.isFollowedByMe ? t('profile.unfollow') : t('profile.follow')}
          </Button>
        ) : null}
        {auth.status === 'anonymous' ? (
          <Link to={paths.login} className={buttonClassName()}>
            {t('profile.signInToFollow')}
          </Link>
        ) : null}
        {follow.isError ? <FormAlert>{t(errorKey(follow.error))}</FormAlert> : null}
      </header>
      {openPost === undefined ? null : <PostCard post={openPost} />}
      {posts.isSuccess && items.length === 0 ? (
        <p className="text-muted">{t('profile.noPosts')}</p>
      ) : null}
      <ul aria-label={t('profile.postsLabel')} className="-mx-4 grid grid-cols-3 gap-0.5">
        {items.map((post) => {
          const cover = post.media[0];
          return cover === undefined ? null : (
            <li key={post.id}>
              <button
                type="button"
                aria-pressed={post.id === openPostId}
                onClick={() => {
                  setOpenPostId(post.id === openPostId ? null : post.id);
                  window.scrollTo({ top: 0 });
                }}
                className="block w-full"
              >
                <img
                  src={cover.thumbnailUrl}
                  alt={cover.altText ?? t('social.photoAlt', { username: user.username })}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </button>
            </li>
          );
        })}
      </ul>
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
