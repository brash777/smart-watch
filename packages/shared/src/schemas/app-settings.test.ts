import { describe, expect, it } from 'vitest';
import { appSettingDefinitions, appSettingKeySchema, settingValueTypeSchema } from './app-settings';

describe('appSettingDefinitions', () => {
  it('lists every definition in appSettingKeySchema, with a known value type', () => {
    for (const [key, definition] of Object.entries(appSettingDefinitions)) {
      expect(appSettingKeySchema.safeParse(key).success).toBe(true);
      expect(settingValueTypeSchema.safeParse(definition.valueType).success).toBe(true);
    }
    expect(appSettingKeySchema.options).toHaveLength(Object.keys(appSettingDefinitions).length);
  });

  it('rejects unknown keys', () => {
    expect(appSettingKeySchema.safeParse('not_a_setting').success).toBe(false);
  });

  it('validates NUMBER settings as numbers, not as numeric strings', () => {
    const { schema } = appSettingDefinitions.comment_max_length;

    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse('1').success).toBe(false);
    expect(schema.safeParse(0).success).toBe(false);
  });

  it('accepts hex colors only in space_color_palette', () => {
    const { schema } = appSettingDefinitions.space_color_palette;

    expect(schema.safeParse(['#000000', '#ffFFff']).success).toBe(true);
    expect(schema.safeParse(['red']).success).toBe(false);
    expect(schema.safeParse([]).success).toBe(false);
  });

  it('accepts lowercase hashtags without # in default_hashtags', () => {
    const { schema } = appSettingDefinitions.default_hashtags;

    expect(schema.safeParse(['tag_1', 'etiqueta']).success).toBe(true);
    expect(schema.safeParse(['#tag']).success).toBe(false);
    expect(schema.safeParse(['Tag']).success).toBe(false);
  });

  it('accepts language tags in ai_output_language', () => {
    const { schema } = appSettingDefinitions.ai_output_language;

    expect(schema.safeParse('en').success).toBe(true);
    expect(schema.safeParse('pt-BR').success).toBe(true);
    expect(schema.safeParse('English').success).toBe(false);
  });
});
