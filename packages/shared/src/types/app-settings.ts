import type { z } from 'zod';
import type {
  appSettingDefinitions,
  settingValueSchema,
  settingValueTypeSchema,
} from '../schemas/app-settings';

export type SettingValueType = z.infer<typeof settingValueTypeSchema>;
export type SettingValue = z.infer<typeof settingValueSchema>;
export type AppSettingKey = keyof typeof appSettingDefinitions;
/** The value of every setting, typed by its key. */
export type AppSettingValues = {
  [K in AppSettingKey]: z.infer<(typeof appSettingDefinitions)[K]['schema']>;
};
export type AppSettingValue<K extends AppSettingKey> = AppSettingValues[K];
