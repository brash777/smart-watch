import { Navigate, Outlet, useLocation } from 'react-router';
import { paths } from '../../../app/paths';
import { FullScreenLoader } from '../../../components/full-screen-loader';
import { useAuth } from '../hooks/use-auth';

function returnPath(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const { from } = state;
    if (typeof from === 'string' && from.startsWith('/')) return from;
  }
  return paths.home;
}

/** Login and sign-up: a signed-in user goes on to where they were going, or home. */
export function GuestOnly() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <FullScreenLoader />;
  if (auth.status === 'authenticated') return <Navigate to={returnPath(location.state)} replace />;
  return <Outlet />;
}
