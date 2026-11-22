import type { Config } from '../../config/env';
import { createLocalStorageProvider } from './local-storage-provider';
import { createS3StorageProvider } from './s3-storage-provider';
import type { StorageProvider } from './storage-provider';

export type { StorageProvider } from './storage-provider';
export { deleteStoredObjects } from './delete-objects';

/** The storage chosen with STORAGE_DRIVER: s3 (MinIO, AWS S3, R2) or local (a folder). */
export function createStorageProvider(storage: Config['storage']): StorageProvider {
  if (storage.driver === 'local') return createLocalStorageProvider(storage.localDir);
  return createS3StorageProvider({
    ...storage.s3,
    signedUrlTtlSeconds: storage.signedUrlTtlSeconds,
  });
}
