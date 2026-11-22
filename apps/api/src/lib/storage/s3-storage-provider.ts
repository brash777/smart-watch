import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider } from './storage-provider';

export interface S3StorageOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
}

/** Any S3-compatible service: MinIO locally, AWS S3 or Cloudflare R2 in production. */
export function createS3StorageProvider(options: S3StorageOptions): StorageProvider {
  const client = new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    forcePathStyle: options.forcePathStyle,
    credentials: { accessKeyId: options.accessKey, secretAccessKey: options.secretKey },
    // Not every S3-compatible service supports the newest default checksums: only send them
    // when an operation requires them.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Bucket = options.bucket;

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },

    getSignedUrl(key) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), {
        expiresIn: options.signedUrlTtlSeconds,
      });
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    async getBuffer(key) {
      const object = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (object.Body === undefined) throw new Error(`Storage object ${key} has no body`);
      return Buffer.from(await object.Body.transformToByteArray());
    },
  };
}
