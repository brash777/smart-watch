import exifReader from 'exif-reader';

/**
 * When the photo was taken, from its EXIF data (DateTimeOriginal, then DateTimeDigitized,
 * then DateTime). Cameras store their local time without a time zone; it is read as UTC.
 * Returns null when the photo has no usable date, so the caller can use the upload time.
 */
export function readTakenAt(exif: Buffer | undefined, now: Date): Date | null {
  if (exif === undefined) return null;
  try {
    const tags = exifReader(exif);
    const date =
      tags.Photo?.DateTimeOriginal ?? tags.Photo?.DateTimeDigitized ?? tags.Image?.DateTime;
    if (!(date instanceof Date) || Number.isNaN(date.getTime()) || date > now) return null;
    return date;
  } catch {
    // Broken EXIF data must not block the upload.
    return null;
  }
}
