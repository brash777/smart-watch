import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { Button } from '../../../components/button';
import { buttonClassName } from '../../../components/button-styles';
import { useAuth } from '../../auth/hooks/use-auth';
import { useLogout } from '../../auth/hooks/use-session-mutations';
import { UserProfile } from '../../social/components/user-profile';

/** Your own public profile, plus the admin panel (for ADMINs) and the logout. */
export function ProfilePage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const logout = useLogout();
  if (auth.status !== 'authenticated') return null;

  return (
    <>
      <h1 className="sr-only">{t('profile.title')}</h1>
      <UserProfile username={auth.user.username} />
      {auth.user.role === 'ADMIN' ? (
        <Link to={paths.admin} className={buttonClassName({ variant: 'secondary' })}>
          {t('profile.admin')}
        </Link>
      ) : null}
      <Button
        variant="secondary"
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
