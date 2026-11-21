import {
  getAppSettingSchema,
  type AppSettingKey,
  type AppSettingValue,
  type AppSettingValues,
} from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import type { SettingsRepository } from './settings.repository';

export interface SettingsService {
  /** The value of a setting, typed for its key and validated with its Zod schema. */
  getSetting<K extends AppSettingKey>(key: K): Promise<AppSettingValue<K>>;
  /** Validates and saves a new value, then invalidates the cached one. Throws ZodError if invalid. */
  updateSetting<K extends AppSettingKey>(key: K, value: unknown): Promise<AppSettingValue<K>>;
  /** Forgets every cached value, so the next reads come from the database. */
  clearCache(): void;
}

/**
 * Typed access to the AppSetting table with an in-memory cache.
 * The cache belongs to this process: a value changed outside this service (directly in the
 * database or by another API instance) is read again after clearCache() or a restart.
 */
export function createSettingsService(repository: SettingsRepository): SettingsService {
  let cache: Partial<AppSettingValues> = {};

  return {
    async getSetting<K extends AppSettingKey>(key: K): Promise<AppSettingValue<K>> {
      const cached = cache[key];
      if (cached !== undefined) return cached;

      const stored = await repository.findByKey(key);
      if (stored === null) {
        throw new AppError('SETTING_NOT_FOUND', `Setting ${key} is missing`, 500);
      }
      const parsed = getAppSettingSchema(key).safeParse(stored.value);
      if (!parsed.success) {
        throw new AppError('SETTING_INVALID', `Setting ${key} has an invalid stored value`, 500);
      }
      cache[key] = parsed.data;
      return parsed.data;
    },

    async updateSetting<K extends AppSettingKey>(
      key: K,
      value: unknown,
    ): Promise<AppSettingValue<K>> {
      const parsed = getAppSettingSchema(key).parse(value);
      const saved = await repository.saveValue(key, parsed);
      if (!saved) {
        throw new AppError('SETTING_NOT_FOUND', `Setting ${key} does not exist`, 404);
      }
      delete cache[key];
      return parsed;
    },

    clearCache() {
      cache = {};
    },
  };
}
