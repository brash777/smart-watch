import type { RouteObject } from 'react-router';
import { GuestOnly } from '../features/auth/components/guest-only';
import { RequireAuth } from '../features/auth/components/require-auth';
import { LoginPage } from '../features/auth/pages/login-page';
import { RegisterPage } from '../features/auth/pages/register-page';
import { CapturePage } from '../features/capture/pages/capture-page';
import { ExplorePage } from '../features/explore/pages/explore-page';
import { HomePage } from '../features/home/pages/home-page';
import { ProfilePage } from '../features/profile/pages/profile-page';
import { SpacesPage } from '../features/spaces/pages/spaces-page';
import { AppLayout } from './layouts/app-layout';
import { NotFoundPage } from './not-found-page';
import { paths } from './paths';

export const routes: RouteObject[] = [
  {
    element: <GuestOnly />,
    children: [
      { path: paths.login, element: <LoginPage /> },
      { path: paths.register, element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: paths.home, element: <HomePage /> },
          { path: paths.spaces, element: <SpacesPage /> },
          { path: paths.capture, element: <CapturePage /> },
          { path: paths.explore, element: <ExplorePage /> },
          { path: paths.profile, element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
