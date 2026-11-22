import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../app/app';
import { routes } from '../app/router';
import { createQueryClient } from '../lib/query-client';

/** The whole app (routes, session and data) on a memory router, opened at the given path. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    router,
    ...render(
      <AppProviders queryClient={createQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  };
}
