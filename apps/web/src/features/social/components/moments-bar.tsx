import type { MomentGroup } from '@snapia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../../../components/avatar';
import { formatDateTime } from '../../../lib/format';
import { getMomentsFeed, socialKeys, viewMoment } from '../api';

/** The row of Moments at the top of Home: one ring per person, brighter when there is news. */
export function MomentsBar() {
  const { t } = useTranslation();
  const moments = useQuery({
    queryKey: socialKeys.moments,
    queryFn: ({ signal }) => getMomentsFeed(signal),
  });
  const [open, setOpen] = useState<number | null>(null);
  const groups = moments.data ?? [];
  if (groups.length === 0) return null;

  return (
    <section aria-label={t('moments.label')}>
      <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
        {groups.map((group, index) => (
          <li key={group.author.id}>
            <button
              type="button"
              onClick={() => {
                setOpen(index);
              }}
              aria-label={t('moments.open', { username: group.author.username })}
              className="flex w-16 flex-col items-center gap-1"
            >
              <span
                className={`rounded-full p-0.5 ${group.hasUnseen ? 'bg-mode-content' : 'bg-line'}`}
              >
                <span className="block rounded-full bg-canvas p-0.5">
                  <Avatar user={group.author} />
                </span>
              </span>
              <span className="w-full truncate text-xs">{group.author.username}</span>
            </button>
          </li>
        ))}
      </ul>
      {open === null ? null : (
        <MomentViewer
          groups={groups}
          startGroup={open}
          onClose={() => {
            setOpen(null);
          }}
        />
      )}
    </section>
  );
}

/** Full screen; a tap on the right half goes forward and on the left half goes back. */
function MomentViewer({
  groups,
  startGroup,
  onClose,
}: {
  groups: MomentGroup[];
  startGroup: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [position, setPosition] = useState({ group: startGroup, moment: 0 });
  const group = groups[position.group];
  const moment = group?.moments[position.moment];
  const view = useMutation({
    mutationFn: viewMoment,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: socialKeys.moments });
    },
  });
  const { mutate } = view;

  useEffect(() => {
    if (moment !== undefined && !moment.viewedByMe) mutate(moment.id);
  }, [moment, mutate]);

  if (group === undefined || moment === undefined) return null;

  function step(direction: 1 | -1) {
    if (group === undefined) return;
    const next = position.moment + direction;
    if (next >= 0 && next < group.moments.length) {
      setPosition({ group: position.group, moment: next });
    } else if (direction === 1 && position.group + 1 < groups.length) {
      setPosition({ group: position.group + 1, moment: 0 });
    } else if (direction === -1 && position.group > 0) {
      setPosition({ group: position.group - 1, moment: 0 });
    } else if (direction === 1) {
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={t('moments.viewer', { username: group.author.username })}
      className="fixed inset-0 z-20 flex flex-col bg-stage text-on-stage"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'ArrowRight') step(1);
        if (event.key === 'ArrowLeft') step(-1);
      }}
    >
      <div className="flex gap-1 px-2 pt-3">
        {group.moments.map((item, index) => (
          <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-on-stage/30">
            <span
              className={`block h-full bg-on-stage ${index <= position.moment ? 'w-full' : 'w-0'}`}
            />
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 px-3 py-3">
        <Avatar user={group.author} size="sm" />
        <span className="font-semibold">{group.author.username}</span>
        <span className="text-sm opacity-80">{formatDateTime(moment.createdAt)}</span>
        <button
          type="button"
          autoFocus
          aria-label={t('moments.close')}
          onClick={onClose}
          className="ml-auto grid size-11 place-items-center"
        >
          <X aria-hidden className="size-6" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <img
          src={moment.image.imageUrl}
          alt={t('moments.photo', { username: group.author.username })}
          className="size-full object-contain"
        />
        <button
          type="button"
          aria-label={t('moments.previous')}
          onClick={() => {
            step(-1);
          }}
          className="absolute inset-y-0 left-0 w-1/2"
        />
        <button
          type="button"
          aria-label={t('moments.next')}
          onClick={() => {
            step(1);
          }}
          className="absolute inset-y-0 right-0 w-1/2"
        />
      </div>
      {moment.viewsCount === null ? null : (
        <p className="px-4 py-3 pb-safe text-sm">
          {t('moments.views', { count: moment.viewsCount })}
        </p>
      )}
    </div>
  );
}
