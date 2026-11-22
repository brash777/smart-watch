import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { StorageProvider } from './storage-provider';

/**
 * Files in a folder on disk (LOCAL_STORAGE_DIR, relative to the working directory).
 * Meant for tests and offline development: its "signed" URLs are file:// URLs, not served over HTTP.
 */
export function createLocalStorageProvider(directory: string): StorageProvider {
  const root = resolve(directory);

  /** Absolute path of a key, refusing keys that would leave the storage folder. */
  function pathOf(key: string): string {
    const filePath = resolve(root, key);
    if (!filePath.startsWith(root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return filePath;
  }

  return {
    async put(key, body) {
      const filePath = pathOf(key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, body);
    },

    getSignedUrl(key) {
      return Promise.resolve(pathToFileURL(pathOf(key)).href);
    },

    async delete(key) {
      await rm(pathOf(key), { force: true });
    },

    getBuffer(key) {
      return readFile(pathOf(key));
    },
  };
}
