import {
  momentSchema,
  snapAnalysisStateSchema,
  snapDetailSchema,
  snapInsightSchema,
  snapSchema,
  spaceAnalysisStatusSchema,
  type CreateMomentBody,
  type Moment,
  type Snap,
  type SnapDetail,
  type SnapInsight,
  type SpaceAnalysisStatus,
} from '@snapia/shared';
import { z } from 'zod';
import { ApiError, apiRequest, apiSend, apiUpload, type UploadOptions } from '../../lib/http';
import { apiPage, type Page } from '../../lib/pagination';

export const snapKeys = {
  all: ['snaps'] as const,
  lists: () => [...snapKeys.all, 'list'] as const,
  list: (spaceId: string) => [...snapKeys.lists(), spaceId] as const,
  detail: (snapId: string) => [...snapKeys.all, 'detail', snapId] as const,
  insights: () => [...snapKeys.all, 'insight'] as const,
  insight: (snapId: string) => [...snapKeys.insights(), snapId] as const,
  analysisStatus: (spaceId: string) => [...snapKeys.all, 'analysis-status', spaceId] as const,
};

export function listSpaceSnaps(
  spaceId: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<Page<Snap>> {
  return apiPage(`/spaces/${spaceId}/snaps`, snapSchema, { cursor, signal });
}

export async function getSnap(snapId: string, signal?: AbortSignal): Promise<SnapDetail> {
  return (await apiRequest(`/snaps/${snapId}`, snapDetailSchema, { signal })).data;
}

export function uploadSnaps(
  spaceId: string,
  files: Blob[],
  note: string,
  options: UploadOptions,
): Promise<Snap[]> {
  const form = new FormData();
  files.forEach((file, index) => {
    form.append('files', file, file instanceof File ? file.name : `snap-${String(index + 1)}.jpg`);
  });
  if (note.trim() !== '') form.append('note', note.trim());
  return apiUpload(`/spaces/${spaceId}/snaps`, form, z.array(snapSchema), options);
}

export function deleteSnap(snapId: string): Promise<void> {
  return apiSend(`/snaps/${snapId}`, { method: 'DELETE' });
}

/** The insight of a snap, or null while it has none (pending, processing or failed). */
export async function getInsight(
  snapId: string,
  signal?: AbortSignal,
): Promise<SnapInsight | null> {
  try {
    return (await apiRequest(`/snaps/${snapId}/insight`, snapInsightSchema, { signal })).data;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INSIGHT_NOT_FOUND') return null;
    throw error;
  }
}

export async function reanalyzeSnap(snapId: string) {
  return (
    await apiRequest(`/snaps/${snapId}/reanalyze`, snapAnalysisStateSchema, { method: 'POST' })
  ).data;
}

export async function getAnalysisStatus(
  spaceId: string,
  signal?: AbortSignal,
): Promise<SpaceAnalysisStatus> {
  return (
    await apiRequest(`/spaces/${spaceId}/analysis-status`, spaceAnalysisStatusSchema, { signal })
  ).data;
}

export async function createMoment(body: CreateMomentBody): Promise<Moment> {
  return (await apiRequest('/moments', momentSchema, { method: 'POST', body })).data;
}
