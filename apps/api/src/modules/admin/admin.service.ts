import { adminSettingSchema, appSettingKeySchema, type AdminSetting } from '@snapia/shared';
import { ZodError } from 'zod';
import { AppError } from '../../lib/app-error';
import type { SettingsService } from '../settings/settings.service';
import type { AdminRepository } from './admin.repository';

export function createAdminService({
  repository,
  settings,
}: {
  repository: AdminRepository;
  settings: SettingsService;
}) {
  return {
    async listSettings(): Promise<AdminSetting[]> {
      const rows = await repository.listSettings();
      return rows.map((row) =>
        adminSettingSchema.parse({ ...row, updatedAt: row.updatedAt.toISOString() }),
      );
    },

    /** Validates the value with the schema of its key, saves it and clears the cache. */
    async updateSetting(key: string, value: unknown): Promise<AdminSetting> {
      const parsedKey = appSettingKeySchema.safeParse(key);
      if (!parsedKey.success)
        throw new AppError('SETTING_NOT_FOUND', `Unknown setting ${key}`, 404);
      try {
        await settings.updateSetting(parsedKey.data, value);
      } catch (error) {
        if (error instanceof ZodError) {
          throw new AppError(
            'INVALID_SETTING_VALUE',
            `Invalid value for ${key}`,
            400,
            error.issues,
          );
        }
        throw error;
      }
      const updated = (await this.listSettings()).find((setting) => setting.key === key);
      if (updated === undefined)
        throw new AppError('SETTING_NOT_FOUND', `Unknown setting ${key}`, 404);
      return updated;
    },

    stats: () => repository.stats(),
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
