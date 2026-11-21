import { readFileSync } from 'node:fs';
import {
  appSettingDefinitions,
  appSettingKeySchema,
  getAppSettingSchema,
  settingValueSchema,
  settingValueTypeSchema,
  spaceMetadataByModeSchema,
  spaceRoleSchema,
  visibilitySchema,
  type AppSettingKey,
  type AppSettingValue,
} from '@snapia/shared';
import { z } from 'zod';

/** Reads and parses one JSON file of prisma/seed-data. */
export function readSeedFile(fileName: string): unknown {
  return JSON.parse(readFileSync(new URL(`./seed-data/${fileName}`, import.meta.url), 'utf8'));
}

const nonEmptyText = z.string().trim().min(1);
const normalizedHandle = nonEmptyText.toLowerCase();

// -----------------------------------------------------------------------------
// app-settings.json
// -----------------------------------------------------------------------------

const appSettingSeedEntrySchema = z
  .object({
    key: appSettingKeySchema,
    valueType: settingValueTypeSchema,
    value: settingValueSchema,
    description: nonEmptyText,
  })
  .superRefine((entry, ctx) => {
    const expectedType = appSettingDefinitions[entry.key].valueType;
    if (entry.valueType !== expectedType) {
      ctx.addIssue({
        code: 'custom',
        path: ['valueType'],
        message: `${entry.key} must have valueType ${expectedType}`,
      });
    }
    const value = getAppSettingSchema(entry.key).safeParse(entry.value);
    if (!value.success) {
      for (const issue of value.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: ['value', ...issue.path],
          message: `${entry.key}: ${issue.message}`,
        });
      }
    }
  });

export type AppSettingSeedEntry = z.infer<typeof appSettingSeedEntrySchema>;

/** Exactly one valid entry for every AppSetting key. */
const appSettingsSeedSchema = z.array(appSettingSeedEntrySchema).superRefine((entries, ctx) => {
  const counts = new Map<string, number>();
  for (const { key } of entries) counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const [key, count] of counts) {
    if (count > 1) ctx.addIssue({ code: 'custom', message: `setting ${key} is duplicated` });
  }
  for (const key of appSettingKeySchema.options) {
    if (!counts.has(key)) ctx.addIssue({ code: 'custom', message: `setting ${key} is missing` });
  }
});

export function parseAppSettingsSeed(data: unknown): AppSettingSeedEntry[] {
  return appSettingsSeedSchema.parse(data);
}

/** The value of one setting in app-settings.json, typed for its key. */
export function seedSettingValue<K extends AppSettingKey>(
  entries: readonly AppSettingSeedEntry[],
  key: K,
): AppSettingValue<K> {
  const entry = entries.find((candidate) => candidate.key === key);
  if (entry === undefined) throw new Error(`Setting ${key} is missing from app-settings.json`);
  return getAppSettingSchema(key).parse(entry.value);
}

// -----------------------------------------------------------------------------
// demo-data.json
// -----------------------------------------------------------------------------

const demoUserSchema = z.object({
  name: nonEmptyText,
  username: normalizedHandle,
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
  university: nonEmptyText.optional(),
  bio: nonEmptyText.optional(),
});

const demoSpaceSchema = z
  .object({
    id: z.uuid(),
    owner: normalizedHandle,
    name: nonEmptyText,
    description: nonEmptyText.optional(),
    color: nonEmptyText,
    visibility: visibilitySchema,
    members: z.array(
      z.object({
        username: normalizedHandle,
        role: spaceRoleSchema.exclude(['OWNER']),
      }),
    ),
  })
  .and(spaceMetadataByModeSchema);

/** Demo users and Spaces; owners and members must be demo users, colors must be in the palette. */
function createDemoDataSchema(palette: readonly string[]) {
  return z
    .object({ users: z.array(demoUserSchema).min(1), spaces: z.array(demoSpaceSchema) })
    .superRefine((demo, ctx) => {
      const usernames = new Set(demo.users.map(({ username }) => username));
      demo.spaces.forEach((space, index) => {
        if (!usernames.has(space.owner)) {
          ctx.addIssue({
            code: 'custom',
            path: ['spaces', index, 'owner'],
            message: `${space.owner} is not a demo user`,
          });
        }
        for (const member of space.members) {
          if (!usernames.has(member.username) || member.username === space.owner) {
            ctx.addIssue({
              code: 'custom',
              path: ['spaces', index, 'members'],
              message: `${member.username} must be a demo user other than the owner`,
            });
          }
        }
        if (!palette.includes(space.color)) {
          ctx.addIssue({
            code: 'custom',
            path: ['spaces', index, 'color'],
            message: `${space.color} is not in space_color_palette`,
          });
        }
      });
    });
}

export type DemoData = z.infer<ReturnType<typeof createDemoDataSchema>>;

export function parseDemoDataSeed(data: unknown, palette: readonly string[]): DemoData {
  return createDemoDataSchema(palette).parse(data);
}
