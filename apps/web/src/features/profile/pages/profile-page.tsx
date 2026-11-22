import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/button';
import { PageHeader } from '../../../components/page-header';
import { useAuth } from '../../auth/hooks/use-auth';
import { useLogout } from '../../auth/hooks/use-session-mutations';

export function ProfilePage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const logout = useLogout();
  if (auth.status !== 'authenticated') return null;
  const { user } = auth;

  return (
    <>
      <PageHeader title={t('profile.title')} />
      <section className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{user.name}</p>
        <p>{t('profile.username', { username: user.username })}</p>
      </section>
      <Button
        disabled={logout.isPending}
        onClick={() => {
          logout.mutate();
        }}
      >
        {logout.isPending ? t('profile.loggingOut') : t('profile.logout')}
      </Button>
    </>
  );
}
