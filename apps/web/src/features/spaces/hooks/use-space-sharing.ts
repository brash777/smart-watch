import type { CreateInviteBody } from '@snapia/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pageParams } from '../../../lib/pagination';
import { createInvite, listInvites, listMembers, revokeInvite, spaceKeys } from '../api';

export function useSpaceMembers(spaceId: string) {
  return useInfiniteQuery({
    queryKey: spaceKeys.members(spaceId),
    queryFn: ({ pageParam, signal }) => listMembers(spaceId, pageParam, signal),
    ...pageParams,
  });
}

export function useSpaceInvites(spaceId: string) {
  return useQuery({
    queryKey: spaceKeys.invites(spaceId),
    queryFn: ({ signal }) => listInvites(spaceId, signal),
  });
}

export function useCreateInvite(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInviteBody) => createInvite(spaceId, body),
    onSuccess: () => {
      // The first invite turns a PRIVATE Space into a MEMBERS one.
      void queryClient.invalidateQueries({ queryKey: spaceKeys.detail(spaceId) });
    },
  });
}

export function useRevokeInvite(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(spaceId, inviteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: spaceKeys.invites(spaceId) });
    },
  });
}
