/** Every photo the browser scales down is sent as JPEG, which every browser can encode. */
const OUTPUT_TYPE = 'image/jpeg';

interface CompressOptions {
  /** IMAGE_MAX_SIDE_PX: the API never keeps more pixels than this. */
  maxSidePx: number;
  quality: number;
  allowedTypes: readonly string[];
}

/**
 * Scales a photo down before it is uploaded, so phones send less data. A photo that already
 * fits is sent as it is (with its EXIF date). Browsers apply the EXIF orientation when they
 * draw an image. If the browser cannot read the photo, the API decides about it.
 */
export async function compressPhoto(file: File, options: CompressOptions): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const longSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (longSide <= options.maxSidePx && options.allowedTypes.includes(file.type)) return file;

    const scale = Math.min(1, options.maxSidePx / longSide);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, OUTPUT_TYPE, options.quality);
    });
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
