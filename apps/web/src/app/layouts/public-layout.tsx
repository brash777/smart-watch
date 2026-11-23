import { Outlet } from 'react-router';
import { FullScreenLoader } from '../../components/full-screen-loader';
import { TopBar } from '../../components/top-bar';
import { useAuth } from '../../features/auth/hooks/use-auth';
import { AppLayout } from './app-layout';

/** Pages anyone can open: with the app navigation when signed in, without it otherwise. */
export function PublicLayout() {
  const auth = useAuth();
  if (auth.status === 'loading') return <FullScreenLoader />;
  if (auth.status === 'authenticated') return <AppLayout />;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <TopBar />
      <main className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-8">
        <Outlet />
      </main>
    </div>
  );
}
