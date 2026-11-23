import { z } from 'zod';
import { settingValueSchema, settingValueTypeSchema } from './app-settings';
import { spaceModeSchema } from './enums';

/** An AppSetting as ADMINs see it (GET /api/admin/settings). */
export const adminSettingSchema = z.object({
  key: z.string(),
  valueType: settingValueTypeSchema,
  value: settingValueSchema,
  description: z.string(),
  updatedAt: z.iso.datetime(),
});

/** PATCH /api/admin/settings/:key: the value is checked with the schema of its key. */
export const updateSettingBodySchema = z.object({ value: settingValueSchema });

const count = z.number().int().nonnegative();

/** GET /api/admin/stats: the numbers of the admin panel. */
export const adminStatsSchema = z.object({
  users: z.object({ total: count, active: count }),
  snapsByMode: z.record(spaceModeSchema, count),
  documents: count,
  ai: z.object({
    runs: count,
    failed: count,
    /** Sum of the estimated cost of every AiRun, in USD. */
    estimatedCostUsd: z.number().nonnegative(),
  }),
});
