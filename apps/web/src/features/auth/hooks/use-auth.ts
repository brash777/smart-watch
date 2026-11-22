import { useContext } from 'react';
import { AuthContext, type AuthState } from '../auth-context';

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (state === null) throw new Error('useAuth() needs an <AuthProvider>');
  return state;
}
