import type { Post } from '@snapia/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle } from 'lucide-react';
import { Fragment, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { Avatar } from '../../../components/avatar';
import { FormAlert } from '../../../components/form-alert';
import { LoadMore } from '../../../components/load-more';
import { errorKey } from '../../../i18n/error-key';
import { formatDate } from '../../../lib/format';
import { pageParams } from '../../../lib/pagination';
import { useAuth } from '../../auth/hooks/use-auth';
import { addComment, listComments, socialKeys, toggleLike } from '../api';

/** A Post: its photos (swipe), a like by double tap or with the heart, and its comments. */
export function PostCard({ post }: { post: Post }) {
  const { t } = useTranslation();
  const signedIn = useAuth().status === 'authenticated';
  const [like, setLike] = useState({ liked: post.likedByMe, likesCount: post.likesCount });
  const [showComments, setShowComments] = useState(false);
  const handledDoubleTap = useRef(false);
  const toggle = useMutation({ mutationFn: () => toggleLike(post.id), onSuccess: setLike });

  function likeByDoubleTap() {
    if (handledDoubleTap.current) return;
    handledDoubleTap.current = true;
    if (signedIn && !like.liked && !toggle.isPending) toggle.mutate();
  }

  return (
    <article className="-mx-4 flex flex-col gap-3 border-b border-line pb-4">
      <header className="flex items-center gap-3 px-4">
        <Avatar user={post.author} size="sm" />
        <Link to={paths.user(post.author.username)} className="font-semibold">
          {post.author.username}
        </Link>
        <span className="ml-auto text-sm text-muted">{formatDate(post.publishedAt)}</span>
      </header>
      <div
        onPointerDown={() => {
          handledDoubleTap.current = false;
        }}
        onClick={(event) => {
          if (event.detail === 2) likeByDoubleTap();
        }}
        onDoubleClick={likeByDoubleTap}
        className="flex touch-manipulation snap-x snap-mandatory overflow-x-auto bg-stage"
      >
        {post.media.map((media) => (
          <img
            key={media.snapId}
            src={media.imageUrl}
            width={media.width}
            height={media.height}
            alt={media.altText ?? t('social.photoAlt', { username: post.author.username })}
            loading="lazy"
            className="aspect-square w-full shrink-0 snap-start object-cover"
          />
        ))}
      </div>
      <div className="flex items-center gap-4 px-4">
        <button
          type="button"
          aria-pressed={like.liked}
          aria-label={t('social.like')}
          disabled={!signedIn || toggle.isPending}
          onClick={() => {
            toggle.mutate();
          }}
          className="flex min-h-11 items-center gap-1.5"
        >
          <Heart aria-hidden className={`size-6 ${like.liked ? 'fill-danger text-danger' : ''}`} />
          <span className="text-sm font-semibold">
            {t('social.likes', { count: like.likesCount })}
          </span>
        </button>
        <button
          type="button"
          aria-expanded={showComments}
          onClick={() => {
            setShowComments(!showComments);
          }}
          className="flex min-h-11 items-center gap-1.5"
        >
          <MessageCircle aria-hidden className="size-6" />
          <span className="text-sm font-semibold">
            {t('social.comments', { count: post.commentsCount })}
          </span>
        </button>
        {post.media.length > 1 ? (
          <span className="ml-auto text-sm text-muted">
            {t('social.photos', { count: post.media.length })}
          </span>
        ) : null}
      </div>
      {post.caption === '' && post.hashtags.length === 0 ? null : (
        <p className="px-4 whitespace-pre-line">
          {post.caption}{' '}
          {post.hashtags.map((hashtag) => (
            // The space after each link lets a long list of hashtags wrap.
            <Fragment key={hashtag}>
              <Link to={paths.exploreTag(hashtag)} className="font-semibold">
                #{hashtag}
              </Link>{' '}
            </Fragment>
          ))}
        </p>
      )}
      {showComments ? <Comments postId={post.id} signedIn={signedIn} /> : null}
    </article>
  );
}

function Comments({ postId, signedIn }: { postId: string; signedIn: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const comments = useInfiniteQuery({
    queryKey: socialKeys.comments(postId),
    queryFn: ({ pageParam, signal }) => listComments(postId, pageParam, signal),
    ...pageParams,
  });
  const add = useMutation({
    mutationFn: (text: string) => addComment(postId, text),
    onSuccess: () => {
      setBody('');
      void queryClient.invalidateQueries({ queryKey: socialKeys.comments(postId) });
    },
  });
  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (body.trim() !== '') add.mutate(body.trim());
  }

  return (
    <section aria-label={t('social.commentsLabel')} className="flex flex-col gap-3 px-4">
      {comments.isSuccess && items.length === 0 ? (
        <p className="text-sm text-muted">{t('social.noComments')}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {items.map((comment) => (
          <li key={comment.id} className="text-sm">
            <span className="font-semibold">{comment.author.username}</span> {comment.body}
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={comments.hasNextPage}
        loading={comments.isFetchingNextPage}
        onLoad={() => {
          void comments.fetchNextPage();
        }}
      />
      {signedIn ? (
        <form onSubmit={submit} className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">{t('social.commentLabel')}</span>
            <input
              value={body}
              placeholder={t('social.commentPlaceholder')}
              onChange={(event) => {
                setBody(event.target.value);
              }}
              className="min-h-11 w-full rounded-control border border-field-border bg-surface px-3"
            />
          </label>
          <button
            type="submit"
            disabled={add.isPending || body.trim() === ''}
            className="min-h-11 px-2 font-semibold disabled:opacity-50"
          >
            {t('social.send')}
          </button>
        </form>
      ) : null}
      {add.isError ? <FormAlert>{t(errorKey(add.error))}</FormAlert> : null}
    </section>
  );
}
