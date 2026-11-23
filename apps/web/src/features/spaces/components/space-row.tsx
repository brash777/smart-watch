import type { Space } from '@snapia/shared';
import { ChevronRight, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { ModeTile } from '../../../components/mode-tile';
import { Skeleton } from '../../../components/skeleton';
import { modes } from '../../../config/modes';

/** One Space in the list: its mode, its name and how many snaps (and people) it has. */
export function SpaceRow({ space }: { space: Space }) {
  const { t } = useTranslation();
  const shared = space.counts.members > 1;
  return (
    <Link to={paths.space(space.id)} className="flex min-h-11 items-center gap-3 py-3">
      <ModeTile mode={space.mode} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold">{space.name}</span>
        <span className="flex flex-wrap gap-x-3 text-sm text-muted">
          <span>{t(modes[space.mode].labelKey)}</span>
          <span>{t('spaces.snapCount', { count: space.counts.snaps })}</span>
          {shared ? (
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden className="size-3.5" />
              {t('spaces.memberCount', { count: space.counts.members })}
            </span>
          ) : null}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
    </Link>
  );
}

export function SpaceRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="size-11 rounded-control" />
      <span className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2 rounded-full" />
        <Skeleton className="h-3 w-1/3 rounded-full" />
      </span>
    </div>
  );
}
