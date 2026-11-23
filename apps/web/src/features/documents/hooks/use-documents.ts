import { useInfiniteQuery } from '@tanstack/react-query';
import { pageParams } from '../../../lib/pagination';
import { documentKeys, listSpaceDocuments } from '../api';

export function useSpaceDocuments(spaceId: string) {
  return useInfiniteQuery({
    queryKey: documentKeys.list(spaceId),
    queryFn: ({ pageParam, signal }) => listSpaceDocuments(spaceId, pageParam, signal),
    ...pageParams,
  });
}
