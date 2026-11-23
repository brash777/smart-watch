import type { MomentAudience, Snap, Space } from '@snapia/shared';
import { ChevronLeft, ChevronRight, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { paths } from '../../../app/paths';
import { Avatar } from '../../../components/avatar';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { FullScreenLoader } from '../../../components/full-screen-loader';
import { Notice } from '../../../components/notice';
import { ErrorState } from '../../../components/state-message';
import { errorKey } from '../../../i18n/error-key';
import { formatDateTime } from '../../../lib/format';
import { useCurrentUserId } from '../../auth/hooks/use-auth';
import { useSpace } from '../../spaces/hooks/use-spaces';
import { InsightPanel } from '../components/insight-panel';
import {
  useAnalysisPolling,
  useDeleteSnap,
  useReanalyzeSnap,
  useShareMoment,
  useSnap,
  useSpaceSnaps,
} from '../hooks/use-snaps';

const AUDIENCES: readonly MomentAudience[] = ['FOLLOWERS', 'SPACE_MEMBERS', 'PUBLIC'];

/** Full-screen snaps of a Space: swipe (or use the arrows) between photos, the AI below. */
export function SnapViewerPage() {
  const { t } = useTranslation();
  const { spaceId = '', snapId = '' } = useParams();
  const space = useSpace(spaceId);
  const snaps = useSpaceSnaps(spaceId);
  useAnalysisPolling(spaceId);

  if (space.isPending || snaps.isPending) return <FullScreenLoader />;
  if (space.isError || snaps.isError) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
        <Link to={paths.space(spaceId)} className="flex min-h-11 items-center gap-1 text-muted">
          <ChevronLeft aria-hidden className="size-5" />
          {t('viewer.close')}
        </Link>
        <ErrorState message={t(errorKey(space.error ?? snaps.error))} />
      </main>
    );
  }
  const items = snaps.data.pages.flatMap((page) => page.items);
  return (
    <Viewer
      space={space.data}
      snaps={items}
      initialSnapId={snapId}
      onNearEnd={() => {
        if (snaps.hasNextPage && !snaps.isFetchingNextPage) void snaps.fetchNextPage();
      }}
    />
  );
}

function Viewer({
  space,
  snaps,
  initialSnapId,
  onNearEnd,
}: {
  space: Space;
  snaps: Snap[];
  initialSnapId: string;
  onNearEnd: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() =>
    Math.max(
      snaps.findIndex((snap) => snap.id === initialSnapId),
      0,
    ),
  );
  const current = snaps[Math.min(index, snaps.length - 1)];

  // Opens on the snap of the URL.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element !== null) element.scrollLeft = index * element.clientWidth;
    // Only once: afterwards the scroll position drives the index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current !== undefined) {
      void navigate(paths.snap(space.id, current.id), { replace: true });
    }
    if (index >= snaps.length - 2) onNearEnd();
  }, [current, index, navigate, onNearEnd, snaps.length, space.id]);

  function goTo(next: number) {
    const element = scroller.current;
    if (element === null || next < 0 || next >= snaps.length) return;
    element.scrollTo({ left: next * element.clientWidth, behavior: 'smooth' });
  }

  function close() {
    void navigate(paths.space(space.id));
  }

  if (current === undefined) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
        <ErrorState message={t('viewer.error')} />
        <Button onClick={close}>{t('viewer.close')}</Button>
      </main>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col bg-canvas"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') goTo(index - 1);
        if (event.key === 'ArrowRight') goTo(index + 1);
        if (event.key === 'Escape') close();
      }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between px-2">
        <button
          type="button"
          aria-label={t('viewer.close')}
          onClick={close}
          className="grid size-11 place-items-center"
        >
          <X aria-hidden className="size-6" />
        </button>
        <p className="text-sm font-semibold">
          {t('viewer.position', { current: index + 1, total: space.counts.snaps })}
        </p>
        <span className="size-11" />
      </header>
      <div
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget;
          const next = Math.round(element.scrollLeft / element.clientWidth);
          if (next !== index) setIndex(next);
        }}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        {snaps.map((snap, position) => (
          <div key={snap.id} className="w-full shrink-0 snap-start overflow-y-auto">
            {Math.abs(position - index) <= 1 ? (
              <Slide
                snap={snap}
                active={position === index}
                onPrevious={position > 0 ? () => goTo(position - 1) : undefined}
                onNext={position < snaps.length - 1 ? () => goTo(position + 1) : undefined}
              />
            ) : null}
          </div>
        ))}
      </div>
      {/* Keyed by snap, so another snap starts without the messages of this one. */}
      <Actions key={current.id} space={space} snap={current} onDeleted={close} />
    </div>
  );
}

function Slide({
  snap,
  active,
  onPrevious,
  onNext,
}: {
  snap: Snap;
  active: boolean;
  onPrevious: (() => void) | undefined;
  onNext: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const detail = useSnap(snap.id);
  const arrow =
    'absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-stage/50 text-on-stage';
  return (
    <div className="mx-auto flex max-w-lg flex-col pb-6">
      <div className="relative bg-stage">
        <img
          src={detail.data?.imageUrl ?? snap.thumbnailUrl}
          width={snap.width}
          height={snap.height}
          alt={t('viewer.photo', { date: formatDateTime(snap.takenAt) })}
          className="mx-auto max-h-photo w-full object-contain"
        />
        {onPrevious === undefined ? null : (
          <button
            type="button"
            aria-label={t('viewer.previous')}
            onClick={onPrevious}
            className={`${arrow} left-2`}
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
        )}
        {onNext === undefined ? null : (
          <button
            type="button"
            aria-label={t('viewer.next')}
            onClick={onNext}
            className={`${arrow} right-2`}
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-5 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Avatar user={snap.author} size="sm" />
          <div className="flex flex-col text-sm">
            <span className="font-semibold">{snap.author.name}</span>
            <span className="text-muted">{formatDateTime(snap.takenAt)}</span>
          </div>
        </div>
        {snap.note === null ? null : <p>{snap.note}</p>}
        {active ? <InsightPanel snapId={snap.id} status={snap.analysisStatus} /> : null}
      </div>
    </div>
  );
}

/** Reanalyze, share as a Moment and delete, for whoever may do them. */
function Actions({ space, snap, onDeleted }: { space: Space; snap: Snap; onDeleted: () => void }) {
  const { t } = useTranslation();
  const userId = useCurrentUserId();
  const reanalyze = useReanalyzeSnap(space.id);
  const remove = useDeleteSnap(space.id);
  const share = useShareMoment();
  const [sharing, setSharing] = useState(false);
  const isAuthor = snap.author.id === userId;
  const canManage = space.myRole === 'OWNER' || (isAuthor && space.myRole === 'EDITOR');
  const analyzing = snap.analysisStatus === 'PENDING' || snap.analysisStatus === 'PROCESSING';

  if (!canManage && !isAuthor) return null;
  const error = reanalyze.error ?? remove.error ?? share.error;
  const action =
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold disabled:opacity-50';

  return (
    <div className="shrink-0 border-t border-line bg-surface pb-safe">
      <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 pt-2">
        {error === null ? null : <FormAlert>{t(errorKey(error))}</FormAlert>}
        {share.isSuccess ? (
          <Notice>{t('viewer.shared', { date: formatDateTime(share.data.expiresAt) })}</Notice>
        ) : null}
        {sharing ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{t('viewer.shareTitle')}</legend>
            {AUDIENCES.map((audience) => (
              <Button
                key={audience}
                variant="secondary"
                disabled={share.isPending}
                onClick={() => {
                  share.mutate(
                    { snapId: snap.id, audience },
                    {
                      onSuccess: () => {
                        setSharing(false);
                      },
                    },
                  );
                }}
              >
                {t(`viewer.audiences.${audience}`)}
              </Button>
            ))}
          </fieldset>
        ) : null}
      </div>
      <div role="group" aria-label={t('viewer.actions')} className="mx-auto flex max-w-lg">
        {canManage ? (
          <button
            type="button"
            disabled={analyzing || reanalyze.isPending}
            onClick={() => {
              if (window.confirm(t('viewer.reanalyzeConfirm'))) reanalyze.mutate(snap.id);
            }}
            className={action}
          >
            <RefreshCw aria-hidden className="size-5" />
            {t('viewer.reanalyze')}
          </button>
        ) : null}
        {isAuthor ? (
          <button
            type="button"
            aria-expanded={sharing}
            onClick={() => {
              setSharing(!sharing);
            }}
            className={action}
          >
            <Send aria-hidden className="size-5" />
            {t('viewer.share')}
          </button>
        ) : null}
        {canManage ? (
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(t('viewer.deleteConfirm'))) {
                remove.mutate(snap.id, { onSuccess: onDeleted });
              }
            }}
            className={`${action} text-danger`}
          >
            <Trash2 aria-hidden className="size-5" />
            {t('viewer.delete')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
