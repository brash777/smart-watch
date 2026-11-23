import { spaceRoleSchema } from '@snapia/shared';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useParams } from 'react-router';
import { z } from 'zod';
import { paths } from '../../../app/paths';
import { BackLink } from '../../../components/back-link';
import { Notice } from '../../../components/notice';
import { ErrorState } from '../../../components/state-message';
import { errorKey } from '../../../i18n/error-key';
import { ApiError } from '../../../lib/http';
import { SpaceHeader, SpaceHeaderSkeleton } from '../components/space-header';
import { SpaceTabs } from '../components/space-tabs';
import { useSpace } from '../hooks/use-spaces';

/** Sent by the join page, to confirm what happened. */
const joinedStateSchema = z.object({
  joined: z.object({ role: spaceRoleSchema, alreadyMember: z.boolean() }),
});
/** Sent by the camera after an upload. */
const uploadedStateSchema = z.object({ uploaded: z.number().int().positive() });

/** A Space: its header, its sections as tabs and the open section below them. */
export function SpacePage() {
  const { t } = useTranslation();
  const { spaceId = '' } = useParams();
  const space = useSpace(spaceId);
  const state: unknown = useLocation().state;
  const joined = joinedStateSchema.safeParse(state).data?.joined;
  const uploaded = uploadedStateSchema.safeParse(state).data?.uploaded;
  const back = <BackLink to={paths.spaces}>{t('spaces.title')}</BackLink>;

  if (space.isPending) {
    return (
      <div className="flex flex-col gap-1">
        {back}
        <SpaceHeaderSkeleton />
      </div>
    );
  }
  if (space.isError) {
    // A Space that does not exist or is not shared with you: retrying changes nothing.
    const final = space.error instanceof ApiError && [403, 404].includes(space.error.status);
    return (
      <div className="flex flex-col gap-1">
        {back}
        <ErrorState
          message={final ? t(errorKey(space.error)) : t('spaces.detail.error')}
          onRetry={
            final
              ? undefined
              : () => {
                  void space.refetch();
                }
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        {back}
        <SpaceHeader space={space.data} />
      </div>
      {joined === undefined ? null : (
        <Notice>
          {joined.alreadyMember
            ? t('spaces.detail.alreadyMember')
            : t('spaces.detail.joined', { role: t(`roles.${joined.role}`) })}
        </Notice>
      )}
      {uploaded === undefined ? null : (
        <Notice>{t('spaces.detail.uploaded', { count: uploaded })}</Notice>
      )}
      <div className="flex flex-col gap-4">
        <SpaceTabs space={space.data} />
        <Outlet context={space.data} />
      </div>
    </>
  );
}
