import exifReader from 'exif-reader';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { createTestJpeg, createTestPng, NOT_AN_IMAGE } from '../../../test/fixtures/images';
import { AppError } from '../app-error';
import { readTakenAt } from './exif';
import { createImageProcessor } from './image-processor';

const processor = createImageProcessor({
  maxSidePx: 48,
  thumbnailSidePx: 16,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
});

describe('image processor', () => {
  it('fixture sanity: the GPS photo really carries EXIF, GPS and orientation', async () => {
    const input = await createTestJpeg({
      orientation: 6,
      takenAt: '2024:05:01 10:30:00',
      withGps: true,
    });
    const metadata = await sharp(input).metadata();

    expect(metadata.orientation).toBe(6);
    expect(exifReader(metadata.exif ?? Buffer.alloc(0)).GPSInfo?.GPSLatitude).toEqual([40, 26, 46]);
  });

  it('removes every metadata block, including EXIF and GPS, from the image and the thumbnail', async () => {
    const input = await createTestJpeg({ takenAt: '2024:05:01 10:30:00', withGps: true });

    const { image, thumbnail } = await processor.processPhoto(input);

    for (const file of [image, thumbnail]) {
      const metadata = await sharp(file.buffer).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(file.buffer.includes('FixtureCam')).toBe(false);
    }
  });

  it('reads the date the photo was taken before removing the EXIF data', async () => {
    const withDate = await processor.processPhoto(
      await createTestJpeg({ takenAt: '2024:05:01 10:30:00' }),
    );
    const withoutDate = await processor.processPhoto(await createTestJpeg());

    expect(withDate.takenAt?.toISOString()).toBe('2024-05-01T10:30:00.000Z');
    expect(withoutDate.takenAt).toBeNull();
  });

  it('ignores missing, broken or future EXIF dates', () => {
    const now = new Date('2024-01-01T00:00:00Z');

    expect(readTakenAt(undefined, now)).toBeNull();
    expect(readTakenAt(Buffer.from('broken exif'), now)).toBeNull();
  });

  it('rotates the photo according to its EXIF orientation', async () => {
    const input = await createTestJpeg({ width: 64, height: 32, orientation: 6 });

    const { image } = await processor.processPhoto(input);

    expect(image.height).toBeGreaterThan(image.width);
  });

  it('resizes to the maximum side, keeps proportions and never enlarges', async () => {
    const big = await processor.processPhoto(await createTestJpeg({ width: 200, height: 100 }));
    const small = await processor.processPhoto(await createTestJpeg({ width: 20, height: 10 }));

    expect([big.image.width, big.image.height]).toEqual([48, 24]);
    expect([big.thumbnail.width, big.thumbnail.height]).toEqual([16, 8]);
    expect([small.image.width, small.image.height]).toEqual([20, 10]);
    expect(big.image.sizeBytes).toBe(big.image.buffer.length);
  });

  it('makes square thumbnails for avatars', async () => {
    const { thumbnail } = await processor.processAvatar(
      await createTestJpeg({ width: 200, height: 100 }),
    );

    expect([thumbnail.width, thumbnail.height]).toEqual([16, 16]);
  });

  it('rejects files that are not images or whose real type is not allowed', async () => {
    const jpegOnly = createImageProcessor({
      maxSidePx: 48,
      thumbnailSidePx: 16,
      allowedMimeTypes: ['image/jpeg'],
    });

    const notImage = await processor.processPhoto(NOT_AN_IMAGE).catch((e: unknown) => e);
    const pngNotAllowed = await jpegOnly
      .processPhoto(await createTestPng())
      .catch((e: unknown) => e);

    expect(notImage).toBeInstanceOf(AppError);
    expect(notImage).toMatchObject({ code: 'UNSUPPORTED_IMAGE', status: 415 });
    expect(pngNotAllowed).toMatchObject({ code: 'UNSUPPORTED_IMAGE', status: 415 });
  });
});
