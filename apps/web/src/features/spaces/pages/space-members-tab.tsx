import { useTranslation } from 'react-i18next';
import { Avatar } from '../../../components/avatar';
import { LoadMore } from '../../../components/load-more';
import { Skeleton } from '../../../components/skeleton';
import { ErrorState } from '../../../components/state-message';
import { useCurrentUserId } from '../../auth/hooks/use-auth';
import { InvitePanel } from '../components/invite-panel';
import { useSpaceOutlet } from '../hooks/use-space-outlet';
import { useSpaceMembers } from '../hooks/use-space-sharing';
import { canInvite } from '../space-permissions';

export function SpaceMembersTab() {
  const { t } = useTranslation();
  const space = useSpaceOutlet();
  const members = useSpaceMembers(space.id);
  const userId = useCurrentUserId();
  const items = members.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-8">
      {canInvite(space) ? <InvitePanel space={space} /> : null}
      <section aria-labelledby="members-title" className="flex flex-col gap-2">
        <h2 id="members-title" className="font-display text-xl font-bold tracking-tight">
          {t('members.listTitle')}
        </h2>
        {members.isPending ? <Skeleton className="h-14 rounded-control" /> : null}
        {members.isError ? (
          <ErrorState
            message={t('members.error')}
            onRetry={() => {
              void members.refetch();
            }}
          />
        ) : null}
        <ul className="flex flex-col divide-y divide-line">
          {items.map((member) => (
            <li key={member.user.id} className="flex items-center gap-3 py-3">
              <Avatar user={member.user} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">
                  {member.user.name}
                  {member.user.id === userId ? (
                    <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">
                      {t('members.you')}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-sm text-muted">
                  {t('common.username', { username: member.user.username })}
                </span>
              </span>
              <span className="text-sm text-muted">{t(`roles.${member.role}`)}</span>
            </li>
          ))}
        </ul>
        <LoadMore
          hasMore={members.hasNextPage}
          loading={members.isFetchingNextPage}
          onLoad={() => {
            void members.fetchNextPage();
          }}
        />
      </section>
    </div>
  );
}
