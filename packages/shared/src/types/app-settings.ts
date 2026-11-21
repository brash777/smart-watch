import type { z } from 'zod';
import type { appSettingDefinitions, settingValueTypeSchema } from '../schemas/app-settings';

export type SettingValueType = z.infer<typeof settingValueTypeSchema>;
export type AppSettingKey = keyof typeof appSettingDefinitions;
export type AppSettingValue<K extends AppSettingKey> = z.infer<
  (typeof appSettingDefinitions)[K]['schema']
>;
export type AppSettingValues = { [K in AppSettingKey]: AppSettingValue<K> };
