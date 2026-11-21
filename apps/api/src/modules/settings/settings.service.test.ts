import type { AppSettingKey, SettingValue } from '@snapia/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ZodError } from 'zod';
import { parseAppSettingsSeed, readSeedFile } from '../../../prisma/seed-files';
import { AppError } from '../../lib/app-error';
import type { SettingsRepository } from './settings.repository';
import { createSettingsService } from './settings.service';

// Setting values come from the seed file, never from this test.
const seedEntries = parseAppSettingsSeed(readSeedFile('app-settings.json'));

function seedValue(key: AppSettingKey): SettingValue {
  const entry = seedEntries.find((candidate) => candidate.key === key);
  if (entry === undefined) throw new Error(`Missing seed value for ${key}`);
  return entry.value;
}

/** In-memory repository loaded with the seed values; counts the calls it receives. */
function createFakeRepository(overrides: Partial<Record<AppSettingKey, unknown>> = {}) {
  const stored = new Map<AppSettingKey, unknown>(seedEntries.map(({ key, value }) => [key, value]));
  for (const [key, value] of Object.entries(overrides)) {
    stored.set(key as AppSettingKey, value);
  }
  const calls = { findByKey: 0, saveValue: 0 };

  const repository: SettingsRepository = {
    findByKey(key) {
      calls.findByKey += 1;
      return Promise.resolve(stored.has(key) ? { value: stored.get(key) } : null);
    },
    saveValue(key, value) {
      calls.saveValue += 1;
      if (!stored.has(key)) return Promise.resolve(false);
      stored.set(key, value);
      return Promise.resolve(true);
    },
  };
  return { repository, stored, calls };
}

describe('settings service', () => {
  it('returns the stored value, validated and typed for its key', async () => {
    const { repository } = createFakeRepository();
    const service = createSettingsService(repository);

    expect(await service.getSetting('moment_ttl_hours')).toBe(seedValue('moment_ttl_hours'));
    expect(await service.getSetting('space_color_palette')).toEqual(
      seedValue('space_color_palette'),
    );
    expectTypeOf(service.getSetting('moment_ttl_hours')).resolves.toEqualTypeOf<number>();
    expectTypeOf(service.getSetting('space_color_palette')).resolves.toEqualTypeOf<string[]>();
    expectTypeOf(service.getSetting('ai_output_language')).resolves.toEqualTypeOf<string>();
  });

  it('caches values: each key is read from the repository once', async () => {
    const { repository, calls } = createFakeRepository();
    const service = createSettingsService(repository);

    await service.getSetting('comment_max_length');
    await service.getSetting('comment_max_length');
    await service.getSetting('quiz_default_questions');

    expect(calls.findByKey).toBe(2);
  });

  it('invalidates the cached value when the setting is updated', async () => {
    const { repository, calls } = createFakeRepository();
    const service = createSettingsService(repository);
    const current = await service.getSetting('moment_ttl_hours');

    const updated = await service.updateSetting('moment_ttl_hours', current + 1);

    expect(updated).toBe(current + 1);
    expect(await service.getSetting('moment_ttl_hours')).toBe(current + 1);
    expect(calls.findByKey).toBe(2);
  });

  it('rejects an invalid update without saving it or touching the cache', async () => {
    const { repository, calls } = createFakeRepository();
    const service = createSettingsService(repository);
    const current = await service.getSetting('moment_ttl_hours');

    await expect(service.updateSetting('moment_ttl_hours', 'not a number')).rejects.toThrow(
      ZodError,
    );
    expect(calls.saveValue).toBe(0);
    expect(await service.getSetting('moment_ttl_hours')).toBe(current);
  });

  it('fails with SETTING_NOT_FOUND when the setting is not in the database', async () => {
    const { repository, stored } = createFakeRepository();
    stored.delete('trending_hashtags_days');
    const service = createSettingsService(repository);

    await expect(service.getSetting('trending_hashtags_days')).rejects.toMatchObject({
      code: 'SETTING_NOT_FOUND',
      status: 500,
    });
    await expect(service.updateSetting('trending_hashtags_days', 1)).rejects.toMatchObject({
      code: 'SETTING_NOT_FOUND',
      status: 404,
    });
  });

  it('fails with SETTING_INVALID when the stored value does not match the schema', async () => {
    const { repository } = createFakeRepository({ space_color_palette: ['not a color'] });
    const service = createSettingsService(repository);

    const error: unknown = await service.getSetting('space_color_palette').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'SETTING_INVALID', status: 500 });
  });

  it('reads again from the repository after clearCache()', async () => {
    const { repository, calls } = createFakeRepository();
    const service = createSettingsService(repository);

    await service.getSetting('invite_code_length');
    service.clearCache();
    await service.getSetting('invite_code_length');

    expect(calls.findByKey).toBe(2);
  });
});
