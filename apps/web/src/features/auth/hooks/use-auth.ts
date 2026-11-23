import { useContext } from 'react';
import { AuthContext, type AuthState } from '../auth-context';

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (state === null) throw new Error('useAuth() needs an <AuthProvider>');
  return state;
}

/** The id of the signed-in user, or null (signed-in screens always have one). */
export function useCurrentUserId(): string | null {
  const auth = useAuth();
  return auth.status === 'authenticated' ? auth.user.id : null;
}
