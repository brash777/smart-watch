import { describe, expect, it } from 'vitest';
import { spaceMetadataByModeSchema } from './space-metadata';

describe('spaceMetadataByModeSchema', () => {
  it('accepts the fields of each mode', () => {
    expect(
      spaceMetadataByModeSchema.safeParse({
        mode: 'STUDY',
        metadata: { subject: 'Physics I', professor: 'Dr. Test', semester: 'Term 1' },
      }).success,
    ).toBe(true);
    expect(
      spaceMetadataByModeSchema.safeParse({
        mode: 'WORK',
        metadata: { project: 'Test project', client: 'Test client', siteLabel: 'Site A' },
      }).success,
    ).toBe(true);
    expect(
      spaceMetadataByModeSchema.safeParse({ mode: 'CONTENT', metadata: { niche: 'Test niche' } })
        .success,
    ).toBe(true);
  });

  it('accepts empty metadata because every field is optional', () => {
    expect(spaceMetadataByModeSchema.safeParse({ mode: 'WORK', metadata: {} }).success).toBe(true);
  });

  it('rejects the fields of another mode', () => {
    const result = spaceMetadataByModeSchema.safeParse({
      mode: 'STUDY',
      metadata: { niche: 'Test niche' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown mode and blank values', () => {
    expect(spaceMetadataByModeSchema.safeParse({ mode: 'HOBBY', metadata: {} }).success).toBe(
      false,
    );
    expect(
      spaceMetadataByModeSchema.safeParse({ mode: 'CONTENT', metadata: { niche: '   ' } }).success,
    ).toBe(false);
  });

  it('trims the text values', () => {
    const result = spaceMetadataByModeSchema.parse({
      mode: 'CONTENT',
      metadata: { niche: '  Test niche  ' },
    });

    expect(result.metadata).toEqual({ niche: 'Test niche' });
  });
});
