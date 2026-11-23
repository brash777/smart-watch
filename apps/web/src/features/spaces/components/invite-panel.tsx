import type { Space, SpaceInvite } from '@snapia/shared';
import { Link2, MessageCircle, Share2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { buttonClassName } from '../../../components/button-styles';
import { FormAlert } from '../../../components/form-alert';
import { Skeleton } from '../../../components/skeleton';
import { ErrorState } from '../../../components/state-message';
import { env } from '../../../config/env';
import { errorKey } from '../../../i18n/error-key';
import { copyText } from '../../../lib/clipboard';
import { formatDate } from '../../../lib/format';
import { useCreateInvite, useRevokeInvite, useSpaceInvites } from '../hooks/use-space-sharing';

type InviteRole = SpaceInvite['role'];

const INVITE_ROLES: readonly InviteRole[] = ['EDITOR', 'VIEWER'];
/** Codes are easier to read out and type in groups, like a card number. */
const CODE_GROUP_LENGTH = 4;

function groupCode(code: string): string {
  return code.match(new RegExp(`.{1,${String(CODE_GROUP_LENGTH)}}`, 'g'))?.join('-') ?? code;
}

/** The page that joins with this code, on the origin the app is running on. */
function joinLink(code: string): string {
  return new URL(paths.join(code), window.location.origin).href;
}

function whatsAppLink(message: string): string {
  const url = new URL(env.whatsappShareUrl);
  url.searchParams.set('text', message);
  return url.href;
}

/** OWNERs create invite codes and share them by WhatsApp, as a link or with the phone's menu. */
export function InvitePanel({ space }: { space: Space }) {
  const { t } = useTranslation();
  const [role, setRole] = useState<InviteRole>('EDITOR');
  const createInvite = useCreateInvite(space.id);

  function submit(event: FormEvent) {
    event.preventDefault();
    createInvite.mutate({ role });
  }

  return (
    <section aria-labelledby="invite-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="invite-title" className="font-display text-xl font-bold tracking-tight">
          {t('members.invite.title')}
        </h2>
        <p className="text-muted">{t('members.invite.text')}</p>
        {space.visibility === 'PRIVATE' ? (
          <p className="text-sm text-muted">{t('members.invite.privateNote')}</p>
        ) : null}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t('members.invite.roleLegend')}</legend>
          {INVITE_ROLES.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-3 rounded-control border border-line bg-surface p-3 has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
            >
              <input
                type="radio"
                name="invite-role"
                value={option}
                checked={role === option}
                onChange={() => {
                  setRole(option);
                }}
                className="mt-1 size-4 accent-ink"
              />
              <span className="flex flex-col">
                <span className="font-semibold">{t(`members.invite.roles.${option}.label`)}</span>
                <span className="text-sm text-muted">
                  {t(`members.invite.roles.${option}.text`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {createInvite.isError ? <FormAlert>{t(errorKey(createInvite.error))}</FormAlert> : null}
        <Button type="submit" disabled={createInvite.isPending}>
          {createInvite.isPending ? t('members.invite.creating') : t('members.invite.create')}
        </Button>
      </form>
      <ActiveInvites space={space} />
    </section>
  );
}

function ActiveInvites({ space }: { space: Space }) {
  const { t } = useTranslation();
  const invites = useSpaceInvites(space.id);
  const active = invites.data?.filter((invite) => invite.status === 'ACTIVE') ?? [];

  function list() {
    if (invites.isPending) return <Skeleton className="h-28 rounded-card" />;
    if (invites.isError) {
      return (
        <ErrorState
          message={t('members.invite.loadError')}
          onRetry={() => {
            void invites.refetch();
          }}
        />
      );
    }
    if (active.length === 0)
      return <p className="text-sm text-muted">{t('members.invite.none')}</p>;
    return (
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {active.map((invite) => (
          <li key={invite.id}>
            <InviteItem space={space} invite={invite} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{t('members.invite.activeTitle')}</h3>
      {list()}
    </div>
  );
}

function InviteItem({ space, invite }: { space: Space; invite: SpaceInvite }) {
  const { t } = useTranslation();
  const revoke = useRevokeInvite(space.id);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const code = groupCode(invite.code);
  const link = joinLink(invite.code);
  const message = t('members.invite.message', { space: space.name, app: env.appName, link });
  const canShare = 'share' in navigator;
  const secondary = buttonClassName({ variant: 'secondary', fullWidth: false });

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-display text-2xl font-bold tracking-widest select-all">{code}</p>
          <p className="flex flex-wrap gap-x-3 text-sm text-muted">
            <span>{t('members.invite.grants', { role: t(`roles.${invite.role}`) })}</span>
            <span>{t('members.invite.expires', { date: formatDate(invite.expiresAt) })}</span>
            <span>{t('members.invite.uses', { uses: invite.uses, maxUses: invite.maxUses })}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={revoke.isPending}
          aria-label={t('members.invite.revokeLabel', { code })}
          onClick={() => {
            revoke.mutate(invite.id);
          }}
          className="min-h-11 shrink-0 px-2 text-sm font-semibold text-danger disabled:opacity-60"
        >
          {t('members.invite.revoke')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsAppLink(message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('members.invite.whatsappLabel', { code })}
          className={secondary}
        >
          <MessageCircle aria-hidden className="size-5" />
          {t('members.invite.whatsapp')}
        </a>
        <button
          type="button"
          aria-label={t('members.invite.copyLinkLabel', { code })}
          className={secondary}
          onClick={() => {
            void copyText(link).then((copied) => {
              setCopy(copied ? 'copied' : 'failed');
            });
          }}
        >
          <Link2 aria-hidden className="size-5" />
          {t('members.invite.copyLink')}
        </button>
        {canShare ? (
          <button
            type="button"
            aria-label={t('members.invite.shareLabel', { code })}
            className={secondary}
            onClick={() => {
              navigator.share({ text: message }).catch(() => {
                // Closing the share sheet is not an error.
              });
            }}
          >
            <Share2 aria-hidden className="size-5" />
            {t('members.invite.share')}
          </button>
        ) : null}
      </div>
      <p role="status" className="text-sm text-muted empty:hidden">
        {copy === 'copied' ? t('members.invite.copied') : null}
        {copy === 'failed' ? t('members.invite.copyFailed') : null}
      </p>
      {revoke.isError ? <FormAlert>{t(errorKey(revoke.error))}</FormAlert> : null}
    </div>
  );
}
