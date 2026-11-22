import type { AuthSession } from '@snapia/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import es from '../../../i18n/locales/es.json';
import { apiError, fakeApi } from '../../../test/fake-api';
import { renderApp } from '../../../test/render-app';

const session: AuthSession = {
  accessToken: 'access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    id: '0196a8f0-0000-7000-8000-000000000001',
    name: 'Ana Rivas',
    username: 'ana',
    avatarUrl: null,
    email: 'ana@example.com',
    role: 'USER',
    bio: null,
    university: null,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
};

const noSession = apiError('INVALID_REFRESH_TOKEN', 401);

async function fillIn(identifier: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(es.auth.fields.identifier.label), identifier);
  await user.type(screen.getByLabelText(es.auth.fields.password.label), password);
  await user.click(screen.getByRole('button', { name: es.auth.login.submit }));
}

describe('LoginPage', () => {
  it('signs in and opens the app with its bottom navigation', async () => {
    const api = fakeApi({
      'POST /auth/refresh': noSession,
      'POST /auth/login': { status: 200, body: { data: session } },
    });
    renderApp('/login');

    await fillIn('  Ana  ', 'secreto-123');

    expect(await screen.findByRole('navigation', { name: es.nav.label })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: es.home.title })).toBeInTheDocument();
    for (const label of [
      es.nav.home,
      es.nav.spaces,
      es.nav.capture,
      es.nav.explore,
      es.nav.profile,
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(api.calls.find(({ path }) => path === '/auth/login')).toEqual({
      method: 'POST',
      path: '/auth/login',
      body: { identifier: 'ana', password: 'secreto-123' },
    });
  });

  it('checks the fields before calling the API', async () => {
    const api = fakeApi({ 'POST /auth/refresh': noSession });
    renderApp('/login');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: es.auth.login.submit }));

    const identifier = screen.getByLabelText(es.auth.fields.identifier.label);
    expect(identifier).toHaveAttribute('aria-invalid', 'true');
    expect(identifier).toHaveAccessibleDescription(es.auth.fields.identifier.error);
    expect(screen.getByLabelText(es.auth.fields.password.label)).toHaveAccessibleDescription(
      es.auth.fields.password.error,
    );
    expect(api.calls.map(({ path }) => path)).toEqual(['/auth/refresh']);
  });

  it('says why the API refused the login, without trying to refresh the session', async () => {
    const api = fakeApi({
      'POST /auth/refresh': noSession,
      'POST /auth/login': apiError('INVALID_CREDENTIALS', 401),
    });
    renderApp('/login');

    await fillIn('ana', 'contraseña-mala-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(es.errors.INVALID_CREDENTIALS);
    expect(api.calls.map(({ path }) => path)).toEqual(['/auth/refresh', '/auth/login']);
    expect(screen.queryByRole('navigation', { name: es.nav.label })).not.toBeInTheDocument();
  });

  it('brings a protected page back after signing in', async () => {
    fakeApi({
      'POST /auth/refresh': noSession,
      'POST /auth/login': { status: 200, body: { data: session } },
    });
    const { router } = renderApp('/profile');

    await fillIn('ana', 'secreto-123');

    expect(await screen.findByRole('heading', { name: es.profile.title })).toBeInTheDocument();
    expect(screen.getByText(session.user.name)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile');
  });
});
