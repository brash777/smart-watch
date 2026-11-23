import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { paths } from '../../../app/paths';
import { BackLink } from '../../../components/back-link';
import { PageHeader } from '../../../components/page-header';
import { Skeleton } from '../../../components/skeleton';
import { ErrorState } from '../../../components/state-message';
import { useAppConfig } from '../../app-config/hooks/use-app-config';
import { CreateSpaceForm } from '../components/create-space-form';
import { useCreateSpace } from '../hooks/use-spaces';

export function CreateSpacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const config = useAppConfig();
  const createSpace = useCreateSpace();

  function form() {
    if (config.isPending) {
      return (
        <div aria-busy className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
        </div>
      );
    }
    if (config.isError) {
      return (
        <ErrorState
          message={t('spaces.form.configError')}
          onRetry={() => {
            void config.refetch();
          }}
        />
      );
    }
    return (
      <CreateSpaceForm
        palette={config.data.spaces.colorPalette}
        pending={createSpace.isPending}
        error={createSpace.error}
        onSubmit={(body) => {
          createSpace.mutate(body, {
            onSuccess: (space) => {
              void navigate(paths.space(space.id), { replace: true });
            },
          });
        }}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <BackLink to={paths.spaces}>{t('spaces.title')}</BackLink>
        <PageHeader title={t('spaces.form.title')} />
      </div>
      {form()}
    </>
  );
}
