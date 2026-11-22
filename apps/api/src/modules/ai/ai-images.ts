import sharp from 'sharp';
import type { Config } from '../../config/env';
import type { AiImage } from './ai-provider';

const MEDIA_TYPES = { jpeg: 'image/jpeg', webp: 'image/webp' } as const;

/**
 * A stored photo, ready for the AI: scaled down to AI_IMAGE_MAX_SIDE_PX (image tokens grow with
 * the pixel area) and encoded with AI_IMAGE_FORMAT and AI_IMAGE_QUALITY. Stored photos are
 * already rotated and have no EXIF, and sharp copies no metadata unless asked to.
 */
export async function prepareImageForAi(
  photo: Buffer,
  { maxSidePx, format, quality }: Config['ai']['image'],
): Promise<AiImage> {
  const resized = sharp(photo).resize({
    width: maxSidePx,
    height: maxSidePx,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const encoded = format === 'jpeg' ? resized.jpeg({ quality }) : resized.webp({ quality });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  return { mediaType: MEDIA_TYPES[format], data, width: info.width, height: info.height };
}
