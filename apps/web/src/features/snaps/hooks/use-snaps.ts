import type { SpaceAnalysisStatus } from '@snapia/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { pageParams } from '../../../lib/pagination';
import { spaceKeys } from '../../spaces/api';
import {
  createMoment,
  deleteSnap,
  getAnalysisStatus,
  getInsight,
  getSnap,
  listSpaceSnaps,
  reanalyzeSnap,
  snapKeys,
} from '../api';

export function useSpaceSnaps(spaceId: string) {
  return useInfiniteQuery({
    queryKey: snapKeys.list(spaceId),
    queryFn: ({ pageParam, signal }) => listSpaceSnaps(spaceId, pageParam, signal),
    ...pageParams,
  });
}

function isAnalyzing(status: SpaceAnalysisStatus): boolean {
  return status.counts.PENDING + status.counts.PROCESSING > 0;
}

/**
 * Asks how the analysis is going every pollIntervalMs (analysis_poll_interval_ms) while some
 * snaps are PENDING or PROCESSING, and reads the snaps again whenever the counts change.
 */
export function useAnalysisPolling(spaceId: string) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: snapKeys.analysisStatus(spaceId),
    queryFn: ({ signal }) => getAnalysisStatus(spaceId, signal),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data !== undefined && isAnalyzing(data) ? data.pollIntervalMs : false;
    },
  });
  const signature = status.data === undefined ? undefined : JSON.stringify(status.data.counts);
  const previous = useRef(signature);
  useEffect(() => {
    if (previous.current !== undefined && signature !== previous.current) {
      void queryClient.invalidateQueries({ queryKey: snapKeys.list(spaceId) });
      void queryClient.invalidateQueries({ queryKey: snapKeys.insights() });
      void queryClient.invalidateQueries({ queryKey: spaceKeys.detail(spaceId) });
    }
    previous.current = signature;
  }, [queryClient, signature, spaceId]);
  return status;
}

export function useSnap(snapId: string) {
  return useQuery({
    queryKey: snapKeys.detail(snapId),
    queryFn: ({ signal }) => getSnap(snapId, signal),
  });
}

export function useSnapInsight(snapId: string) {
  return useQuery({
    queryKey: snapKeys.insight(snapId),
    queryFn: ({ signal }) => getInsight(snapId, signal),
  });
}

/** After a change, the snaps, the counts and the analysis status of the Space are read again. */
function useRefreshSpace(spaceId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: snapKeys.list(spaceId) });
    void queryClient.invalidateQueries({ queryKey: snapKeys.analysisStatus(spaceId) });
    void queryClient.invalidateQueries({ queryKey: spaceKeys.detail(spaceId) });
  };
}

export function useReanalyzeSnap(spaceId: string) {
  const refresh = useRefreshSpace(spaceId);
  return useMutation({ mutationFn: reanalyzeSnap, onSuccess: refresh });
}

export function useDeleteSnap(spaceId: string) {
  const refresh = useRefreshSpace(spaceId);
  return useMutation({ mutationFn: deleteSnap, onSuccess: refresh });
}

export function useShareMoment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMoment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moments'] });
    },
  });
}

export { useRefreshSpace };
