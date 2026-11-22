import { Outlet } from 'react-router';
import { BottomNav } from '../../components/bottom-nav';
import { TopBar } from '../../components/top-bar';

/** Signed-in screens: a phone-width column with the top bar and the bottom navigation. */
export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <TopBar />
      <main className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-safe-nav">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
