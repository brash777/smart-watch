import type { RouteObject } from 'react-router';
import { GuestOnly } from '../features/auth/components/guest-only';
import { RequireAuth } from '../features/auth/components/require-auth';
import { LoginPage } from '../features/auth/pages/login-page';
import { RegisterPage } from '../features/auth/pages/register-page';
import { CapturePage } from '../features/capture/pages/capture-page';
import { ComposePage } from '../features/compose/pages/compose-page';
import { DocumentPage } from '../features/documents/pages/document-page';
import { SpaceDocumentsTab } from '../features/documents/pages/space-documents-tab';
import { ExplorePage } from '../features/explore/pages/explore-page';
import { HomePage } from '../features/home/pages/home-page';
import { ProfilePage } from '../features/profile/pages/profile-page';
import { UserProfilePage } from '../features/profile/pages/user-profile-page';
import { CreatePostPage } from '../features/social/pages/create-post-page';
import { SpaceSnapsTab } from '../features/snaps/pages/space-snaps-tab';
import { CreateSpacePage } from '../features/spaces/pages/create-space-page';
import { JoinSpacePage } from '../features/spaces/pages/join-space-page';
import { SpaceAskTab } from '../features/spaces/pages/space-ask-tab';
import { SpaceMembersTab } from '../features/spaces/pages/space-members-tab';
import { SpacePage } from '../features/spaces/pages/space-page';
import { SpaceStudyTab } from '../features/spaces/pages/space-study-tab';
import { SpacesPage } from '../features/spaces/pages/spaces-page';
import { AppLayout } from './layouts/app-layout';
import { PublicLayout } from './layouts/public-layout';
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
          { path: paths.newSpace, element: <CreateSpacePage /> },
          {
            path: paths.space(':spaceId'),
            element: <SpacePage />,
            children: [
              { index: true, element: <SpaceSnapsTab /> },
              { path: 'documents', element: <SpaceDocumentsTab /> },
              { path: 'study', element: <SpaceStudyTab /> },
              { path: 'ask', element: <SpaceAskTab /> },
              { path: 'members', element: <SpaceMembersTab /> },
            ],
          },
          { path: paths.compose(':spaceId'), element: <ComposePage /> },
          { path: paths.document(':documentId'), element: <DocumentPage /> },
          { path: paths.join(), element: <JoinSpacePage /> },
          { path: paths.join(':code'), element: <JoinSpacePage /> },
          { path: paths.capture, element: <CapturePage /> },
          { path: paths.newPost, element: <CreatePostPage /> },
          { path: paths.explore, element: <ExplorePage /> },
          { path: paths.profile, element: <ProfilePage /> },
        ],
      },
      // Full screen, without the navigation bars. Loaded on demand (it renders Markdown).
      {
        path: paths.snap(':spaceId', ':snapId'),
        lazy: async () => ({
          Component: (await import('../features/snaps/pages/snap-viewer-page')).SnapViewerPage,
        }),
      },
    ],
  },
  {
    element: <PublicLayout />,
    children: [{ path: paths.user(':username'), element: <UserProfilePage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
];
