import type { z } from 'zod';
import type {
  adminSettingSchema,
  adminStatsSchema,
  updateSettingBodySchema,
} from '../schemas/admin';

export type AdminSetting = z.infer<typeof adminSettingSchema>;
export type UpdateSettingBody = z.infer<typeof updateSettingBodySchema>;
export type AdminStats = z.infer<typeof adminStatsSchema>;
