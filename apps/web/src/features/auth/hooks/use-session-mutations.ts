import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login, logout, register } from '../api';

export function useLogin() {
  return useMutation({ mutationFn: login });
}

export function useRegister() {
  return useMutation({ mutationFn: register });
}

/** Signs out and forgets every cached answer of the previous user. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
    },
  });
}
