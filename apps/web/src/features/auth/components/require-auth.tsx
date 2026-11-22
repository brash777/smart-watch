import { Navigate, Outlet, useLocation } from 'react-router';
import { paths } from '../../../app/paths';
import { FullScreenLoader } from '../../../components/full-screen-loader';
import { useAuth } from '../hooks/use-auth';

/** Routes for signed-in users; the others go to the login and come back after it. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <FullScreenLoader />;
  if (auth.status === 'anonymous') {
    return <Navigate to={paths.login} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
