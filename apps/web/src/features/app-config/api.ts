import { appConfigSchema, type AppConfig } from '@snapia/shared';
import { apiRequest } from '../../lib/http';

export const appConfigKeys = {
  all: ['app-config'] as const,
};

/** The Space color palette and the upload limits (GET /api/app-config). */
export async function getAppConfig(signal?: AbortSignal): Promise<AppConfig> {
  const { data } = await apiRequest('/app-config', appConfigSchema, { signal });
  return data;
}
