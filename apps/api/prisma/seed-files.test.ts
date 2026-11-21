import { appSettingKeySchema, spaceModeSchema } from '@snapia/shared';
import { describe, expect, it } from 'vitest';
import {
  parseAppSettingsSeed,
  parseDemoDataSeed,
  readSeedFile,
  seedSettingValue,
  type AppSettingSeedEntry,
} from './seed-files';

const settings = parseAppSettingsSeed(readSeedFile('app-settings.json'));
const palette = seedSettingValue(settings, 'space_color_palette');

function firstSetting(): AppSettingSeedEntry {
  const [first] = settings;
  if (first === undefined) throw new Error('app-settings.json is empty');
  return first;
}

describe('app-settings.json', () => {
  it('has exactly one valid entry for every AppSetting key', () => {
    expect(settings.map(({ key }) => key).sort()).toEqual([...appSettingKeySchema.options].sort());
  });

  it('rejects duplicated and missing settings', () => {
    expect(() => parseAppSettingsSeed([...settings, firstSetting()])).toThrow(/is duplicated/);
    expect(() => parseAppSettingsSeed(settings.slice(1))).toThrow(/is missing/);
  });

  it('rejects a value type or a value that does not match the setting', () => {
    const others = settings.slice(1);
    const first = firstSetting();
    const wrongType = first.valueType === 'BOOLEAN' ? 'STRING' : 'BOOLEAN';
    const wrongValue = typeof first.value === 'string' ? 0 : 'not valid';

    expect(() => parseAppSettingsSeed([...others, { ...first, valueType: wrongType }])).toThrow(
      /must have valueType/,
    );
    expect(() => parseAppSettingsSeed([...others, { ...first, value: wrongValue }])).toThrow();
  });
});

describe('demo-data.json', () => {
  const rawDemo = readSeedFile('demo-data.json');

  it('has two demo users and one Space of each mode, with palette colors', () => {
    const demo = parseDemoDataSeed(rawDemo, palette);

    expect(demo.users).toHaveLength(2);
    expect(demo.spaces.map(({ mode }) => mode).sort()).toEqual([...spaceModeSchema.options].sort());
    for (const space of demo.spaces) expect(palette).toContain(space.color);
  });

  function firstDemoSpaceColor(): string {
    const [space] = parseDemoDataSeed(rawDemo, palette).spaces;
    if (space === undefined) throw new Error('demo-data.json has no Spaces');
    return space.color;
  }

  it('rejects colors outside the palette', () => {
    const firstColor = firstDemoSpaceColor();
    const paletteWithoutIt = palette.filter((color) => color !== firstColor);

    expect(() => parseDemoDataSeed(rawDemo, paletteWithoutIt)).toThrow(
      /is not in space_color_palette/,
    );
  });

  it('rejects owners that are not demo users', () => {
    const demo = parseDemoDataSeed(rawDemo, palette);
    const [space] = demo.spaces;
    if (space === undefined) throw new Error('demo-data.json has no Spaces');
    const broken = { ...demo, spaces: [{ ...space, owner: 'not.a.demo.user' }] };

    expect(() => parseDemoDataSeed(broken, palette)).toThrow(/is not a demo user/);
  });
});
