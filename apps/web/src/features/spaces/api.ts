import {
  joinSpaceResultSchema,
  spaceInviteSchema,
  spaceMemberSchema,
  spaceSchema,
  type CreateInviteBody,
  type CreateSpaceBody,
  type JoinSpaceBody,
  type JoinSpaceResult,
  type Space,
  type SpaceInvite,
  type SpaceMember,
} from '@snapia/shared';
import { z } from 'zod';
import { apiRequest, apiSend } from '../../lib/http';
import { apiPage, type Page } from '../../lib/pagination';

export const spaceKeys = {
  all: ['spaces'] as const,
  lists: () => [...spaceKeys.all, 'list'] as const,
  details: () => [...spaceKeys.all, 'detail'] as const,
  detail: (spaceId: string) => [...spaceKeys.details(), spaceId] as const,
  members: (spaceId: string) => [...spaceKeys.detail(spaceId), 'members'] as const,
  invites: (spaceId: string) => [...spaceKeys.detail(spaceId), 'invites'] as const,
};

/** The Spaces you own or joined, newest first (archived ones are left out). */
export function listMySpaces(cursor: string | null, signal?: AbortSignal): Promise<Page<Space>> {
  return apiPage('/spaces', spaceSchema, { cursor, signal });
}

export async function getSpace(spaceId: string, signal?: AbortSignal): Promise<Space> {
  const { data } = await apiRequest(`/spaces/${spaceId}`, spaceSchema, { signal });
  return data;
}

export async function createSpace(body: CreateSpaceBody): Promise<Space> {
  const { data } = await apiRequest('/spaces', spaceSchema, { method: 'POST', body });
  return data;
}

export function listMembers(
  spaceId: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<Page<SpaceMember>> {
  return apiPage(`/spaces/${spaceId}/members`, spaceMemberSchema, { cursor, signal });
}

/** Every invite of the Space, newest first (OWNER only). */
export async function listInvites(spaceId: string, signal?: AbortSignal): Promise<SpaceInvite[]> {
  const { data } = await apiRequest(`/spaces/${spaceId}/invites`, z.array(spaceInviteSchema), {
    signal,
  });
  return data;
}

export async function createInvite(spaceId: string, body: CreateInviteBody): Promise<SpaceInvite> {
  const { data } = await apiRequest(`/spaces/${spaceId}/invites`, spaceInviteSchema, {
    method: 'POST',
    body,
  });
  return data;
}

export function revokeInvite(spaceId: string, inviteId: string): Promise<void> {
  return apiSend(`/spaces/${spaceId}/invites/${inviteId}`, { method: 'DELETE' });
}

export async function joinSpace(body: JoinSpaceBody): Promise<JoinSpaceResult> {
  const { data } = await apiRequest('/spaces/join', joinSpaceResultSchema, {
    method: 'POST',
    body,
  });
  return data;
}
