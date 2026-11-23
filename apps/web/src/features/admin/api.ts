import {
  adminSettingSchema,
  adminStatsSchema,
  adminUserSchema,
  type AdminSetting,
  type AdminStats,
  type AdminUser,
  type SettingValue,
} from '@snapia/shared';
import { z } from 'zod';
import { apiRequest } from '../../lib/http';
import { apiPage, withQuery, type Page } from '../../lib/pagination';

export const adminKeys = {
  stats: ['admin', 'stats'] as const,
  settings: ['admin', 'settings'] as const,
  users: (query: string) => ['admin', 'users', query] as const,
};

export async function getStats(signal?: AbortSignal): Promise<AdminStats> {
  return (await apiRequest('/admin/stats', adminStatsSchema, { signal })).data;
}

export async function listSettings(signal?: AbortSignal): Promise<AdminSetting[]> {
  return (await apiRequest('/admin/settings', z.array(adminSettingSchema), { signal })).data;
}

export async function updateSetting(key: string, value: SettingValue): Promise<AdminSetting> {
  return (
    await apiRequest(`/admin/settings/${key}`, adminSettingSchema, {
      method: 'PATCH',
      body: { value },
    })
  ).data;
}

export function listUsers(
  query: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<Page<AdminUser>> {
  return apiPage(withQuery('/admin/users', { q: query === '' ? null : query }), adminUserSchema, {
    cursor,
    signal,
  });
}

export async function setUserActive(userId: string, isActive: boolean): Promise<AdminUser> {
  return (
    await apiRequest(`/admin/users/${userId}/status`, adminUserSchema, {
      method: 'PATCH',
      body: { isActive },
    })
  ).data;
}
