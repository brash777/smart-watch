import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalStorageProvider } from './local-storage-provider';
import type { StorageProvider } from './storage-provider';

let directory: string;
let storage: StorageProvider;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'snapia-storage-test-'));
  storage = createLocalStorageProvider(directory);
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('LocalStorageProvider', () => {
  it('stores objects under nested keys and reads them back', async () => {
    const body = Buffer.from('photo bytes');

    await storage.put('spaces/abc/snaps/one.webp', body, 'image/webp');

    expect(await storage.getBuffer('spaces/abc/snaps/one.webp')).toEqual(body);
  });

  it('gives a file:// URL that points to the stored file', async () => {
    await storage.put('a/b.webp', Buffer.from('x'), 'image/webp');

    const url = await storage.getSignedUrl('a/b.webp');

    expect(url).toMatch(/^file:\/\//);
    expect(existsSync(fileURLToPath(url))).toBe(true);
  });

  it('deletes objects, and deleting a missing object is not an error', async () => {
    await storage.put('to-delete.webp', Buffer.from('x'), 'image/webp');

    await storage.delete('to-delete.webp');
    await storage.delete('to-delete.webp');

    await expect(storage.getBuffer('to-delete.webp')).rejects.toThrow();
  });

  it('refuses keys that would leave the storage folder', async () => {
    await expect(storage.put('../outside.webp', Buffer.from('x'), 'image/webp')).rejects.toThrow(
      /Invalid storage key/,
    );
  });
});
