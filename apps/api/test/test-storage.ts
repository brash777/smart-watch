import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalStorageProvider } from '../src/lib/storage/local-storage-provider';
import type { StorageProvider } from '../src/lib/storage/storage-provider';

/** A LocalStorageProvider in a fresh temporary folder, plus a function that deletes it. */
export async function createTestStorage(): Promise<{
  storage: StorageProvider;
  directory: string;
  cleanup: () => Promise<void>;
}> {
  const directory = await mkdtemp(join(tmpdir(), 'snapia-test-storage-'));
  return {
    storage: createLocalStorageProvider(directory),
    directory,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
