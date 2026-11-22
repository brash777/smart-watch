import type { MeUser } from '@snapia/shared';
import { createContext } from 'react';

/** loading: the app is checking the refresh cookie when it starts. */
export type AuthState =
  { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: MeUser };

export const AuthContext = createContext<AuthState | null>(null);
