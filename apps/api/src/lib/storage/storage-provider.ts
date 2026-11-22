/**
 * Where photos are stored. The rest of the API only talks to this interface;
 * STORAGE_DRIVER chooses the implementation (s3 or local).
 */
export interface StorageProvider {
  /** Saves an object, replacing any object with the same key. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** A temporary URL to read the object, valid for SIGNED_URL_TTL_SECONDS. */
  getSignedUrl(key: string): Promise<string>;
  /** Deletes an object. Deleting a missing object is not an error. */
  delete(key: string): Promise<void>;
  /** Reads a whole object (for example to send a photo to the AI). */
  getBuffer(key: string): Promise<Buffer>;
}
