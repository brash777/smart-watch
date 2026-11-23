import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pageParams } from '../../../lib/pagination';
import { createSpace, getSpace, joinSpace, listMySpaces, spaceKeys } from '../api';

export function useMySpaces() {
  return useInfiniteQuery({
    queryKey: spaceKeys.lists(),
    queryFn: ({ pageParam, signal }) => listMySpaces(pageParam, signal),
    ...pageParams,
  });
}

export function useSpace(spaceId: string) {
  return useQuery({
    queryKey: spaceKeys.detail(spaceId),
    queryFn: ({ signal }) => getSpace(spaceId, signal),
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSpace,
    onSuccess: (space) => {
      queryClient.setQueryData(spaceKeys.detail(space.id), space);
      void queryClient.invalidateQueries({ queryKey: spaceKeys.lists() });
    },
  });
}

export function useJoinSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: joinSpace,
    onSuccess: ({ space }) => {
      queryClient.setQueryData(spaceKeys.detail(space.id), space);
      void queryClient.invalidateQueries({ queryKey: spaceKeys.lists() });
    },
  });
}
