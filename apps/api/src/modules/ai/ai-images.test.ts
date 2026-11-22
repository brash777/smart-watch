import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { prepareImageForAi } from './ai-images';

async function photo(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 90, b: 160 } } })
    .webp()
    .toBuffer();
}

describe('prepareImageForAi', () => {
  it('scales a photo down to the longest side and encodes it as configured', async () => {
    const image = await prepareImageForAi(await photo(1200, 600), {
      maxSidePx: 300,
      format: 'jpeg',
      quality: 80,
    });

    expect(image).toMatchObject({ mediaType: 'image/jpeg', width: 300, height: 150 });
    const metadata = await sharp(image.data).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 300, height: 150 });
    expect(metadata.exif).toBeUndefined();
  });

  it('never enlarges a small photo', async () => {
    const image = await prepareImageForAi(await photo(200, 400), {
      maxSidePx: 1000,
      format: 'webp',
      quality: 80,
    });

    expect(image).toMatchObject({ mediaType: 'image/webp', width: 200, height: 400 });
    expect((await sharp(image.data).metadata()).format).toBe('webp');
  });
});
