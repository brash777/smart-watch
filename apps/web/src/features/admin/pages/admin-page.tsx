import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { FormAlert } from '../../../components/form-alert';
import { LoadMore } from '../../../components/load-more';
import { PageHeader } from '../../../components/page-header';
import { Skeleton } from '../../../components/skeleton';
import { ErrorState } from '../../../components/state-message';
import { modeOrder, modes } from '../../../config/modes';
import { errorKey } from '../../../i18n/error-key';
import { pageParams } from '../../../lib/pagination';
import { useAuth } from '../../auth/hooks/use-auth';
import { adminKeys, getStats, listSettings, listUsers, setUserActive } from '../api';
import { SettingRow } from '../components/setting-row';

/** /admin: numbers of the app, AppSettings and users. Only for ADMINs. */
export function AdminPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.status === 'authenticated' && auth.user.role !== 'ADMIN') {
    return <Navigate to={paths.home} replace />;
  }
  return (
    <>
      <PageHeader title={t('admin.title')} />
      <Stats />
      <Users />
      <Settings />
    </>
  );
}

function Stats() {
  const { t, i18n } = useTranslation();
  const stats = useQuery({ queryKey: adminKeys.stats, queryFn: ({ signal }) => getStats(signal) });
  if (stats.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (stats.isError) return <ErrorState message={t(errorKey(stats.error))} />;
  const { users, snapsByMode, documents, ai } = stats.data;
  const money = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD' });
  const cards: { label: string; value: string; detail?: string }[] = [
    {
      label: t('admin.stats.users'),
      value: String(users.total),
      detail: t('admin.stats.active', { count: users.active }),
    },
    ...modeOrder.map((mode) => ({
      label: t('admin.stats.snaps', { mode: t(modes[mode].labelKey) }),
      value: String(snapsByMode[mode]),
    })),
    { label: t('admin.stats.documents'), value: String(documents) },
    {
      label: t('admin.stats.aiCost'),
      value: money.format(ai.estimatedCostUsd),
      detail: t('admin.stats.aiRuns', { count: ai.runs, failed: ai.failed }),
    },
  ];
  return (
    <section aria-label={t('admin.stats.title')}>
      <ul className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <li
            key={card.label}
            className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4"
          >
            <span className="text-sm text-muted">{card.label}</span>
            <span className="font-display text-3xl font-bold">{card.value}</span>
            {card.detail === undefined ? null : (
              <span className="text-xs text-muted">{card.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Users() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const users = useInfiniteQuery({
    queryKey: adminKeys.users(query),
    queryFn: ({ pageParam, signal }) => listUsers(query, pageParam, signal),
    ...pageParams,
  });
  const status = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setUserActive(id, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(text.trim());
  }

  return (
    <section aria-labelledby="admin-users" className="flex flex-col gap-3">
      <h2 id="admin-users" className="font-display text-xl font-bold">
        {t('admin.users.title')}
      </h2>
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t('admin.users.search')}</span>
          <input
            value={text}
            placeholder={t('admin.users.search')}
            onChange={(event) => {
              setText(event.target.value);
            }}
            className="min-h-11 w-full rounded-control border border-field-border bg-surface px-3"
          />
        </label>
        <Button type="submit" variant="secondary" fullWidth={false}>
          {t('admin.users.searchButton')}
        </Button>
      </form>
      {status.isError ? <FormAlert>{t(errorKey(status.error))}</FormAlert> : null}
      {users.isError ? <ErrorState message={t(errorKey(users.error))} /> : null}
      <ul className="flex flex-col divide-y divide-line">
        {items.map((user) => (
          <li key={user.id} className="flex items-center gap-3 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {user.name} {user.role === 'ADMIN' ? `(${t('admin.users.admin')})` : null}
              </span>
              <span className="truncate text-sm text-muted">
                {t('common.username', { username: user.username })}
              </span>
            </span>
            <Button
              variant={user.isActive ? 'secondary' : 'primary'}
              fullWidth={false}
              disabled={status.isPending}
              onClick={() => {
                status.mutate({ id: user.id, isActive: !user.isActive });
              }}
            >
              {user.isActive ? t('admin.users.deactivate') : t('admin.users.activate')}
            </Button>
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={users.hasNextPage}
        loading={users.isFetchingNextPage}
        onLoad={() => {
          void users.fetchNextPage();
        }}
      />
    </section>
  );
}

function Settings() {
  const { t } = useTranslation();
  const settings = useQuery({
    queryKey: adminKeys.settings,
    queryFn: ({ signal }) => listSettings(signal),
  });
  return (
    <section aria-labelledby="admin-settings" className="flex flex-col gap-1">
      <h2 id="admin-settings" className="font-display text-xl font-bold">
        {t('admin.settings.title')}
      </h2>
      <p className="text-sm text-muted">{t('admin.settings.intro')}</p>
      {settings.isPending ? <Skeleton className="h-40 rounded-card" /> : null}
      {settings.isError ? <ErrorState message={t(errorKey(settings.error))} /> : null}
      <ul className="flex flex-col divide-y divide-line">
        {(settings.data ?? []).map((setting) => (
          <SettingRow key={`${setting.key}-${setting.updatedAt}`} setting={setting} />
        ))}
      </ul>
    </section>
  );
}
