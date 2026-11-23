import type { Space } from '@snapia/shared';
import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { ModeTile } from '../../../components/mode-tile';
import { Notice } from '../../../components/notice';
import { Skeleton } from '../../../components/skeleton';
import { modes } from '../../../config/modes';
import { canUploadSnaps } from '../space-permissions';

/** The name, mode, counts, description and metadata of a Space. */
export function SpaceHeader({ space }: { space: Space }) {
  const { t } = useTranslation();
  const metadata = modes[space.mode].metadataFields.flatMap((field) => {
    const value = space.metadata[field];
    return value === undefined ? [] : [{ field, value }];
  });

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <ModeTile mode={space.mode} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="font-display text-3xl font-bold tracking-tight break-words">
            {space.name}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                style={{ backgroundColor: space.color }}
                className="size-2.5 rounded-full"
              />
              {t(modes[space.mode].labelKey)}
            </span>
            <span>{t('spaces.snapCount', { count: space.counts.snaps })}</span>
            <span>{t('spaces.memberCount', { count: space.counts.members })}</span>
            {space.myRole === null || space.myRole === 'OWNER' ? null : (
              <span>{t('spaces.detail.role', { role: t(`roles.${space.myRole}`) })}</span>
            )}
          </p>
        </div>
        {canUploadSnaps(space) ? (
          <Link
            to={paths.captureIn(space.id)}
            aria-label={t('spaces.detail.capture')}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-on-ink"
          >
            <Camera aria-hidden className="size-5" />
          </Link>
        ) : null}
      </div>
      {space.description === null ? null : <p>{space.description}</p>}
      {metadata.length === 0 ? null : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {metadata.map(({ field, value }) => (
            <div key={field} className="flex flex-col gap-0.5">
              <dt className="text-muted">{t(`spaces.metadata.${field}`)}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {space.archivedAt === null ? null : <Notice>{t('spaces.detail.archived')}</Notice>}
    </header>
  );
}

export function SpaceHeaderSkeleton() {
  return (
    <div aria-busy className="flex items-start gap-3">
      <Skeleton className="size-14 rounded-card" />
      <span className="flex flex-1 flex-col gap-2 pt-1">
        <Skeleton className="h-7 w-2/3 rounded-full" />
        <Skeleton className="h-4 w-1/2 rounded-full" />
      </span>
    </div>
  );
}
