import sharp, { type Metadata, type Sharp } from 'sharp';
import { AppError } from '../app-error';
import { readTakenAt } from './exif';

/** Every processed image is stored as WebP. */
export const PROCESSED_IMAGE_MIME_TYPE = 'image/webp';

export interface ImageProcessorOptions {
  /** IMAGE_MAX_SIDE_PX: longest side of the stored image. */
  maxSidePx: number;
  /** THUMBNAIL_SIDE_PX: longest side (or side, when square) of the thumbnail. */
  thumbnailSidePx: number;
  /** UPLOAD_ALLOWED_MIME: checked against the real content of the file. */
  allowedMimeTypes: readonly string[];
}

export interface ProcessedFile {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ProcessedImage {
  image: ProcessedFile;
  thumbnail: ProcessedFile;
  /** When the photo was taken according to its EXIF data, or null if it does not say. */
  takenAt: Date | null;
}

/** MIME type of the format sharp detected in the bytes (never trusts the uploaded file name). */
function detectedMimeType({ format, compression }: Metadata): string | undefined {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'tiff':
      return 'image/tiff';
    case 'heif':
      return compression === 'av1' ? 'image/avif' : 'image/heic';
    default:
      return undefined;
  }
}

function unsupportedImage(message: string): AppError {
  return new AppError('UNSUPPORTED_IMAGE', message, 415);
}

async function toProcessedFile(pipeline: Sharp): Promise<ProcessedFile> {
  const { data, info } = await pipeline.webp().toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height, sizeBytes: info.size };
}

/**
 * Turns an uploaded photo into what Snapia stores:
 * 1. checks that the bytes are an image of an allowed type;
 * 2. reads the date it was taken from EXIF, before the metadata is removed;
 * 3. rotates it according to its EXIF orientation;
 * 4. drops every metadata block (EXIF with GPS, XMP, IPTC, ICC): sharp only copies metadata
 *    when asked to, and this code never asks;
 * 5. resizes it to IMAGE_MAX_SIDE_PX and creates a THUMBNAIL_SIDE_PX thumbnail, both WebP.
 */
export function createImageProcessor({
  maxSidePx,
  thumbnailSidePx,
  allowedMimeTypes,
}: ImageProcessorOptions) {
  async function processImage(input: Buffer, squareThumbnail: boolean): Promise<ProcessedImage> {
    let metadata: Metadata;
    try {
      metadata = await sharp(input).metadata();
    } catch {
      throw unsupportedImage('The file is not an image');
    }
    const mimeType = detectedMimeType(metadata);
    if (mimeType === undefined || !allowedMimeTypes.includes(mimeType)) {
      throw unsupportedImage(`Images of type ${mimeType ?? metadata.format} are not accepted`);
    }

    const takenAt = readTakenAt(metadata.exif, new Date());
    const oriented = sharp(input).rotate();

    const image = await toProcessedFile(
      oriented.clone().resize({
        width: maxSidePx,
        height: maxSidePx,
        fit: 'inside',
        withoutEnlargement: true,
      }),
    );
    const thumbnail = await toProcessedFile(
      oriented.clone().resize({
        width: thumbnailSidePx,
        height: thumbnailSidePx,
        fit: squareThumbnail ? 'cover' : 'inside',
        // A square thumbnail must always be square, even from a small photo.
        withoutEnlargement: !squareThumbnail,
      }),
    );
    return { image, thumbnail, takenAt };
  }

  return {
    /** A snap: the thumbnail keeps the proportions of the photo. */
    processPhoto(input: Buffer): Promise<ProcessedImage> {
      return processImage(input, false);
    },

    /** A profile photo: same processing, with a square thumbnail. */
    processAvatar(input: Buffer): Promise<ProcessedImage> {
      return processImage(input, true);
    },
  };
}

export type ImageProcessor = ReturnType<typeof createImageProcessor>;
