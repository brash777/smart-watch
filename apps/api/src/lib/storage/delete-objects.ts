import type { Logger } from 'pino';
import type { StorageProvider } from './storage-provider';

/** Deletes stored files. A failure only leaves an orphan file, so it is logged, not thrown. */
export async function deleteStoredObjects(
  storage: StorageProvider,
  keys: readonly string[],
  logger: Logger,
): Promise<void> {
  const results = await Promise.allSettled(keys.map((key) => storage.delete(key)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn({ err: result.reason, key: keys[index] }, 'Could not delete a stored file');
    }
  });
}
