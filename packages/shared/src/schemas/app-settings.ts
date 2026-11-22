import { z } from 'zod';
import type { AppSettingKey, AppSettingValue } from '../types/app-settings';

/** How an AppSetting value is stored and edited. */
export const settingValueTypeSchema = z.enum(['NUMBER', 'STRING', 'BOOLEAN', 'STRING_LIST']);

/** Any value an AppSetting can hold, whatever its key. */
export const settingValueSchema = z.union([
  z.number(),
  z.string(),
  z.boolean(),
  z.array(z.string()),
]);

const positiveInt = z.number().int().positive();
const nonNegativeNumber = z.number().nonnegative();
const positiveNumber = z.number().positive();
const nonEmptyText = z.string().trim().min(1);
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected a hex color such as #1A2B3C');
const hashtag = z
  .string()
  .regex(/^[\p{Ll}\p{Nd}_]+$/u, 'expected a lowercase hashtag without the # sign');
const languageTag = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'expected a language tag such as es or es-CO');

/**
 * Value type and value schema of every AppSetting key.
 * The values themselves live in apps/api/prisma/seed-data/app-settings.json, never in code.
 */
export const appSettingDefinitions = {
  /** Hours a Moment stays visible. */
  moment_ttl_hours: { valueType: 'NUMBER', schema: positiveInt },
  /** Maximum snaps in one Space. */
  max_snaps_per_space: { valueType: 'NUMBER', schema: positiveInt },
  /** Maximum snaps selected for one Compose. */
  max_snaps_per_compose: { valueType: 'NUMBER', schema: positiveInt },
  /** Maximum snaps in one Post. */
  max_snaps_per_post: { valueType: 'NUMBER', schema: positiveInt },
  /** Characters of a SpaceInvite code. */
  invite_code_length: { valueType: 'NUMBER', schema: positiveInt },
  /** Hours an invite stays valid when the OWNER does not choose. */
  invite_default_ttl_hours: { valueType: 'NUMBER', schema: positiveInt },
  /** Uses of an invite when the OWNER does not choose. */
  invite_default_max_uses: { valueType: 'NUMBER', schema: positiveInt },
  /** Language tag of every AI output. */
  ai_output_language: { valueType: 'STRING', schema: languageTag },
  /** Tone the AI uses for CONTENT captions. */
  content_caption_tone: { valueType: 'STRING', schema: nonEmptyText },
  /** Hashtags suggested for every Post. */
  default_hashtags: { valueType: 'STRING_LIST', schema: z.array(hashtag) },
  /** Academic integrity notice shown with every ASSIGNMENT_GUIDE. */
  assignment_guide_notice: { valueType: 'STRING', schema: nonEmptyText },
  /** Maximum characters of a Comment. */
  comment_max_length: { valueType: 'NUMBER', schema: positiveInt },
  /** Previous AskMessages sent to the AI with each question. */
  ask_history_max_messages: { valueType: 'NUMBER', schema: positiveInt },
  /** Questions of a generated Quiz when the user does not choose. */
  quiz_default_questions: { valueType: 'NUMBER', schema: positiveInt },
  /** Cards of a generated FlashcardDeck when the user does not choose. */
  flashcards_default_count: { valueType: 'NUMBER', schema: positiveInt },
  /** Days counted for trending hashtags in Explore. */
  trending_hashtags_days: { valueType: 'NUMBER', schema: positiveInt },
  /** Colors a Space can have. */
  space_color_palette: { valueType: 'STRING_LIST', schema: z.array(hexColor).min(1) },
  /** How often the web app checks pending snap analyses, in milliseconds. */
  analysis_poll_interval_ms: { valueType: 'NUMBER', schema: positiveInt },
  /** USD per million input tokens of AI_MODEL, for AiRun cost estimates. */
  ai_cost_per_million_input_tokens: { valueType: 'NUMBER', schema: nonNegativeNumber },
  /** USD per million output tokens of AI_MODEL, for AiRun cost estimates. */
  ai_cost_per_million_output_tokens: { valueType: 'NUMBER', schema: nonNegativeNumber },
  /** How many times the token prices fast mode costs (AI speed "fast"), for AiRun cost estimates. */
  ai_fast_mode_price_multiplier: { valueType: 'NUMBER', schema: positiveNumber },
} as const satisfies Record<
  string,
  { valueType: z.infer<typeof settingValueTypeSchema>; schema: z.ZodType }
>;

const appSettingKeys = Object.keys(appSettingDefinitions) as [
  keyof typeof appSettingDefinitions,
  ...(keyof typeof appSettingDefinitions)[],
];

/** Every known AppSetting key. */
export const appSettingKeySchema = z.enum(appSettingKeys);

/** The value schema of one setting, typed for its key. */
export function getAppSettingSchema<K extends AppSettingKey>(
  key: K,
): z.ZodType<AppSettingValue<K>> {
  // TypeScript cannot relate a generic key to its own schema, so this is the one place
  // where the lookup is cast; AppSettingValue<K> is derived from that same schema.
  return appSettingDefinitions[key].schema as unknown as z.ZodType<AppSettingValue<K>>;
}
