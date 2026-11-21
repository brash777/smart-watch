import type { AppSettingKey, SettingValue } from '@snapia/shared';
import type { PrismaClient } from '../../lib/prisma';

export interface SettingsRepository {
  /** The stored value of a setting, or null when the key is not in the database. */
  findByKey(key: AppSettingKey): Promise<{ value: unknown } | null>;
  /** Saves a new value for an existing setting. Returns false when the key is not in the database. */
  saveValue(key: AppSettingKey, value: SettingValue): Promise<boolean>;
}

export function createSettingsRepository(prisma: PrismaClient): SettingsRepository {
  return {
    findByKey: (key) => prisma.appSetting.findUnique({ where: { key }, select: { value: true } }),

    async saveValue(key, value) {
      const { count } = await prisma.appSetting.updateMany({ where: { key }, data: { value } });
      return count > 0;
    },
  };
}
