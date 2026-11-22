import sharp from 'sharp';

/**
 * Test images generated with sharp at run time (no binary files in the repository).
 * The coordinates and the date below are made-up fixture values.
 */

export interface TestPhotoOptions {
  width?: number;
  height?: number;
  /** EXIF orientation (1 = upright, 6 = rotated 90° clockwise). */
  orientation?: number;
  /** EXIF DateTimeOriginal, in the "YYYY:MM:DD HH:MM:SS" camera format. */
  takenAt?: string;
  /** Adds EXIF GPS coordinates and camera details, which Snapia must remove. */
  withGps?: boolean;
}

/** A JPEG photo, optionally with EXIF orientation, date and GPS location. */
export async function createTestJpeg({
  width = 64,
  height = 32,
  orientation,
  takenAt,
  withGps = false,
}: TestPhotoOptions = {}): Promise<Buffer> {
  const base = await sharp({
    create: { width, height, channels: 3, background: { r: 51, g: 102, b: 204 } },
  })
    .jpeg()
    .toBuffer();

  let image = sharp(base);
  if (orientation !== undefined) image = image.withMetadata({ orientation });
  const exif = {
    ...(withGps ? { IFD0: { Make: 'FixtureCam', Model: 'GPS-1' } } : {}),
    ...(takenAt === undefined ? {} : { IFD2: { DateTimeOriginal: takenAt } }),
    ...(withGps
      ? {
          IFD3: {
            GPSLatitudeRef: 'N',
            GPSLatitude: '40/1 26/1 46/1',
            GPSLongitudeRef: 'W',
            GPSLongitude: '79/1 58/1 56/1',
          },
        }
      : {}),
  };
  if (Object.keys(exif).length > 0) image = image.withExifMerge(exif);
  return image.jpeg().toBuffer();
}

/** A PNG image. */
export function createTestPng(width = 40, height = 40): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: '#ff8800' } })
    .png()
    .toBuffer();
}

/** Bytes that are not an image at all. */
export const NOT_AN_IMAGE = Buffer.from('this is not an image');
